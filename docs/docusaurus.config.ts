import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
    title: 'Saiki',
    tagline: 'Build AI Agents with ease',
    favicon: 'img/favicon.ico',

    // Set the production url of your site here
    url: 'https://truffle-ai.github.io',
    // Set the /<baseUrl>/ pathname under which your site is served
    // For GitHub pages deployment, it is often '/<projectName>/'
    baseUrl: '/saiki/',

    // GitHub pages deployment config.
    // If you aren't using GitHub pages, you don't need these.
    organizationName: 'truffle-ai', // Usually your GitHub org/user name.
    projectName: 'saiki', // Usually your repo name.

    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',

    // Even if you don't use internationalization, you can use this field to set
    // useful metadata like html lang. For example, if your site is Chinese, you
    // may want to replace "en" with "zh-Hans".
    i18n: {
        defaultLocale: 'en',
        locales: ['en'],
    },

    presets: [
        [
            'classic',
            {
                docs: false,
                blog: {
                    showReadingTime: true,
                    feedOptions: {
                        type: ['rss', 'atom'],
                        xslt: true,
                    },
                    editUrl: 'https://github.com/truffle-ai/saiki/tree/main/docs/',
                    onInlineTags: 'warn',
                    onInlineAuthors: 'warn',
                    onUntruncatedBlogPosts: 'warn',
                    blogTitle: 'Saiki Blog',
                    blogDescription: 'The official blog for AI agents using Saiki',
                    blogSidebarCount: 'ALL',
                },
                theme: {
                    customCss: './src/css/custom.css',
                },
            } satisfies Preset.Options,
        ],
    ],

    themes: ['@docusaurus/theme-mermaid'],

    markdown: {
        mermaid: true,
    },

    themeConfig: {
        // Replace with your project's social card
        image: 'img/saiki-social-card.jpg',
        docs: {
            sidebar: {
                hideable: true,
                autoCollapseCategories: true,
            },
        },
        colorMode: {
            defaultMode: 'light',
            disableSwitch: false,
            respectPrefersColorScheme: true,
        },
        navbar: {
            title: 'Saiki',
            logo: {
                alt: 'Saiki Logo',
                src: 'img/favicon.ico',
                width: 32,
                height: 32,
            },
            hideOnScroll: true,
            items: [
                {
                    to: '/docs/getting-started/intro',
                    position: 'left',
                    label: 'Docs',
                    activeBaseRegex: `/docs/`,
                },
                {
                    to: '/api',
                    position: 'left',
                    label: 'API Reference',
                    activeBaseRegex: `/api/`,
                },
                {
                    href: 'https://discord.gg/GFzWFAAZcm',
                    position: 'right',
                    className: 'header-discord-link',
                    'aria-label': 'Discord community',
                },
                {
                    href: 'https://github.com/truffle-ai/saiki',
                    position: 'right',
                    className: 'header-github-link',
                    'aria-label': 'GitHub repository',
                },
            ],
        },
        footer: {
            style: 'dark',
            links: [
                {
                    title: 'Documentation',
                    items: [
                        {
                            label: 'Getting Started',
                            to: '/docs/getting-started/intro',
                        },
                        {
                            label: 'Guides',
                            to: '/docs/category/guides',
                        },
                        {
                            label: 'API Reference',
                            to: '/api',
                        },
                    ],
                },
                {
                    title: 'Community',
                    items: [
                        {
                            label: 'Discord',
                            href: 'https://discord.gg/GFzWFAAZcm',
                        },
                        {
                            label: 'GitHub Discussions',
                            href: 'https://github.com/truffle-ai/saiki/discussions',
                        },
                        {
                            label: 'GitHub Issues',
                            href: 'https://github.com/truffle-ai/saiki/issues',
                        },
                        {
                            label: 'X (Twitter)',
                            href: 'https://x.com/truffleai_',
                        },
                    ],
                },
                {
                    title: 'Resources',
                    items: [
                        {
                            label: 'Blog',
                            to: '/blog',
                        },
                        {
                            label: 'Examples',
                            to: '/docs/examples-demos/email-slack',
                        },
                        {
                            label: 'Contributing',
                            to: '/docs/community/contribution-guide/overview',
                        },
                        {
                            label: 'Changelog',
                            href: 'https://github.com/truffle-ai/saiki/releases',
                        },
                    ],
                },
                {
                    title: 'Truffle AI',
                    items: [
                        {
                            label: 'Website',
                            href: 'https://trytruffle.ai',
                        },
                        {
                            label: 'GitHub',
                            href: 'https://github.com/truffle-ai',
                        },
                        {
                            label: 'Privacy Policy',
                            href: 'https://trytruffle.ai/privacy',
                        },
                        {
                            label: 'Terms of Service',
                            href: 'https://trytruffle.ai/terms',
                        },
                    ],
                },
            ],
            copyright: `Copyright © ${new Date().getFullYear()} Truffle AI. Built with ❤️ for developers.`,
        },
        prism: {
            theme: prismThemes.oneLight,
            darkTheme: prismThemes.oneDark,
            additionalLanguages: [
                'bash',
                'diff',
                'json',
                'yaml',
                'typescript',
                'javascript',
                'python',
                'go',
                'rust',
                'docker',
            ],
        },
        mermaid: {
            theme: { light: 'neutral', dark: 'dark' },
        },
        announcementBar: {
            id: 'support_us',
            content:
                '⭐️ If you like Saiki, give it a star on <a target="_blank" rel="noopener noreferrer" href="https://github.com/truffle-ai/saiki">GitHub</a> and join our <a target="_blank" rel="noopener noreferrer" href="https://discord.gg/GFzWFAAZcm">Discord</a>! ⭐️',
            backgroundColor: '#14b8a6',
            textColor: '#ffffff',
            isCloseable: true,
        },
    } satisfies Preset.ThemeConfig,

    plugins: [
        [
            '@docusaurus/plugin-content-docs',
            {
                id: 'docs',
                path: 'docs',
                routeBasePath: 'docs',
                sidebarPath: './sidebars.ts',
                editUrl: 'https://github.com/truffle-ai/saiki/tree/main/docs/',
                showLastUpdateAuthor: true,
                showLastUpdateTime: true,
                breadcrumbs: true,
            },
        ],
        [
            '@docusaurus/plugin-content-docs',
            {
                id: 'api',
                path: 'api',
                routeBasePath: 'api',
                sidebarPath: './api-sidebars.ts',
                editUrl: 'https://github.com/truffle-ai/saiki/tree/main/docs/',
                showLastUpdateAuthor: true,
                showLastUpdateTime: true,
                breadcrumbs: true,
            },
        ],
    ],

    headTags: [
        {
            tagName: 'link',
            attributes: {
                rel: 'preconnect',
                href: 'https://fonts.googleapis.com',
            },
        },
        {
            tagName: 'link',
            attributes: {
                rel: 'preconnect',
                href: 'https://fonts.gstatic.com',
                crossorigin: 'anonymous',
            },
        },
    ],

    stylesheets: [
        {
            href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600&display=swap',
            type: 'text/css',
        },
    ],
};

export default config;
