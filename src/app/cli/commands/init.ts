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
import { getPrimaryApiKeyEnvVar } from '@core/utils/api-key-resolver.js';

const require = createRequire(import.meta.url);

/**
 * Get user preferences needed to initialize a Dexto app
 * @returns The user preferences
 */
export async function getUserInputToInitDextoApp(): Promise<{
    llmProvider: LLMProvider;
    llmApiKey: string;
    directory: string;
    createExampleFile: boolean;
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
                    message: 'Enter the directory to add the dexto files in',
                    placeholder: 'src/',
                    defaultValue: 'src/',
                }),
            createExampleFile: () =>
                p.confirm({
                    message: 'Create a dexto example file? [Recommended]',
                    initialValue: true,
                }),
        },
        {
            onCancel: () => {
                p.cancel('Dexto initialization cancelled');
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
 * Initializes an existing project with Dexto in the given directory.
 * @param directory - The directory to initialize the Dexto project in
 * @param llmProvider - The LLM provider to use
 * @param llmApiKey - The API key for the LLM provider
 * @returns The path to the created Dexto project
 */
export async function initDexto(
    directory: string,
    createExampleFile = true,
    llmProvider?: LLMProvider,
    llmApiKey?: string
): Promise<{ success: boolean }> {
    const spinner = p.spinner();

    try {
        // install dexto
        const packageManager = getPackageManager();
        const installCommand = getPackageManagerInstallCommand(packageManager);
        spinner.start('Installing Dexto...');
        const label = 'latest';
        logger.debug(
            `Installing Dexto using ${packageManager} with install command: ${installCommand} and label: ${label}`
        );
        try {
            await executeWithTimeout(
                packageManager,
                [installCommand, `@truffle-ai/dexto@${label}`],
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
                    'You are initializing dexto in a pnpm workspace root. Go to a specific package in the workspace and run "pnpm add @truffle-ai/dexto" instead.',
                    chalk.yellow('Workspace Error')
                );
                return { success: false };
            }
            throw installError; // Re-throw other errors
        }

        spinner.stop('Dexto installed successfully!');

        spinner.start('Creating Dexto files...');
        // create dexto directories (dexto, dexto/agents)
        const result = await createDextoDirectories(directory);

        if (!result.ok) {
            spinner.stop(
                chalk.inverse(
                    `Dexto already initialized in ${path.join(directory, 'dexto')}. Would you like to overwrite it?`
                )
            );
            const overwrite = await p.confirm({
                message: 'Overwrite Dexto?',
                initialValue: false,
            });
            if (!overwrite) {
                return { success: false };
            }
        }

        // create dexto config file
        logger.debug('Creating dexto config file...');
        const dextoDir = path.join(directory, 'dexto');
        const agentsDir = path.join(dextoDir, 'agents');
        const configPath = await createDextoConfigFile(agentsDir);
        logger.debug(`Dexto config file created at ${configPath}`);

        // update dexto config file based on llmProvider
        if (llmProvider) {
            logger.debug(`Updating dexto config file based on llmProvider: ${llmProvider}`);
            await updateDextoConfigFile(configPath, llmProvider);
            logger.debug(`Dexto config file updated with llmProvider: ${llmProvider}`);
        }
        // create dexto example file if requested
        if (createExampleFile) {
            logger.debug('Creating dexto example file...');
            await createDextoExampleFile(dextoDir);
            logger.debug('Dexto example file created successfully!');
        }

        // add/update .env file
        spinner.start('Updating .env file with dexto env variables...');
        logger.debug(
            `Updating .env file with dexto env variables: directory ${directory}, llmProvider: ${llmProvider}, llmApiKey: [REDACTED]`
        );
        await updateEnvFile(process.cwd(), llmProvider, llmApiKey);
        spinner.stop('Updated .env file with dexto env variables...');
        return { success: true };
    } catch (err) {
        spinner.stop(chalk.inverse('An error occurred initializing Dexto project'));
        logger.debug(`Error: ${err}`);
        return { success: false };
    }
}

/** Adds notes for users to get started with their new initialized Dexto project */
export async function postInitDexto(directory: string) {
    const nextSteps = [
        `1. Run the example: ${chalk.cyan(`node --loader ts-node/esm ${path.join(directory, 'dexto', 'dexto-example.ts')}`)}`,
        `2. Add/update your API key(s) in ${chalk.cyan('.env')}`,
        `3. Check out the agent configuration file ${chalk.cyan(path.join(directory, 'dexto', 'agents', 'agent.yml'))}`,
        `4. Try out different LLMs and MCP servers in the agent.yml file`,
        `5. Read more about Dexto: ${chalk.cyan('https://github.com/truffle-ai/dexto')}`,
    ].join('\n');
    p.note(nextSteps, chalk.yellow('Next steps:'));
}
/**
 * Creates the dexto directories (dexto, dexto/agents) in the given directory.
 * @param directory - The directory to create the dexto directories in
 * @returns The path to the created dexto directory
 */
export async function createDextoDirectories(
    directory: string
): Promise<{ ok: true; dirPath: string } | { ok: false }> {
    const dirPath = path.join(directory, 'dexto');
    const agentsPath = path.join(directory, 'dexto', 'agents');

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
 * Creates a dexto config file in the given directory. Pulls the config file from the installed Dexto package.
 * @param directory - The directory to create the config file in
 * @returns The path to the created config file
 */
export async function createDextoConfigFile(directory: string): Promise<string> {
    // Ensure the directory exists
    await fsExtra.ensureDir(directory);
    // Locate the Dexto package installation directory
    const pkgJsonPath = require.resolve('@truffle-ai/dexto/package.json');
    const pkgDir = path.dirname(pkgJsonPath);
    // Build path to the configuration template inside the package
    const templateConfigSrc = path.join(pkgDir, 'agents', 'agent.yml');
    // Path to the destination config file
    const destConfigPath = path.join(directory, 'agent.yml');
    // Copy the config file from the Dexto package
    await fsExtra.copy(templateConfigSrc, destConfigPath);
    return destConfigPath;
}

/**
 * Updates the LLM provider information in the dexto config file
 * Based on the LLM provider, the config file is updated with the correct API key and default model configured in registry
 * @param filepath - The path to the dexto config file
 * @param llmProvider - The LLM provider to use
 */
export async function updateDextoConfigFile(filepath: string, llmProvider: LLMProvider) {
    const fileContent = await fs.readFile(filepath, 'utf8');
    const doc = parseDocument(fileContent);
    doc.setIn(['llm', 'provider'], llmProvider);
    doc.setIn(['llm', 'apiKey'], '$' + getPrimaryApiKeyEnvVar(llmProvider));
    doc.setIn(['llm', 'model'], getDefaultModelForProvider(llmProvider));
    await fs.writeFile(filepath, doc.toString(), 'utf8');
}

/**
 * Creates an example file in the given directory showing how to use Dexto in code. This file has example code to get you started.
 * @param directory - The directory to create the example index file in
 * @returns The path to the created example index file
 */
export async function createDextoExampleFile(directory: string): Promise<string> {
    // Extract the base directory from the given path (e.g., "src" from "src/dexto")
    const baseDir = path.dirname(directory);

    const configPath = `./${path.join(baseDir, 'dexto/agents/agent.yml')}`;

    const indexTsLines = [
        "import 'dotenv/config';",
        "import { loadAgentConfig, DextoAgent } from '@truffle-ai/dexto';",
        '',
        '// 1. Initialize the agent from the config file',
        '// Every agent is defined by its own config file',
        `const config = await loadAgentConfig('${configPath}');`,
        'const agent = new DextoAgent(config);',
        '',
        '// 2. Start the agent (initialize async services)',
        'await agent.start();',
        '',
        '// 3. Run the agent',
        'const response = await agent.run("What are the files in this directory");',
        'console.log("Agent response:", response);',
        '',
        '// 4. Clean shutdown when done',
        'await agent.stop();',
        '',
        '// 5. Read Dexto documentation to understand more about using Dexto: https://github.com/truffle-ai/dexto',
    ];
    const indexTsContent = indexTsLines.join('\n');
    const outputPath = path.join(directory, 'dexto-example.ts');

    // Log the generated file content and paths for debugging
    logger.debug(`Creating example file with config path: ${configPath}`);
    logger.debug(`Base directory: ${baseDir}, Output path: ${outputPath}`);
    logger.debug(`Generated file content:\n${indexTsContent}`);

    // Ensure the directory exists before writing the file
    await fs.writeFile(outputPath, indexTsContent);
    return outputPath;
}

/**
 * Updates or creates a .env file by adding or updating a Dexto environment variables section.
 * The function handles these scenarios:
 *
 * 1. Finding the project root by searching for a lock file.
 * 2. Reading any existing .env file, preserving unrelated environment variables.
 * 3. Removing any existing '## Dexto env variables' section to avoid duplication.
 * 4. Adding a new '## Dexto env variables' section at the end of the file.
 *
 * For each environment variable (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.), the function handles four cases:
 * 1. If the variable already exists elsewhere in .env and was passed as parameter:
 *    Add a duplicate entry in the Dexto section with the new value.
 * 2. If the variable already exists elsewhere in .env and wasn't passed:
 *    Skip adding it to the Dexto section to avoid duplication.
 * 3. If the variable doesn't exist in .env and was passed:
 *    Add it to the Dexto section with the provided value.
 * 4. If the variable doesn't exist in .env and wasn't passed:
 *    Add it to the Dexto section with an empty string value.
 *
 * @param directory - The directory to start searching for the project root. Should be an existing directory, typically the current working directory or project root.
 * @param llmProvider - The LLM provider to use (openai, anthropic, google, groq, etc.).
 * @param llmApiKey - The API key for the specified LLM provider.
 */
export async function updateEnvFile(
    directory: string,
    llmProvider?: LLMProvider,
    llmApiKey?: string
) {
    const dextoEnvKeys = [
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
        'GOOGLE_GENERATIVE_AI_API_KEY',
        'GROQ_API_KEY',
        'DEXTO_LOG_LEVEL',
    ];

    // Find project root and build .env file path
    const projectRoot = findProjectRoot(directory);
    if (!projectRoot) {
        throw new Error('Could not find project root (no lock file found)');
    }
    const envFilePath = path.join(projectRoot, '.env');
    logger.debug(`Updating .env file with dexto env variables: envFilePath ${envFilePath}`);
    // Read existing .env if present
    let envLines: string[] = [];
    try {
        const existingEnv = await fs.readFile(envFilePath, 'utf8');
        envLines = existingEnv.split('\n');
    } catch {
        // File may not exist, start with empty array
    }

    // Extract current values for Dexto environment variables
    const currentValues: Record<string, string> = {};
    envLines.forEach((line) => {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match && match[1] && match[2] !== undefined && dextoEnvKeys.includes(match[1])) {
            currentValues[match[1]] = match[2];
        }
    });

    const passedKey = llmProvider ? getPrimaryApiKeyEnvVar(llmProvider) : undefined;

    // Prepare updated values for Dexto environment variables
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
        DEXTO_LOG_LEVEL: currentValues['DEXTO_LOG_LEVEL'] ?? 'info',
    };

    // Extract content before and after the Dexto section
    const sectionHeader = '## Dexto env variables';
    const headerIndex = envLines.findIndex((line) => line.trim() === sectionHeader);

    let contentLines: string[];

    if (headerIndex !== -1) {
        // Extract lines before the section header
        const beforeSection = envLines.slice(0, headerIndex);

        // Find the end of the section
        let sectionEnd = headerIndex + 1;
        while (sectionEnd < envLines.length && envLines[sectionEnd]?.trim() !== '') {
            sectionEnd++;
        }

        // Skip the blank line after the section if present
        if (sectionEnd < envLines.length && envLines[sectionEnd]?.trim() === '') {
            sectionEnd++;
        }

        // Extract lines after the section
        const afterSection = envLines.slice(sectionEnd);

        // Combine sections
        contentLines = [...beforeSection, ...afterSection];
    } else {
        contentLines = envLines;
    }

    // Identify env variables already present outside the Dexto section
    const existingEnvVars: Record<string, string> = {};
    contentLines.forEach((line) => {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match && match[1] && match[2] !== undefined && dextoEnvKeys.includes(match[1])) {
            existingEnvVars[match[1]] = match[2];
        }
    });

    // Ensure exactly one blank line before adding the new section
    if (contentLines.length > 0) {
        // If the last line is not blank, add a blank line
        if (contentLines[contentLines.length - 1]?.trim() !== '') {
            contentLines.push('');
        }
    } else {
        // If the file was empty, add a blank line at the start
        contentLines.push('');
    }

    // Add the section header
    contentLines.push(sectionHeader);

    // Add environment variables that should be included
    for (const key of dextoEnvKeys) {
        // Skip keys already present outside Dexto section (unless it's the passed key)
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
