import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    CallToolResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import puppeteer, { Browser, Page, Dialog } from 'puppeteer-core';
import { z, ZodSchema } from 'zod';
import { platform } from 'os';
import { existsSync } from 'fs';

// --- Configuration ---
// Cross-platform Chrome executable path detection
function findChromePath(): string | undefined {
    const defaultPaths = {
        win32: [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
            `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
            `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`,
        ],
        darwin: [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chrome.app/Contents/MacOS/Chrome',
        ],
        linux: [
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            '/snap/bin/chromium',
        ],
    };

    const currentPlatform = platform() as 'win32' | 'darwin' | 'linux';
    const paths = defaultPaths[currentPlatform] || [];

    return paths.find((path) => existsSync(path));
}

// --- State --- (Define these at the top level)
let browser: Browser | null = null;
let page: Page | null = null;

// --- Helper Functions --- (Define these at the top level)
async function getBrowserPage(): Promise<{ browser: Browser; page: Page }> {
    if (!browser || !browser.isConnected()) {
        const chromePath = findChromePath();

        // Define a realistic User-Agent
        const userAgent =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'; // Example, update Chrome version periodically

        const launchOptions: any = {
            headless: false,
            args: [
                // Remove --start-maximized
                // '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                `--user-agent=${userAgent}`, // Add User-Agent arg
            ],
        };

        if (chromePath) {
            launchOptions.executablePath = chromePath;
        } else {
            console.warn(
                'Chrome executable not found in common locations. Falling back to puppeteer detection.'
            );
            // Let puppeteer-core try to find Chrome on its own
        }

        // Launch using the wrapper, which uses puppeteer-core internally
        browser = await puppeteer.launch(launchOptions);
        browser.on('disconnected', () => {
            browser = null;
            page = null;
        });
    }
    // Ensure page exists or create a new one if browser exists but page doesn't/is closed
    if (browser && (!page || page.isClosed())) {
        const pages = await browser.pages();
        // Use the first existing page, or create a new one if none exist
        page = pages.length > 0 ? pages[0] : await browser.newPage();

        // Explicitly set viewport to screen dimensions
        const screenDimensions = await page.evaluate(() => {
            return {
                width: Math.round(window.screen.width / 2), // Set width to half screen width
                height: window.screen.height,
                deviceScaleFactor: window.devicePixelRatio, // Consider device scaling
            };
        });
        await page.setViewport(screenDimensions);

        page.on('dialog', async (dialog: Dialog) => {
            try {
                await dialog.dismiss();
            } catch (error) {
                // Dialog dismiss error, continue silently
                console.error(`Error dismissing dialog: ${error}`);
            }
        });
    }
    // If browser doesn't exist, this will throw implicitly, or explicitly:
    if (!browser || !page) {
        throw new Error('Browser or Page could not be initialized.');
    }

    return { browser, page };
}

// Define safeExecute at the top level
async function safeExecute<T>(
    action: (page: Page) => Promise<T>,
    includePageInfo = true
): Promise<{ success: boolean; data?: T; currentUrl?: string; title?: string; error?: string }> {
    let currentPage: Page | null = null;
    try {
        // Ensure page is available before executing
        const pageResult = await getBrowserPage();
        currentPage = pageResult.page; // Use the obtained page

        if (!currentPage || currentPage.isClosed()) {
            throw new Error('Page is not available or closed.');
        }
        const result = await action(currentPage);
        let pageInfo = {};
        if (includePageInfo) {
            const currentUrl = currentPage.url();
            const title = await currentPage.title();
            pageInfo = { currentUrl, title };
        }
        return { success: true, data: result, ...pageInfo };
    } catch (error: any) {
        let pageInfo = {};
        // Check if currentPage was assigned and is not closed before accessing it
        if (currentPage && !currentPage.isClosed() && includePageInfo) {
            try {
                const currentUrl = currentPage.url();
                const title = await currentPage.title();
                pageInfo = { currentUrl, title };
            } catch (pageInfoError) {
                // Page info error, continue silently
                console.error(`Error getting page info: ${pageInfoError}`);
            }
        }
        return { success: false, error: error.message || String(error), ...pageInfo };
    }
}

// --- Tool Definitions ---
// Keep the tool definitions with schemas, but execution logic will move
// into the CallToolRequest handler.

const navigateTool = {
    name: 'puppeteer_navigate',
    description:
        'Navigates the browser to a specified URL. Always include the full protocol (e.g., "https://").',
    inputSchema: z.object({
        url: z
            .string()
            .url()
            .describe('The full URL to navigate to (including https:// or http://).'),
    }),
    // Output format will be handled by the CallToolRequest handler returning CallToolResponseSchema structure
    async executeLogic(input: { url: string }, pageInstance: Page) {
        await pageInstance.goto(input.url, { waitUntil: 'networkidle2', timeout: 60000 });
    },
};

const clickTool = {
    name: 'puppeteer_click',
    description:
        'Clicks an element on the page matching the CSS selector. Ensures the element is visible and interactable.',
    inputSchema: z.object({
        selector: z
            .string()
            .describe(
                'A CSS selector targeting the element to click (e.g., "button#submit", "a.product-link").'
            ),
        forceVisible: z
            .boolean()
            .optional()
            .default(false)
            .describe('Scroll element into view before attempting to click'),
        index: z
            .number()
            .optional()
            .describe('Index of the element to click if multiple match (0-based)'),
        waitAfter: z
            .number()
            .optional()
            .default(1000)
            .describe('Milliseconds to wait after clicking'),
    }),
    async executeLogic(
        input: {
            selector: string;
            forceVisible?: boolean;
            index?: number;
            waitAfter?: number;
        },
        pageInstance: Page
    ) {
        // First check if element exists at all
        const elements = await pageInstance.$$(input.selector);
        if (elements.length === 0) {
            throw new Error(`No elements found matching selector: ${input.selector}`);
        }

        // Determine which element to click
        const elementIndex = input.index !== undefined ? input.index : 0;
        if (elementIndex >= elements.length) {
            throw new Error(
                `Index ${elementIndex} out of bounds (found ${elements.length} elements)`
            );
        }

        // Method 1: Wait for selector and click
        await pageInstance.waitForSelector(input.selector, { visible: true, timeout: 10000 });

        // Method 2: If needed, force element into view
        if (input.forceVisible) {
            await pageInstance.evaluate(
                (selector, index) => {
                    const elements = document.querySelectorAll(selector);
                    if (elements[index]) {
                        elements[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                },
                input.selector,
                elementIndex
            );

            // Give time for scrolling to complete
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Method 3: Try direct element click first
        if (elements[elementIndex]) {
            try {
                // Use more reliable click method
                await elements[elementIndex].click({ delay: 100 });
            } catch (error) {
                console.error(`Error clicking element directly: ${error}`);
                // Method 4: Fall back to JS click if direct click fails
                await pageInstance.evaluate(
                    (selector, index) => {
                        const elements = document.querySelectorAll(selector);
                        if (elements[index]) {
                            (elements[index] as HTMLElement).click();
                        }
                    },
                    input.selector,
                    elementIndex
                );
            }
        }

        // Wait after clicking
        await new Promise((resolve) => setTimeout(resolve, input.waitAfter || 1000));
    },
};

const typeTool = {
    name: 'puppeteer_type',
    description:
        'Types text into an input field matching the CSS selector. Clears the field before typing by default.',
    inputSchema: z.object({
        selector: z
            .string()
            .describe(
                'A CSS selector targeting the input field (e.g., "input[name=\'username\']", "#search-box").'
            ),
        text: z.string().describe('The text to type into the field.'),
        clearFirst: z
            .boolean()
            .optional()
            .default(true)
            .describe('Whether to clear the field before typing.'),
        delay: z
            .number()
            .optional()
            .default(50)
            .describe('Delay in milliseconds between keystrokes for more human-like typing.'),
    }),
    async executeLogic(
        input: { selector: string; text: string; clearFirst?: boolean; delay?: number },
        pageInstance: Page
    ) {
        await pageInstance.waitForSelector(input.selector, { visible: true, timeout: 30000 });
        if (input.clearFirst) {
            await pageInstance.focus(input.selector);
            await pageInstance.keyboard.down('Control');
            await pageInstance.keyboard.press('A');
            await pageInstance.keyboard.up('Control');
            await pageInstance.keyboard.press('Backspace');
        }
        await pageInstance.type(input.selector, input.text, { delay: input.delay });
    },
};

const getContentTool = {
    name: 'puppeteer_get_content',
    description:
        'Retrieves content from the current page. Can get full HTML, text content, or simplified structure of the whole page or a specific element.',
    inputSchema: z.object({
        selector: z
            .string()
            .optional()
            .describe('Optional CSS selector to get content from a specific element or area.'),
        format: z
            .enum(['text', 'html', 'simplified_dom'])
            .default('simplified_dom')
            .describe(
                'The format of the content to retrieve. "text" gets only text nodes, "html" gets raw innerHTML, "simplified_dom" attempts to provide a cleaner structure for LLM processing.'
            ),
        maxChars: z
            .number()
            .optional()
            .default(12000)
            .describe('Maximum characters to return (default ~8000 tokens).'),
        prioritizeContent: z
            .boolean()
            .optional()
            .default(true)
            .describe('Intelligently prioritize main content when truncating.'),
    }),
    async executeLogic(
        input: {
            selector?: string;
            format?: 'text' | 'html' | 'simplified_dom';
            maxChars?: number;
            prioritizeContent?: boolean;
        },
        pageInstance: Page
    ): Promise<string> {
        const format = input.format || 'simplified_dom';
        const maxChars = input.maxChars || 12000; // ~8000 tokens
        const prioritizeContent = input.prioritizeContent !== false;

        let content: string | null = null;
        const targetSelector = input.selector || 'body';

        try {
            await pageInstance.waitForSelector(targetSelector, { timeout: 10000 });
        } catch {
            // Target selector not found quickly, proceeding anyway
        }

        if (format === 'text') {
            content = await pageInstance.$eval(
                targetSelector,
                (el: Element) => (el as HTMLElement).innerText
            );
        } else if (format === 'html') {
            content = await pageInstance.$eval(targetSelector, (el: Element) => el.innerHTML);
        } else {
            // simplified_dom
            content = await pageInstance.evaluate(
                (selector: string, shouldPrioritize: boolean) => {
                    const element = document.querySelector(selector);
                    if (!element) return 'Element not found.';

                    // Get the main content area if prioritizing and no specific selector
                    const isFullPage = selector === 'body';
                    let mainElement = element;

                    if (shouldPrioritize && isFullPage) {
                        // Try to find main content area
                        const contentSelectors = [
                            'main',
                            'article',
                            '[role="main"]',
                            '#content',
                            '.content',
                            '#main',
                            '.main',
                        ];

                        for (const contentSelector of contentSelectors) {
                            const potentialMain = document.querySelector(contentSelector);
                            if (
                                potentialMain &&
                                potentialMain.textContent &&
                                potentialMain.textContent.length > 200
                            ) {
                                mainElement = potentialMain;
                                break;
                            }
                        }
                    }

                    // Track element importance for smarter truncation
                    const importanceMap = new Map();
                    let interactionCounter = 0; // Counter for interaction IDs

                    function getElementImportance(el: Element) {
                        // Higher is more important
                        if (!el || !el.tagName) return 0;
                        const tag = el.tagName.toLowerCase();

                        // Prioritize headings and key content elements
                        if (tag === 'h1') return 10;
                        if (tag === 'h2') return 9;
                        if (tag === 'h3') return 8;
                        if (tag === 'title') return 10;
                        if (
                            tag === 'li' &&
                            el.parentElement &&
                            ['ol', 'ul'].includes(el.parentElement.tagName.toLowerCase())
                        )
                            return 7;
                        if (tag === 'td' && el.textContent && el.textContent.length < 100) return 6;
                        if (tag === 'p' && el.textContent && el.textContent.length > 100) return 7;
                        if (tag === 'a' && (el as HTMLAnchorElement).href) return 5;
                        if (tag === 'button') return 4;
                        if (tag === 'input') return 4;
                        if (tag === 'label') return 4;

                        // Deprioritize less important elements
                        if (['nav', 'footer', 'aside', 'header'].includes(tag)) return 2;
                        if (tag === 'div') return 3;
                        if (tag === 'span') return 2;

                        return 1;
                    }

                    function simplifyNode(node: Node, depth = 0) {
                        if (!node) return '';
                        if (node.nodeType === Node.TEXT_NODE) {
                            const text = (node.textContent || '').trim();
                            return text ? text : '';
                        }

                        if (node.nodeType !== Node.ELEMENT_NODE) return '';

                        const element = node as Element;
                        const tagName = element.tagName.toLowerCase();

                        // Skip non-content elements
                        if (
                            [
                                'script',
                                'style',
                                'noscript',
                                'svg',
                                'iframe',
                                'meta',
                                'link',
                                'head',
                            ].includes(tagName)
                        ) {
                            return '';
                        }

                        // Check for hidden elements
                        const style = window.getComputedStyle(element);
                        if (
                            style.display === 'none' ||
                            style.visibility === 'hidden' ||
                            style.opacity === '0'
                        ) {
                            return '';
                        }

                        // Check element importance for later prioritization
                        const importance = getElementImportance(element);
                        const isInteractable = [
                            'a',
                            'button',
                            'input',
                            'select',
                            'textarea',
                        ].includes(tagName);

                        // Gather attributes that add meaning
                        let attrs = '';
                        const keptAttributes = [
                            'id',
                            'name',
                            'class',
                            'role',
                            'aria-label',
                            'placeholder',
                            'value',
                            'type',
                            'href',
                        ];
                        keptAttributes.forEach((attrName) => {
                            const attrValue = element.getAttribute(attrName);
                            if (attrValue) {
                                // Special handling for class to avoid excessive length
                                if (attrName === 'class') {
                                    const classes = attrValue
                                        .split(' ')
                                        .filter((c) => c.length > 0 && c.length < 30)
                                        .slice(0, 5)
                                        .join(' '); // Keep first 5 short classes
                                    if (classes) attrs += ` class="${classes}"`;
                                } else if (attrName === 'href') {
                                    // Only include non-fragment/JS links
                                    if (
                                        !attrValue.startsWith('#') &&
                                        !attrValue.startsWith('javascript:')
                                    ) {
                                        attrs += ` href="${attrValue}"`;
                                    }
                                } else {
                                    attrs += ` ${attrName}="${attrValue}"`;
                                }
                            }
                        });

                        // Add interaction ID to interactable elements
                        if (isInteractable) {
                            interactionCounter++;
                            attrs += ` data-interaction-id="${interactionCounter}"`;
                        }

                        // Special handling for images (already partially handled)
                        if (tagName === 'img' && element.getAttribute('alt')) {
                            attrs += ` alt="${element.getAttribute('alt')}"`;
                        }

                        // Process children
                        let childrenContent = '';
                        const childNodes = Array.from(element.childNodes).filter((child) => {
                            // Filter out comments and empty text nodes
                            if (child.nodeType === Node.COMMENT_NODE) return false;
                            if (
                                child.nodeType === Node.TEXT_NODE &&
                                (!child.textContent || !child.textContent.trim())
                            )
                                return false;
                            return true;
                        });

                        for (const child of childNodes) {
                            childrenContent += simplifyNode(child, depth + 1) + ' ';
                        }

                        childrenContent = childrenContent.trim().replace(/\s+/g, ' ');

                        // Skip empty wrappers unless they have meaningful attributes
                        if (!childrenContent && !attrs && ['div', 'span', 'p'].includes(tagName)) {
                            return '';
                        }

                        // For table cells, simplify further
                        if (tagName === 'td' || tagName === 'th') {
                            if (!childrenContent) return '';
                            return `<${tagName}>${childrenContent}</${tagName}>`;
                        }

                        // For list items, add a bullet or number if at the right depth
                        if (tagName === 'li') {
                            const result = `<${tagName}>${childrenContent}</${tagName}>`;
                            importanceMap.set(result, importance);
                            return result;
                        }

                        // Special case for tables to make them more readable
                        if (tagName === 'table') {
                            return `<table>${childrenContent}</table>`;
                        }

                        // Regular element
                        const result = `<${tagName}${attrs}>${childrenContent}</${tagName}>`;
                        importanceMap.set(result, importance);
                        return result;
                    }

                    // Process the selected element
                    const simplified = simplifyNode(mainElement);
                    return simplified.replace(/\s+/g, ' ').trim();
                },
                targetSelector,
                prioritizeContent
            );
        }

        // Smart truncation when needed
        if (content && content.length > maxChars) {
            if (format === 'simplified_dom') {
                // For DOM content, attempt to truncate at a sensible boundary
                // Try to keep complete tags when possible
                const truncPoint =
                    content.lastIndexOf('</h', maxChars - 20) ||
                    content.lastIndexOf('</p>', maxChars - 20) ||
                    content.lastIndexOf('</li>', maxChars - 20) ||
                    content.lastIndexOf('. ', maxChars - 20);

                if (truncPoint > maxChars * 0.75) {
                    // Only if we found a good breakpoint
                    content =
                        content.substring(0, truncPoint + 1) +
                        `... [truncated at ${truncPoint + 1} chars, original length: ${content.length}]`;
                } else {
                    // Fall back to standard truncation
                    content =
                        content.substring(0, maxChars) +
                        `... [truncated, original length: ${content.length}]`;
                }
            } else {
                // For regular text, try to truncate at sentence boundaries
                const truncPoint = content.lastIndexOf('. ', maxChars - 20);
                if (truncPoint > maxChars * 0.75) {
                    content =
                        content.substring(0, truncPoint + 1) +
                        `... [truncated, original length: ${content.length}]`;
                } else {
                    content =
                        content.substring(0, maxChars) +
                        `... [truncated, original length: ${content.length}]`;
                }
            }
        }

        return content ?? '';
    },
};

const scrollTool = {
    name: 'puppeteer_scroll',
    description: 'Scrolls the page window vertically.',
    inputSchema: z.object({
        direction: z
            .enum(['up', 'down', 'top', 'bottom'])
            .describe(
                'Direction to scroll: "up" (one screen), "down" (one screen), "top" (to the top), "bottom" (to the bottom).'
            ),
    }),
    async executeLogic(
        input: { direction: 'up' | 'down' | 'top' | 'bottom' },
        pageInstance: Page
    ): Promise<{ scrollY: number }> {
        // Returns scrollY
        await pageInstance.evaluate((direction: 'up' | 'down' | 'top' | 'bottom') => {
            if (direction === 'down') window.scrollBy(0, window.innerHeight * 0.8);
            else if (direction === 'up') window.scrollBy(0, -window.innerHeight * 0.8);
            else if (direction === 'top') window.scrollTo(0, 0);
            else if (direction === 'bottom') window.scrollTo(0, document.body.scrollHeight);
        }, input.direction);

        // Add a longer wait after scrolling (500ms -> 1500ms) to allow content to load
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Let the page become idle after scrolling
        try {
            await pageInstance.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {
                // Ignore timeout, just wait the fixed time
            });
        } catch (error) {
            // Ignore any errors from waitForNetworkIdle
            console.error(`Error waiting for network idle: ${error}`);
        }

        const scrollY = await pageInstance.evaluate(() => window.scrollY);
        return { scrollY }; // Return specific data
    },
};

const waitForSelectorTool = {
    name: 'puppeteer_wait_for_selector',
    description:
        'Waits for an element matching the CSS selector to appear in the DOM. Useful after clicks or navigations that dynamically load content.',
    inputSchema: z.object({
        selector: z.string().describe('CSS selector for the element to wait for.'),
        timeout: z
            .number()
            .optional()
            .default(15000)
            .describe('Maximum time in milliseconds to wait.'),
        visible: z
            .boolean()
            .optional()
            .default(false)
            .describe('Wait for the element to be visible (not just in DOM).'),
    }),
    async executeLogic(
        input: { selector: string; timeout?: number; visible?: boolean },
        pageInstance: Page
    ): Promise<{ found: boolean }> {
        // Returns found status
        try {
            await pageInstance.waitForSelector(input.selector, {
                timeout: input.timeout || 15000,
                visible: input.visible || false,
            });
            return { found: true };
        } catch (waitError: any) {
            if (waitError.name === 'TimeoutError') {
                return { found: false }; // Return found: false on timeout
            }
            throw waitError; // Re-throw other errors to be caught by safeExecute
        }
    },
};

const checkForCaptchaTool = {
    name: 'puppeteer_check_for_captcha',
    description:
        'Checks the current page for common signs of CAPTCHA challenges (e.g., reCAPTCHA, hCaptcha). Does not solve them.',
    inputSchema: z.object({}), // No input needed
    async executeLogic(
        input: Record<string, never>,
        pageInstance: Page
    ): Promise<{ captchaDetected: boolean; details?: string }> {
        // Returns detection status
        const selectors = [
            'iframe[src*="recaptcha"]',
            'iframe[src*="hcaptcha"]',
            'iframe[title*="captcha"]',
            'iframe[title*="challenge"]',
            '[data-hcaptcha-widget-id]',
            '[data-sitekey]', // Common for reCAPTCHA/hCaptcha
            'div.g-recaptcha',
            'div.h-captcha',
            '#challenge-form', // Cloudflare
            'img[src*="captcha"]', // Simple image captchas
            'input[name*="captcha"]',
            '#arkoseiframe', // Arkose Labs iframe
            'iframe[data-arkose-present="true"]', // Arkose Labs detection
        ];
        const textsToFind = [
            'verify you are human',
            'completing the security check',
            'are you a robot',
            'prove you are human',
            'security challenge',
            'captcha',
        ];

        let detected = false;
        let details = '';

        // Check selectors
        for (const selector of selectors) {
            try {
                const element = await pageInstance.$(selector);
                if (element) {
                    // Basic visibility check
                    const isVisible = await element.isIntersectingViewport();
                    if (isVisible) {
                        detected = true;
                        details = `Detected visible element matching selector: ${selector}`;
                        break;
                    }
                }
            } catch (e) {
                /* Ignore errors finding selector */
            }
        }

        // If not detected by selector, check common text content
        if (!detected) {
            try {
                const bodyText = await pageInstance.$eval('body', (el) =>
                    (el as HTMLElement).innerText.toLowerCase()
                );
                for (const text of textsToFind) {
                    if (bodyText.includes(text)) {
                        detected = true;
                        details = `Detected text content matching: "${text}"`;
                        break;
                    }
                }
            } catch (e) {
                /* Ignore errors getting body text */
            }
        }

        return { captchaDetected: detected, details: detected ? details : undefined };
    },
};

const elementExistsTool = {
    name: 'puppeteer_element_exists',
    description:
        'Checks if an element matching the CSS selector exists on the page without waiting.',
    inputSchema: z.object({
        selector: z.string().describe('CSS selector to check'),
    }),
    async executeLogic(
        input: { selector: string },
        pageInstance: Page
    ): Promise<{ exists: boolean; count: number }> {
        const count = await pageInstance.$$eval(input.selector, (els) => els.length).catch(() => 0);
        return { exists: count > 0, count };
    },
};

const waitForLoadTool = {
    name: 'puppeteer_wait_for_load',
    description: 'Wait for the page to load completely with multiple waiting strategies.',
    inputSchema: z.object({
        strategy: z
            .enum(['networkidle', 'domcontentloaded', 'load', 'visual'])
            .default('networkidle')
            .describe(
                'Waiting strategy: networkidle (wait for network to be idle), domcontentloaded (DOM ready), load (onload event), visual (wait for visual stability)'
            ),
        timeout: z
            .number()
            .optional()
            .default(15000)
            .describe('Maximum time to wait in milliseconds'),
    }),
    async executeLogic(
        input: {
            strategy: 'networkidle' | 'domcontentloaded' | 'load' | 'visual';
            timeout?: number;
        },
        pageInstance: Page
    ): Promise<{ success: boolean }> {
        const timeout = input.timeout || 15000;

        try {
            if (input.strategy === 'networkidle') {
                await Promise.race([
                    pageInstance.waitForNetworkIdle({ idleTime: 500, timeout }),
                    new Promise((r) => setTimeout(r, timeout)),
                ]);
            } else if (input.strategy === 'domcontentloaded') {
                await pageInstance.waitForFunction('document.readyState !== "loading"', {
                    timeout,
                });
            } else if (input.strategy === 'load') {
                await pageInstance.waitForFunction('document.readyState === "complete"', {
                    timeout,
                });
            } else if (input.strategy === 'visual') {
                // Wait for visual stability by checking for layout shifts
                await pageInstance.evaluate((waitTime) => {
                    return new Promise((resolve) => {
                        let lastHeight = document.body.clientHeight;
                        let stable = 0;

                        const interval = setInterval(() => {
                            const currentHeight = document.body.clientHeight;
                            if (Math.abs(currentHeight - lastHeight) < 10) {
                                stable++;
                                if (stable >= 3) {
                                    // Stable for 3 consecutive checks
                                    clearInterval(interval);
                                    resolve(true);
                                }
                            } else {
                                stable = 0;
                            }
                            lastHeight = currentHeight;
                        }, 200);

                        // Safety timeout
                        setTimeout(() => {
                            clearInterval(interval);
                            resolve(false);
                        }, waitTime);
                    });
                }, timeout);
            }

            // Give a small breathing room after any wait strategy
            await new Promise((r) => setTimeout(r, 300));
            return { success: true };
        } catch {
            return { success: false };
        }
    },
};

const downloadImageTool = {
    name: 'puppeteer_download_image',
    description:
        'Downloads an image from a webpage to a local file. Can use either a direct image URL or extract an image via CSS selector.',
    inputSchema: z
        .object({
            imageUrl: z
                .string()
                .optional()
                .describe(
                    'Direct URL to the image file if known (e.g., "https://example.com/image.jpg").'
                ),
            selector: z
                .string()
                .optional()
                .describe(
                    'CSS selector to find the image element on the current page (e.g., "#main-product-image", ".hero img").'
                ),
            outputPath: z
                .string()
                .describe(
                    'Full local path where the image should be saved (e.g., "C:/Users/username/Downloads/image.jpg").'
                ),
            attribute: z
                .string()
                .optional()
                .default('src')
                .describe(
                    'Image attribute to extract the URL from if using selector (default: "src", alternatives: "data-src", "srcset", etc.).'
                ),
        })
        .refine((data) => !!data.imageUrl || !!data.selector, {
            message: 'Either imageUrl or selector must be provided',
        }),

    async executeLogic(
        input: {
            imageUrl?: string;
            selector?: string;
            outputPath: string;
            attribute?: string;
        },
        pageInstance: Page
    ): Promise<{ success: boolean; savedTo?: string; size?: number }> {
        // Ensure we have a URL - either directly provided or extracted from selector
        let imageUrl = input.imageUrl;

        if (!imageUrl && input.selector) {
            // Extract the image URL from the selector
            try {
                await pageInstance.waitForSelector(input.selector, { timeout: 5000 });

                imageUrl = await pageInstance.evaluate(
                    (selector, attribute) => {
                        const imgElement = document.querySelector(selector) as HTMLImageElement;
                        if (!imgElement) return null;

                        // Try to get the best image URL depending on the attribute
                        if (attribute === 'srcset') {
                            // Parse srcset and get the highest resolution
                            const srcset = imgElement.srcset;
                            if (srcset) {
                                const entries = srcset
                                    .split(',')
                                    .map((entry) => {
                                        const [url, width] = entry.trim().split(/\s+/);
                                        // Extract numeric value from descriptor like "1200w"
                                        const numWidth = width
                                            ? parseInt(width.replace(/\D/g, ''))
                                            : 0;
                                        return { url, width: numWidth };
                                    })
                                    .sort((a, b) => b.width - a.width); // Sort by width descending

                                if (entries.length > 0) return entries[0].url;
                            }
                        }

                        // Fall back to the specified attribute
                        return imgElement[attribute] || imgElement.getAttribute(attribute);
                    },
                    input.selector,
                    input.attribute || 'src'
                );

                if (!imageUrl) {
                    throw new Error(
                        `No image URL found in ${input.selector} with attribute ${input.attribute || 'src'}`
                    );
                }

                // If the URL is relative, convert to absolute
                if (imageUrl.startsWith('/')) {
                    const pageUrl = new URL(pageInstance.url());
                    imageUrl = `${pageUrl.origin}${imageUrl}`;
                } else if (!imageUrl.startsWith('http')) {
                    const pageUrl = pageInstance.url();
                    imageUrl = new URL(imageUrl, pageUrl).toString();
                }
            } catch (error: any) {
                throw new Error(`Failed to extract image URL: ${error.message}`);
            }
        }

        if (!imageUrl) {
            throw new Error('No image URL found or provided');
        }

        // Use Node.js built-in modules for file operations
        const fs = await import('fs');
        const path = await import('path');
        const https = await import('https');
        const http = await import('http');

        // Create any necessary directories
        const dir = path.dirname(input.outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Choose the right protocol based on URL
        const protocol = imageUrl.startsWith('https') ? https : http;

        try {
            // Download the image using a Promise
            const imageBuffer = await new Promise<Buffer>((resolve, reject) => {
                protocol
                    .get(imageUrl as string, (response) => {
                        if (response.statusCode !== 200) {
                            reject(
                                new Error(`Failed to download image: HTTP ${response.statusCode}`)
                            );
                            return;
                        }

                        const contentType = response.headers['content-type'];
                        if (!contentType || !contentType.startsWith('image/')) {
                            reject(
                                new Error(
                                    `URL does not point to an image. Content-Type: ${contentType}`
                                )
                            );
                            return;
                        }

                        const chunks: Buffer[] = [];
                        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
                        response.on('end', () => resolve(Buffer.concat(chunks)));
                        response.on('error', reject);
                    })
                    .on('error', reject);
            });

            // Save the image to disk
            fs.writeFileSync(input.outputPath, imageBuffer);

            return {
                success: true,
                savedTo: input.outputPath,
                size: imageBuffer.length,
            };
        } catch (error: any) {
            throw new Error(`Error downloading image: ${error.message}`);
        }
    },
};

const downloadFileTool = {
    name: 'puppeteer_download_file',
    description:
        'Downloads any file from a URL to the local filesystem. Works with any file type (images, PDFs, ZIP, etc).',
    inputSchema: z
        .object({
            url: z
                .string()
                .optional()
                .describe('Direct URL to the file (e.g., "https://example.com/document.pdf").'),
            selector: z
                .string()
                .optional()
                .describe(
                    'CSS selector for an element that links to or contains the file URL (e.g., "a.download-link", "button.download").'
                ),
            outputPath: z
                .string()
                .describe(
                    'Full local path where the file should be saved (e.g., "C:/Users/username/Downloads/file.pdf").'
                ),
            attribute: z
                .string()
                .optional()
                .default('href')
                .describe(
                    'Attribute to extract the URL from when using selector (default: "href" for links, can also be "src", "data-url", etc.).'
                ),
            clickToDownload: z
                .boolean()
                .optional()
                .default(false)
                .describe(
                    'Whether to click the element and wait for a download instead of extracting the URL (for dynamic downloads).'
                ),
        })
        .refine((data) => !!data.url || !!data.selector || data.clickToDownload, {
            message: 'Either url, selector, or clickToDownload must be provided',
        }),

    async executeLogic(
        input: {
            url?: string;
            selector?: string;
            outputPath: string;
            attribute?: string;
            clickToDownload?: boolean;
        },
        pageInstance: Page
    ): Promise<{ success: boolean; savedTo?: string; size?: number; fileType?: string }> {
        // For click-to-download approach
        if (input.clickToDownload && input.selector) {
            try {
                await pageInstance.waitForSelector(input.selector, { timeout: 10000 });

                // First create the directory if needed
                const fs = await import('fs');
                const path = await import('path');
                const dir = path.dirname(input.outputPath);

                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                // Set up response interception to catch downloads
                let downloadStarted = false;
                let downloadCompleted = false;
                let downloadResult: { path: string; size: number; type: string } | null = null;

                // Set up the CDP session before creating the promise
                const client = await pageInstance.target().createCDPSession();
                await client.send('Fetch.enable', {
                    patterns: [{ urlPattern: '*' }],
                });

                // Set up the event handler
                client.on('Fetch.requestPaused', async (event) => {
                    const response = await client
                        .send('Fetch.getResponseBody', { requestId: event.requestId })
                        .catch(() => null);

                    // If we can get response body, check if it might be a file
                    if (response) {
                        const headers = event.responseHeaders || [];
                        const contentTypeHeader = headers.find(
                            (h) => h.name.toLowerCase() === 'content-disposition'
                        );
                        const contentType = headers.find(
                            (h) => h.name.toLowerCase() === 'content-type'
                        );

                        // If this looks like a file download
                        if (
                            contentTypeHeader ||
                            (contentType &&
                                !contentType.value.includes('text/html') &&
                                !contentType.value.includes('application/json'))
                        ) {
                            downloadStarted = true;
                            let data: Buffer;

                            // Decode based on response format
                            if (response.base64Encoded) {
                                data = Buffer.from(response.body, 'base64');
                            } else {
                                data = Buffer.from(response.body);
                            }

                            // Save the file
                            fs.writeFileSync(input.outputPath, data);

                            await client.send('Fetch.continueRequest', {
                                requestId: event.requestId,
                            });

                            downloadCompleted = true;
                            downloadResult = {
                                path: input.outputPath,
                                size: data.length,
                                type: contentType ? contentType.value : 'unknown',
                            };
                            return;
                        }
                    }

                    // Continue with the request if we didn't capture it as a file
                    await client.send('Fetch.continueRequest', { requestId: event.requestId });
                });

                // Now create a non-async Promise
                const downloadPromise = new Promise<{ path: string; size: number; type: string }>(
                    (resolve, reject) => {
                        // Check frequently if download completed
                        const checkInterval = setInterval(() => {
                            if (downloadCompleted && downloadResult) {
                                clearInterval(checkInterval);
                                clearTimeout(timeoutId);
                                resolve(downloadResult);
                            }
                        }, 500);

                        // Set a timeout to reject if no download starts
                        const timeoutId = setTimeout(() => {
                            clearInterval(checkInterval);
                            if (!downloadStarted) {
                                client.detach();
                                reject(new Error('Download did not start within timeout period'));
                            }
                        }, 20000);
                    }
                );

                // Click the element to trigger the download
                await pageInstance.click(input.selector);

                // Wait for the download to complete
                const result = await downloadPromise;

                return {
                    success: true,
                    savedTo: result.path,
                    size: result.size,
                    fileType: result.type,
                };
            } catch (error: any) {
                throw new Error(`Error during click-to-download: ${error.message}`);
            }
        }

        // For direct URL approach
        let fileUrl = input.url;

        // Extract URL from selector if needed
        if (!fileUrl && input.selector) {
            try {
                await pageInstance.waitForSelector(input.selector, { timeout: 5000 });

                fileUrl = await pageInstance.evaluate(
                    (selector, attribute) => {
                        const element = document.querySelector(selector);
                        if (!element) return null;

                        // Try to get the URL from the attribute
                        return (
                            element.getAttribute(attribute) || (element as any)[attribute] || null
                        );
                    },
                    input.selector,
                    input.attribute || 'href'
                );

                if (!fileUrl) {
                    throw new Error(
                        `No URL found in ${input.selector} with attribute ${input.attribute || 'href'}`
                    );
                }

                // If the URL is relative, convert to absolute
                if (fileUrl.startsWith('/')) {
                    const pageUrl = new URL(pageInstance.url());
                    fileUrl = `${pageUrl.origin}${fileUrl}`;
                } else if (!fileUrl.startsWith('http')) {
                    const pageUrl = pageInstance.url();
                    fileUrl = new URL(fileUrl, pageUrl).toString();
                }
            } catch (error: any) {
                throw new Error(`Failed to extract file URL: ${error.message}`);
            }
        }

        if (!fileUrl) {
            throw new Error('No file URL found or provided');
        }

        // Use Node.js built-in modules for file operations
        const fs = await import('fs');
        const path = await import('path');
        const https = await import('https');
        const http = await import('http');

        // Create any necessary directories
        const dir = path.dirname(input.outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Choose the right protocol based on URL
        const protocol = fileUrl.startsWith('https') ? https : http;

        try {
            // Download the file using a Promise
            const { buffer, contentType } = await new Promise<{
                buffer: Buffer;
                contentType?: string;
            }>((resolve, reject) => {
                protocol
                    .get(fileUrl as string, (response) => {
                        if (response.statusCode !== 200) {
                            reject(
                                new Error(`Failed to download file: HTTP ${response.statusCode}`)
                            );
                            return;
                        }

                        const contentType = response.headers['content-type'];

                        const chunks: Buffer[] = [];
                        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
                        response.on('end', () =>
                            resolve({
                                buffer: Buffer.concat(chunks),
                                contentType,
                            })
                        );
                        response.on('error', reject);
                    })
                    .on('error', reject);
            });

            // Save the file to disk
            fs.writeFileSync(input.outputPath, buffer);

            return {
                success: true,
                savedTo: input.outputPath,
                size: buffer.length,
                fileType: contentType,
            };
        } catch (error: any) {
            throw new Error(`Error downloading file: ${error.message}`);
        }
    },
};

// Add the new listInteractablesTool definition
const listInteractablesTool = {
    name: 'puppeteer_list_interactables',
    description:
        'Scans the current page and returns a list of interactable elements (links, buttons, inputs, selects, textareas) along with their key attributes and text content. Useful for identifying elements to click or type into.',
    inputSchema: z.object({
        // No specific input needed, maybe options later (e.g., filter by type)
        maxResults: z
            .number()
            .optional()
            .default(50)
            .describe('Maximum number of elements to return.'),
    }),
    async executeLogic(
        input: { maxResults?: number },
        pageInstance: Page
    ): Promise<
        Array<{
            tag: string;
            text: string;
            attributes: Record<string, string | null>;
            selector: string;
        }>
    > {
        const maxResults = input.maxResults ?? 50;
        const interactableElements = await pageInstance.evaluate((limit) => {
            const results = [];
            const selectors = [
                'a[href]',
                'button',
                'input:not([type="hidden"])',
                'select',
                'textarea',
                '[role="button"]',
                '[role="link"]',
                '[role="menuitem"]',
                '[role="tab"]',
                '[role="checkbox"]',
                '[role="radio"]',
            ];

            const elements = document.querySelectorAll(selectors.join(', '));

            for (const element of Array.from(elements)) {
                if (results.length >= limit) break;

                // Basic visibility check
                const style = window.getComputedStyle(element);
                if (
                    style.display === 'none' ||
                    style.visibility === 'hidden' ||
                    style.opacity === '0' ||
                    (element as HTMLElement).offsetParent === null
                ) {
                    continue;
                }

                const tag = element.tagName.toLowerCase();
                let text = '';
                if (
                    element instanceof HTMLInputElement ||
                    element instanceof HTMLTextAreaElement ||
                    element instanceof HTMLSelectElement
                ) {
                    text = element.value || '';
                } else {
                    text = (element.textContent || '').trim();
                }

                // Add placeholder or aria-label if text is empty
                if (!text) {
                    text =
                        element.getAttribute('aria-label') ||
                        element.getAttribute('placeholder') ||
                        '';
                }

                const attributes: Record<string, string | null> = {};
                const importantAttributes = [
                    'id',
                    'name',
                    'class',
                    'href',
                    'role',
                    'aria-label',
                    'placeholder',
                    'value',
                    'type',
                    'title',
                    'data-testid',
                ]; // Add data-testid
                for (const attr of importantAttributes) {
                    attributes[attr] = element.getAttribute(attr);
                }

                // Generate a more robust CSS selector
                let selector = tag;
                if (attributes['data-testid']) {
                    selector = `${tag}[data-testid="${attributes['data-testid']}"]`;
                } else if (attributes.id) {
                    selector = `${tag}#${attributes.id.replace(/\s/g, '#')}`; // Handle potential spaces in IDs, though rare
                } else if (attributes.name) {
                    selector = `${tag}[name="${attributes.name}"]`;
                } else if (attributes['aria-label']) {
                    selector = `${tag}[aria-label="${attributes['aria-label']}"]`;
                } else if (
                    attributes.role &&
                    !['generic', 'presentation', 'none'].includes(attributes.role)
                ) {
                    selector = `${tag}[role="${attributes.role}"]`;
                } else if (text && text.length < 50) {
                    // Use text if short and unique enough (heuristic)
                    // Attempt to use text content for elements like buttons/links if other selectors fail
                    // Note: This is less reliable than attributes but better than just class
                    // Escaping text for CSS selector can be complex, keep it simple for now
                    // Consider XPath for more complex text matching if needed later
                    if (tag === 'button' || tag === 'a' || tag === 'span') {
                        // Basic attempt, might need refinement for quotes/special chars
                        // selector = `${tag}:contains("${text.replace(/"/g, '\\"')}")`; // This is jQuery syntax, not standard CSS
                        // Standard CSS has no direct text contains, skip for now or use XPath later
                    }
                } else if (attributes.class) {
                    // Use more stable-looking classes if possible (avoid dynamic ones)
                    const stableClass = (attributes.class || '')
                        .split(' ')
                        .find((c) => c && !/\d/.test(c) && c.length > 3); // Heuristic: no digits, length > 3
                    if (stableClass) selector = `${tag}.${stableClass}`;
                    else {
                        // Fallback to first class if no stable one found
                        const firstClass = (attributes.class || '').split(' ')[0];
                        if (firstClass) selector = `${tag}.${firstClass}`;
                    }
                }
                // TODO: Consider adding XPath generation as a fallback

                results.push({
                    tag,
                    text: text.substring(0, 100), // Limit text length
                    attributes,
                    selector, // Add the generated selector
                });
            }
            return results;
        }, maxResults);

        return interactableElements;
    },
};

// Store tools in a map for easy lookup
const availableTools: Record<
    string,
    {
        name: string;
        description: string;
        inputSchema: ZodSchema<any>;
        executeLogic: (input: any, page: Page) => Promise<any>;
    }
> = {
    [navigateTool.name]: navigateTool,
    [clickTool.name]: clickTool,
    [typeTool.name]: typeTool,
    [getContentTool.name]: getContentTool,
    [scrollTool.name]: scrollTool,
    [waitForSelectorTool.name]: waitForSelectorTool,
    [checkForCaptchaTool.name]: checkForCaptchaTool,
    [elementExistsTool.name]: elementExistsTool,
    [waitForLoadTool.name]: waitForLoadTool,
    [downloadImageTool.name]: downloadImageTool,
    [downloadFileTool.name]: downloadFileTool,
    [listInteractablesTool.name]: listInteractablesTool,
};

// --- Server Initialization (using SDK structure) ---
const server = new Server(
    { name: 'custom-puppeteer-server', version: '1.0.0' }, // Server info
    { capabilities: { tools: {} } } // Declare tool capability
);

// Handle ListTools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
    const toolList = Object.values(availableTools).map((tool) => {
        // Basic conversion of Zod schema to JSON Schema format
        const zodToJsonSchema = (schema: ZodSchema<any>) => {
            // Very basic conversion for primitive types
            const schemaDescription: Record<string, any> = {
                type: 'object',
                properties: {},
                required: [],
            };

            // This is a simplified approach - for complex schemas you'd need a full converter
            if (schema instanceof z.ZodObject) {
                const shape = (schema as any)._def.shape();
                for (const [key, value] of Object.entries(shape)) {
                    // Cast value to any to access _def
                    const zodValue = value as any;

                    schemaDescription.properties[key] = {
                        type:
                            zodValue._def.typeName === 'ZodString'
                                ? 'string'
                                : zodValue._def.typeName === 'ZodNumber'
                                  ? 'number'
                                  : zodValue._def.typeName === 'ZodBoolean'
                                    ? 'boolean'
                                    : zodValue._def.typeName === 'ZodEnum'
                                      ? getEnumType(zodValue) // Handle enums
                                      : 'object', // Use "object" instead of "any"
                    };

                    // Access description and isOptional safely with type assertion
                    if (zodValue.description) {
                        schemaDescription.properties[key].description = zodValue.description;
                    }

                    // Check if this field is required using type assertion
                    if (typeof zodValue.isOptional === 'function' && !zodValue.isOptional()) {
                        schemaDescription.required.push(key);
                    }
                }
            }

            return schemaDescription;
        };

        return {
            name: tool.name,
            description: tool.description,
            // Use our simple converter instead of openapi
            inputSchema: tool.inputSchema ? zodToJsonSchema(tool.inputSchema) : undefined,
        };
    });

    return { tools: toolList };
});

// Handle CallTool request
// Define the expected return type explicitly
server.setRequestHandler(
    CallToolRequestSchema,
    async (request): Promise<z.infer<typeof CallToolResultSchema>> => {
        const toolName = request.params.name;
        const rawArgs = request.params.arguments ?? {};

        const tool = availableTools[toolName];

        if (!tool) {
            return {
                content: [{ type: 'text', text: `Error: Unknown tool '${toolName}'` }],
                isError: true,
            };
        }

        try {
            // Validate input arguments using the tool's Zod schema
            const validatedArgs = tool.inputSchema.parse(rawArgs);

            // Use safeExecute to wrap the tool's logic function
            const result = await safeExecute(
                async (pageInstance) => {
                    // Pass validated args and the page instance to the specific tool logic
                    return tool.executeLogic(validatedArgs, pageInstance);
                },
                toolName !== scrollTool.name &&
                    toolName !== waitForSelectorTool.name &&
                    toolName !== checkForCaptchaTool.name
            );

            // Format the result according to CallToolResultSchema (not ResponseSchema)
            if (result.success) {
                const responseText =
                    typeof result.data === 'object'
                        ? JSON.stringify(result.data, null, 2)
                        : String(result.data ?? '');

                const pageInfoText =
                    result.currentUrl || result.title
                        ? `\nCurrent URL: ${result.currentUrl}\nPage Title: ${result.title}`
                        : '';

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Tool '${toolName}' executed successfully.\nResult:\n${responseText}${pageInfoText}`,
                        },
                    ],
                    isError: false,
                };
            } else {
                const pageInfoText =
                    result.currentUrl || result.title
                        ? `\nLast known URL: ${result.currentUrl}\nLast known Title: ${result.title}`
                        : '';
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error executing tool '${toolName}': ${result.error}${pageInfoText}`,
                        },
                    ],
                    isError: true,
                };
            }
        } catch (error: any) {
            let errorMessage = `Error processing tool '${toolName}': `;
            if (error instanceof z.ZodError) {
                errorMessage += `Invalid input arguments: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
            } else {
                errorMessage += error.message || String(error);
            }

            // Return error response conforming to CallToolResultSchema
            return {
                content: [{ type: 'text', text: errorMessage }],
                isError: true,
            };
        }
    }
);

// --- Graceful Shutdown ---
async function cleanup() {
    if (browser) {
        try {
            await browser.close();
        } catch {
            // Ignore errors during cleanup
        } finally {
            browser = null;
            page = null;
        }
    }
}

process.on('SIGINT', async () => {
    await cleanup();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
});

// --- Start Listening (using SDK structure) ---
async function runServer() {
    const transport = new StdioServerTransport();
    // Connect server to transport AFTER setting request handlers
    await server.connect(transport);
}

runServer().catch((error: Error | any) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Server failed to start or connect: ${errorMessage}`);
    process.exit(1);
});

// Add this helper function to handle enum types
function getEnumType(enumSchema: any) {
    const values = enumSchema._def.values;
    // Check first value to determine type
    return typeof values[0] === 'string'
        ? 'string'
        : typeof values[0] === 'number'
          ? 'number'
          : 'string';
}
