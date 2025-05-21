import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'node:fs/promises';
import fsExtra from 'fs-extra';
import path from 'node:path';
import { getPackageManager, getPackageManagerInstallCommand } from '../utils/package-mgmt.js';
import { executeWithTimeout } from '../utils/execute.js';
import { createRequire } from 'module';
import { findProjectRoot } from '../utils/path.js';

const require = createRequire(import.meta.url);

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'grok';

/**
 * Initializes an existing project with Saiki in the given directory.
 * @param directory - The directory to initialize the Saiki project in
 * @param llmProvider - The LLM provider to use
 * @param llmApiKey - The API key for the LLM provider
 * @returns The path to the created Saiki project
 */
export async function initSaiki(directory: string, llmProvider?: LLMProvider, llmApiKey?: string) {
    const spinner = p.spinner();
    spinner.start('Initializing Saiki');

    try {
        // install saiki
        const packageManager = getPackageManager();
        const installCommand = getPackageManagerInstallCommand(packageManager);
        spinner.start('Installing Saiki...');
        const label = 'latest';
        await executeWithTimeout(packageManager, [installCommand, `@truffle-ai/saiki@${label}`], {
            cwd: directory,
        });
        spinner.stop('Saiki installed successfully!');

        // create saiki directories (saiki, saiki/agents)
        spinner.start('Creating Saiki directories...');
        const result = await createSaikiDirectories(directory);

        if (!result.ok) {
            spinner.stop(chalk.inverse('Saiki already initialized '));
            return { success: false };
        }
        spinner.stop('Saiki directories created successfully!');
        const saikiDir = result.dirPath;

        // create saiki config file and example index file
        spinner.start('Creating Saiki config file and example index file...');
        const agentsDir = path.join(saikiDir, 'agents');
        await createSaikiConfigFile(agentsDir);
        await createSaikiIndexFile(saikiDir);
        spinner.stop('Saiki config file and example index file created successfully!');

        // add/update .env file
        await updateEnvFile(directory, llmProvider, llmApiKey);
    } catch (err) {
        spinner.stop(chalk.inverse('An error occurred while creating Saiki directory'));
        console.error(err);
        return { success: false };
    }
}

/**
 * Creates the saiki directories (saiki, saiki/agents) in the given directory.
 * @param directory - The directory to create the saiki directories in
 * @returns The path to the created saiki directory
 */
export async function createSaikiDirectories(
    directory: string
): Promise<{ ok: true; dirPath: string } | { ok: false }> {
    let dir = directory
        .trim()
        .split('/')
        .filter((item) => item !== '');

    const dirPath = path.join(process.cwd(), ...dir, 'saiki');
    const agentsPath = path.join(dirPath, 'agents');

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
 * Creates an example index file in the given directory. This file has example code to get you started.
 * @param directory - The directory to create the example index file in
 * @returns The path to the created example index file
 */
export async function createSaikiIndexFile(directory: string): Promise<string> {
    const indexTsLines = [
        "import 'dotenv/config';",
        "import { loadConfigFile, SaikiAgent } from '@truffle-ai/saiki';",
        '',
        '// 1. Initialize the agent from the config file',
        '// Every agent is defined by its own config file',
        "const config = await loadConfigFile('./src/saiki/agents/saiki.yml');",
        'export const agent = await SaikiAgent.create(config);',
        '',
        '// 2. Run the agent',
        'const response = await agent.run("Hello saiki! What are the files in this directory");',
        'console.log("Agent response:", response);',
        '',
        '// 3. Read Saiki documentation to understand more about using Saiki: https://github.com/truffle-ai/saiki',
    ];
    const indexTsContent = indexTsLines.join('\n');
    // Ensure the directory exists before writing the file
    await fs.writeFile(path.join(directory, 'index.ts'), indexTsContent);
    return path.join(directory, 'index.ts');
}

/**
 * Updates or creates a .env file in the given directory by:
 * 1. Finding the project root by searching for a lock file.
 * 2. Reading the existing .env file (if present), preserving unrelated lines.
 * 3. Extracting current Saiki env variables (OPENAI_API_KEY, etc.).
 * 4. Determining new values: override with provided provider/key or keep existing/defaults.
 * 5. Removing any existing '## Saiki env variables' section to avoid duplication.
 * 6. Appending a '## Saiki env variables' section with updated variables at the end.
 *
 * @param directory - The directory to start searching for the project root.
 * @param llmProvider - The LLM provider to use (openai, anthropic, google, grok).
 * @param llmApiKey - The API key for the specified LLM provider.
 */
export async function updateEnvFile(
    directory: string,
    llmProvider?: LLMProvider,
    llmApiKey?: string
) {
    const templateKeys = [
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
        'GOOGLE_GENERATIVE_AI_API_KEY',
        'GROK_API_KEY',
        'SAIKI_LOG_LEVEL',
    ];

    const projectRoot = findProjectRoot(directory);
    if (!projectRoot) {
        throw new Error('Could not find project root (no lock file found)');
    }
    const envFilePath = path.join(projectRoot, '.env');

    // Read existing .env if present
    let lines: string[] = [];
    try {
        const existingEnv = await fs.readFile(envFilePath, 'utf8');
        lines = existingEnv.split('\n');
    } catch {
        // file may not exist, start with empty
    }

    // Build a map of current values for template keys
    const currentValues: Record<string, string> = {};
    lines.forEach((line) => {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match && templateKeys.includes(match[1])) {
            currentValues[match[1]] = match[2];
        }
    });

    // Prepare new values for template keys
    const newValues: Record<string, string> = {
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
        GROK_API_KEY:
            llmProvider === 'grok' ? (llmApiKey ?? '') : (currentValues['GROK_API_KEY'] ?? ''),
        SAIKI_LOG_LEVEL: currentValues['SAIKI_LOG_LEVEL'] ?? 'info',
    };

    // Remove existing Saiki section if present and insert new section
    const sectionHeader = '## Saiki env variables';
    // Split lines into before and after the existing Saiki section
    let beforeSection: string[];
    let afterSection: string[];
    const headerIndex = lines.findIndex((line) => line.trim() === sectionHeader);
    if (headerIndex !== -1) {
        // Preserve all lines before the header
        beforeSection = lines.slice(0, headerIndex);
        // Find end of the old section (skip header and key lines)
        let sectionEnd = headerIndex + 1;
        while (sectionEnd < lines.length && lines[sectionEnd].trim() !== '') {
            sectionEnd++;
        }
        // Skip the blank line after the section if present
        if (sectionEnd < lines.length && lines[sectionEnd].trim() === '') {
            sectionEnd++;
        }
        // Preserve all lines after the old section
        afterSection = lines.slice(sectionEnd);
    } else {
        beforeSection = lines;
        afterSection = [];
    }
    // Combine the preserved lines exactly as they were
    const originalLines = [...beforeSection, ...afterSection];
    const originalMap: Record<string, string> = {};
    originalLines.forEach((line) => {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match && templateKeys.includes(match[1])) {
            originalMap[match[1]] = match[2];
        }
    });

    // Determine which key is passed and its value
    let passedKey: string | undefined;
    switch (llmProvider) {
        case 'openai':
            passedKey = 'OPENAI_API_KEY';
            break;
        case 'anthropic':
            passedKey = 'ANTHROPIC_API_KEY';
            break;
        case 'google':
            passedKey = 'GOOGLE_GENERATIVE_AI_API_KEY';
            break;
        case 'grok':
            passedKey = 'GROK_API_KEY';
            break;
        default:
            passedKey = undefined;
    }
    const passedVal = llmApiKey ?? '';

    // Combine the preserved lines exactly as they were
    const baseLines = [...beforeSection, ...afterSection];
    // Ensure exactly one blank line before the new Saiki section
    if (baseLines.length === 0 || baseLines[baseLines.length - 1].trim() !== '') {
        baseLines.push('');
    }

    // Build new Saiki section entries using newValues and avoiding duplicates
    const sectionEntries: string[] = [];
    for (const key of templateKeys) {
        // Skip keys originally present and not passed
        if (key in originalMap && key !== passedKey) {
            continue;
        }
        // Otherwise insert with updated or default value
        sectionEntries.push(`${key}=${newValues[key]}`);
    }

    // Append the new Saiki env section
    baseLines.push(sectionHeader);
    for (const entry of sectionEntries) {
        baseLines.push(entry);
    }
    // End with a single blank line
    baseLines.push('');
    // Write merged .env
    await fs.writeFile(envFilePath, baseLines.join('\n'), 'utf8');
}
