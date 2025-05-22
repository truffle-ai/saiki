import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'node:fs/promises';
import fsExtra from 'fs-extra';
import path from 'node:path';
import { getPackageManager, getPackageManagerInstallCommand } from '../utils/package-mgmt.js';
import { executeWithTimeout } from '../utils/execute.js';
import { createRequire } from 'module';
import { findProjectRoot } from '../utils/path.js';
import { getDefaultModelForProvider, LLMProvider, logger } from '@core/index.js';
import { parseDocument } from 'yaml';

const require = createRequire(import.meta.url);

// Map the provider to its corresponding API key name
const providerToKeyMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_GENERATIVE_AI_API_KEY',
    groq: 'GROQ_API_KEY',
};

/**
 * Get user preferences needed to initialize a Saiki project
 * @returns The user preferences
 */
export async function getUserInputToCreateProject(): Promise<{
    llmProvider: LLMProvider;
    llmApiKey: string;
    directory: string;
    createExampleFile: any;
}> {
    const answers = await p.group(
        {
            llmProvider: () =>
                p.select({
                    message: 'Select your LLM provider',
                    options: [
                        { value: 'openai', label: 'OpenAI', hint: 'Most popular LLM provider' },
                        { value: 'anthropic', label: 'Anthropic' },
                        { value: 'google', label: 'Google' },
                        { value: 'groq', label: 'Groq' },
                    ],
                }),
            llmApiKey: async ({ results }) => {
                const llmProvider = results.llmProvider;
                const selection = await p.select({
                    message: `Enter your API key for ${llmProvider}?`,
                    options: [
                        { value: 'skip', label: 'Skip', hint: 'default' },
                        { value: 'enter', label: 'Enter', hint: 'enter it manually' },
                    ],
                    initialValue: 'skip',
                });

                if (selection === 'enter') {
                    return await p.text({
                        message: 'Enter your API key',
                        placeholder: 'sk-...',
                    });
                }
                return '';
            },
            directory: () =>
                p.text({
                    message: 'Enter the directory to add the saiki files in',
                    placeholder: 'src/',
                    defaultValue: 'src/',
                }),
            createExampleFile: () =>
                p.confirm({
                    message: 'Create a saiki example file?',
                    initialValue: true,
                }),
        },
        {
            onCancel: () => {
                p.cancel('Saiki initialization cancelled');
                process.exit(0);
            },
        }
    );

    // Type assertion to bypass the possible 'Symbol' type returned by p.group which is handled in onCancel
    return answers as {
        llmProvider: LLMProvider;
        directory: string;
        llmApiKey: string;
        createExampleFile: boolean;
    };
}

/**
 * Initializes an existing project with Saiki in the given directory.
 * @param directory - The directory to initialize the Saiki project in
 * @param llmProvider - The LLM provider to use
 * @param llmApiKey - The API key for the LLM provider
 * @returns The path to the created Saiki project
 */
export async function initSaiki(
    directory: string,
    createExampleFile = true,
    llmProvider?: LLMProvider,
    llmApiKey?: string
) {
    const spinner = p.spinner();

    try {
        // install saiki
        const packageManager = getPackageManager();
        const installCommand = getPackageManagerInstallCommand(packageManager);
        spinner.start('Installing Saiki...');
        const label = 'latest';
        logger.debug(
            `Installing Saiki using ${packageManager} with install command: ${installCommand} and label: ${label}`
        );
        try {
            await executeWithTimeout(
                packageManager,
                [installCommand, `@truffle-ai/saiki@${label}`],
                {
                    cwd: process.cwd(),
                }
            );
        } catch (installError) {
            // Handle pnpm workspace error specifically
            logger.debug(`Install error: ${installError}`);
            if (packageManager === 'pnpm' && 'ERR_PNPM_ADDING_TO_ROOT') {
                spinner.stop(chalk.red('Error: Cannot install in pnpm workspace root'));
                p.note(
                    'You are initializing saiki in a pnpm workspace root. Go to a specific package in the workspace and run "pnpm add @truffle-ai/saiki" instead.',
                    chalk.yellow('Workspace Error')
                );
                return { success: false };
            }
            throw installError; // Re-throw other errors
        }

        spinner.stop('Saiki installed successfully!');

        spinner.start('Creating Saiki files...');
        // create saiki directories (saiki, saiki/agents)
        const result = await createSaikiDirectories(directory);

        if (!result.ok) {
            spinner.stop(
                chalk.inverse(
                    `Saiki already initialized in ${path.join(directory, 'saiki')}. Would you like to overwrite it?`
                )
            );
            const overwrite = await p.confirm({
                message: 'Overwrite Saiki?',
                initialValue: false,
            });
            if (!overwrite) {
                return { success: false };
            }
        }

        // create saiki config file
        logger.debug('Creating saiki config file...');
        const saikiDir = path.join(directory, 'saiki');
        const agentsDir = path.join(saikiDir, 'agents');
        const configPath = await createSaikiConfigFile(agentsDir);
        logger.debug(`Saiki config file created at ${configPath}`);

        // update saiki config file based on llmProvider
        logger.debug(`Updating saiki config file based on llmProvider: ${llmProvider}`);
        await updateSaikiConfigFile(configPath, llmProvider);
        logger.debug(`Saiki config file updated with llmProvider: ${llmProvider}`);
        // create saiki example file if requested
        if (createExampleFile) {
            logger.debug('Creating saiki example file...');
            await createSaikiExampleFile(saikiDir);
            logger.debug('Saiki example file created successfully!');
        }

        // add/update .env file
        spinner.start('Updating .env file with saiki env variables...');
        await updateEnvFile(directory, llmProvider, llmApiKey);
        spinner.stop('Updated .env file with saiki env variables...');
    } catch (err) {
        spinner.stop(chalk.inverse('An error occurred initializing Saiki project'));
        logger.debug(`Error: ${err}`);
        return { success: false };
    }
}

/** Adds notes for users to get started with their new initialized Saiki project */
export async function postInitSaiki(directory: string) {
    const nextSteps = [
        `1. Run the example (if created): ${chalk.cyan(`node --loader ts-node/esm ${path.join(directory, 'saiki', 'saiki-example.ts')}`)}`,
        `2. Add/update your API key(s) in ${chalk.cyan('.env')}`,
        `3. Check out the agent configuration file ${chalk.cyan(path.join(directory, 'saiki', 'agents', 'saiki.yml'))}`,
        `4. Try out different LLMs and MCP servers in the saiki.yml file`,
        `5. Read more about Saiki: ${chalk.cyan('https://github.com/truffle-ai/saiki')}`,
    ].join('\n');
    p.note(nextSteps, chalk.yellow('Next steps:'));
}
/**
 * Creates the saiki directories (saiki, saiki/agents) in the given directory.
 * @param directory - The directory to create the saiki directories in
 * @returns The path to the created saiki directory
 */
export async function createSaikiDirectories(
    directory: string
): Promise<{ ok: true; dirPath: string } | { ok: false }> {
    const dirPath = path.join(directory, 'saiki');
    const agentsPath = path.join(directory, 'saiki', 'agents');

    try {
        await fs.access(dirPath);
        return { ok: false };
    } catch {
        // fsExtra.ensureDir creates directories recursively if they don't exist
        await fsExtra.ensureDir(dirPath);
        await fsExtra.ensureDir(agentsPath);
        return { ok: true, dirPath };
    }
}

/**
 * Creates a saiki config file in the given directory. Pulls the config file from the installed Saiki package.
 * @param directory - The directory to create the config file in
 * @returns The path to the created config file
 */
export async function createSaikiConfigFile(directory: string): Promise<string> {
    // Ensure the directory exists
    await fsExtra.ensureDir(directory);
    // Locate the Saiki package installation directory
    const pkgJsonPath = require.resolve('@truffle-ai/saiki/package.json');
    const pkgDir = path.dirname(pkgJsonPath);
    // Build path to the configuration template inside the package
    const templateConfigSrc = path.join(pkgDir, 'configuration', 'saiki.yml');
    // Path to the destination config file
    const destConfigPath = path.join(directory, 'saiki.yml');
    // Copy the config file from the Saiki package
    await fsExtra.copy(templateConfigSrc, destConfigPath);
    return destConfigPath;
}

/**
 * Updates the LLM provider information in the saiki config file
 * Based on the LLM provider, the config file is updated with the correct API key and default model configured in registry
 * @param filepath - The path to the saiki config file
 * @param llmProvider - The LLM provider to use
 */
export async function updateSaikiConfigFile(filepath: string, llmProvider?: LLMProvider) {
    const fileContent = await fs.readFile(filepath, 'utf8');
    const doc = parseDocument(fileContent);
    doc.setIn(['llm', 'provider'], llmProvider);
    doc.setIn(['llm', 'apiKey'], '$' + providerToKeyMap[llmProvider]);
    doc.setIn(['llm', 'model'], getDefaultModelForProvider(llmProvider));
    await fs.writeFile(filepath, doc.toString(), 'utf8');
}

/**
 * Creates an example file in the given directory showing how to use Saiki in code. This file has example code to get you started.
 * @param directory - The directory to create the example index file in
 * @returns The path to the created example index file
 */
export async function createSaikiExampleFile(directory: string): Promise<string> {
    // Extract the base directory from the given path (e.g., "src" from "src/saiki")
    const baseDir = path.dirname(directory);

    const configPath = `./${path.join(baseDir, 'saiki/agents/saiki.yml')}`;

    const indexTsLines = [
        "import 'dotenv/config';",
        "import { loadConfigFile, SaikiAgent, createSaikiAgent } from '@truffle-ai/saiki';",
        '',
        '// 1. Initialize the agent from the config file',
        '// Every agent is defined by its own config file',
        `const config = await loadConfigFile('${configPath}');`,
        'export const agent = await createSaikiAgent(config);',
        '',
        '// 2. Run the agent',
        'const response = await agent.run("Hello saiki! What are the files in this directory");',
        'console.log("Agent response:", response);',
        '',
        '// 3. Read Saiki documentation to understand more about using Saiki: https://github.com/truffle-ai/saiki',
    ];
    const indexTsContent = indexTsLines.join('\n');
    const outputPath = path.join(directory, 'saiki-example.ts');

    // Log the generated file content and paths for debugging
    logger.debug(`Creating example file with config path: ${configPath}`);
    logger.debug(`Base directory: ${baseDir}, Output path: ${outputPath}`);
    logger.debug(`Generated file content:\n${indexTsContent}`);

    // Ensure the directory exists before writing the file
    await fs.writeFile(outputPath, indexTsContent);
    return outputPath;
}

/**
 * Updates or creates a .env file by adding or updating a Saiki environment variables section.
 * The function handles these scenarios:
 *
 * 1. Finding the project root by searching for a lock file.
 * 2. Reading any existing .env file, preserving unrelated environment variables.
 * 3. Removing any existing '## Saiki env variables' section to avoid duplication.
 * 4. Adding a new '## Saiki env variables' section at the end of the file.
 *
 * For each environment variable (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.), the function handles four cases:
 * 1. If the variable already exists elsewhere in .env and was passed as parameter:
 *    Add a duplicate entry in the Saiki section with the new value.
 * 2. If the variable already exists elsewhere in .env and wasn't passed:
 *    Skip adding it to the Saiki section to avoid duplication.
 * 3. If the variable doesn't exist in .env and was passed:
 *    Add it to the Saiki section with the provided value.
 * 4. If the variable doesn't exist in .env and wasn't passed:
 *    Add it to the Saiki section with an empty string value.
 *
 * @param directory - The directory to start searching for the project root.
 * @param llmProvider - The LLM provider to use (openai, anthropic, google, groq, etc.).
 * @param llmApiKey - The API key for the specified LLM provider.
 */
export async function updateEnvFile(
    directory: string,
    llmProvider?: LLMProvider,
    llmApiKey?: string
) {
    const saikiEnvKeys = [
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
        'GOOGLE_GENERATIVE_AI_API_KEY',
        'GROQ_API_KEY',
        'SAIKI_LOG_LEVEL',
    ];

    // Find project root and build .env file path
    const projectRoot = findProjectRoot(directory);
    if (!projectRoot) {
        throw new Error('Could not find project root (no lock file found)');
    }
    const envFilePath = path.join(projectRoot, '.env');

    // Read existing .env if present
    let envLines: string[] = [];
    try {
        const existingEnv = await fs.readFile(envFilePath, 'utf8');
        envLines = existingEnv.split('\n');
    } catch {
        // File may not exist, start with empty array
    }

    // Extract current values for Saiki environment variables
    const currentValues: Record<string, string> = {};
    envLines.forEach((line) => {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match && saikiEnvKeys.includes(match[1])) {
            currentValues[match[1]] = match[2];
        }
    });

    const passedKey = llmProvider ? providerToKeyMap[llmProvider] : undefined;

    // Prepare updated values for Saiki environment variables
    const updatedValues: Record<string, string> = {
        OPENAI_API_KEY:
            llmProvider === 'openai' ? (llmApiKey ?? '') : (currentValues['OPENAI_API_KEY'] ?? ''),
        ANTHROPIC_API_KEY:
            llmProvider === 'anthropic'
                ? (llmApiKey ?? '')
                : (currentValues['ANTHROPIC_API_KEY'] ?? ''),
        GOOGLE_GENERATIVE_AI_API_KEY:
            llmProvider === 'google'
                ? (llmApiKey ?? '')
                : (currentValues['GOOGLE_GENERATIVE_AI_API_KEY'] ?? ''),
        GROQ_API_KEY:
            llmProvider === 'groq' ? (llmApiKey ?? '') : (currentValues['GROQ_API_KEY'] ?? ''),
        SAIKI_LOG_LEVEL: currentValues['SAIKI_LOG_LEVEL'] ?? 'info',
    };

    // Extract content before and after the Saiki section
    const sectionHeader = '## Saiki env variables';
    const headerIndex = envLines.findIndex((line) => line.trim() === sectionHeader);

    let contentLines: string[];

    if (headerIndex !== -1) {
        // Extract lines before the section header
        const beforeSection = envLines.slice(0, headerIndex);

        // Find the end of the section
        let sectionEnd = headerIndex + 1;
        while (sectionEnd < envLines.length && envLines[sectionEnd].trim() !== '') {
            sectionEnd++;
        }

        // Skip the blank line after the section if present
        if (sectionEnd < envLines.length && envLines[sectionEnd].trim() === '') {
            sectionEnd++;
        }

        // Extract lines after the section
        const afterSection = envLines.slice(sectionEnd);

        // Combine sections
        contentLines = [...beforeSection, ...afterSection];
    } else {
        contentLines = envLines;
    }

    // Identify env variables already present outside the Saiki section
    const existingEnvVars: Record<string, string> = {};
    contentLines.forEach((line) => {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match && saikiEnvKeys.includes(match[1])) {
            existingEnvVars[match[1]] = match[2];
        }
    });

    // Ensure exactly one blank line before adding the new section
    if (contentLines.length > 0) {
        // If the last line is not blank, add a blank line
        if (contentLines[contentLines.length - 1].trim() !== '') {
            contentLines.push('');
        }
    } else {
        // If the file was empty, add a blank line at the start
        contentLines.push('');
    }

    // Add the section header
    contentLines.push(sectionHeader);

    // Add environment variables that should be included
    for (const key of saikiEnvKeys) {
        // Skip keys already present outside Saiki section (unless it's the passed key)
        if (key in existingEnvVars && key !== passedKey) {
            continue;
        }
        contentLines.push(`${key}=${updatedValues[key]}`);
    }

    // End with a blank line
    contentLines.push('');

    // Write the updated content
    await fs.writeFile(envFilePath, contentLines.join('\n'), 'utf8');
}
