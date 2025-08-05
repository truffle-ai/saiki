import fs from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'yaml';
import chalk from 'chalk';
import { LLMProvider, getDefaultModelForProvider } from '@core/index.js';
import { getPrimaryApiKeyEnvVar } from '@core/utils/api-key-resolver.js';
import { getEnvFilePath } from '@core/utils/path.js';
import { logger } from '@core/logger/index.js';

/**
 * Gets display name for a provider
 */
export function getProviderDisplayName(provider: LLMProvider): string {
    switch (provider) {
        case 'google':
            return 'Google Gemini';
        case 'openai':
            return 'OpenAI';
        case 'anthropic':
            return 'Anthropic';
        case 'groq':
            return 'Groq';
        default:
            return provider;
    }
}

/**
 * Gets API key placeholder for a provider
 */
export function getApiKeyPlaceholder(provider: LLMProvider): string {
    switch (provider) {
        case 'google':
            return 'AIza...';
        case 'openai':
            return 'sk-...';
        case 'anthropic':
            return 'sk-ant-...';
        case 'groq':
            return 'gsk_...';
        default:
            return 'your-api-key';
    }
}

/**
 * Validates API key format for a provider
 */
export function isValidApiKeyFormat(apiKey: string, provider: LLMProvider): boolean {
    switch (provider) {
        case 'google':
            return apiKey.startsWith('AIza') && apiKey.length > 20;
        case 'openai':
            return apiKey.startsWith('sk-') && apiKey.length > 40;
        case 'anthropic':
            return apiKey.startsWith('sk-ant-') && apiKey.length > 40;
        case 'groq':
            return apiKey.startsWith('gsk_') && apiKey.length > 40;
        default:
            return apiKey.length > 10; // Basic length check
    }
}

/**
 * Gets provider-specific instructions for API key setup
 */
export function getProviderInstructions(
    provider: LLMProvider
): { title: string; content: string } | null {
    switch (provider) {
        case 'google':
            return {
                title: chalk.green('Google Gemini - Free API Key'),
                content:
                    `1. Visit: ${chalk.cyan('https://aistudio.google.com/apikey')}\n` +
                    `2. Sign in with your Google account\n` +
                    `3. Click "Create API Key"\n` +
                    `4. Copy the key\n\n` +
                    `${chalk.dim('✨ Free tier included')}`,
            };
        case 'openai':
            return {
                title: chalk.blue('OpenAI API Key'),
                content:
                    `1. Visit: ${chalk.cyan('https://platform.openai.com/api-keys')}\n` +
                    `2. Sign in to your OpenAI account\n` +
                    `3. Click "Create new secret key"\n` +
                    `4. Copy the key\n\n` +
                    `${chalk.dim('💰 Requires payment')}`,
            };
        case 'anthropic':
            return {
                title: chalk.magenta('Anthropic API Key'),
                content:
                    `1. Visit: ${chalk.cyan('https://console.anthropic.com/settings/keys')}\n` +
                    `2. Sign in to your Anthropic account\n` +
                    `3. Click "Create Key"\n` +
                    `4. Copy the key\n\n` +
                    `${chalk.dim('💰 Requires payment')}`,
            };
        case 'groq':
            return {
                title: chalk.yellow('Groq API Key'),
                content:
                    `1. Visit: ${chalk.cyan('https://console.groq.com/keys')}\n` +
                    `2. Sign in with your account\n` +
                    `3. Click "Create API Key"\n` +
                    `4. Copy the key\n\n` +
                    `${chalk.dim('🆓 Free tier included')}`,
            };
        default:
            return null;
    }
}

/**
 * Updates the LLM provider information in the dexto config file
 * Based on the LLM provider, the config file is updated with the correct API key and default model configured in registry
 */
export async function updateDextoConfigFile(
    filepath: string,
    llmProvider: LLMProvider
): Promise<void> {
    const fileContent = await fs.readFile(filepath, 'utf8');
    const doc = parseDocument(fileContent);
    doc.setIn(['llm', 'provider'], llmProvider);
    doc.setIn(['llm', 'apiKey'], '$' + getPrimaryApiKeyEnvVar(llmProvider));
    doc.setIn(['llm', 'model'], getDefaultModelForProvider(llmProvider));
    await fs.writeFile(filepath, doc.toString(), 'utf8');
}

/**
 * Core logic to update an .env file with Dexto environment variables.
 * This is the shared implementation used by both project and interactive env file updates.
 *
 * @param envFilePath - Absolute path to the .env file to update
 * @param llmProvider - The LLM provider to use (openai, anthropic, google, groq, etc.).
 * @param llmApiKey - The API key for the specified LLM provider.
 */
async function updateEnvFileCore(
    envFilePath: string,
    llmProvider?: LLMProvider,
    llmApiKey?: string
): Promise<void> {
    const dextoEnvKeys = [
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
        'GOOGLE_GENERATIVE_AI_API_KEY',
        'GROQ_API_KEY',
        'DEXTO_LOG_LEVEL',
    ];

    logger.debug(`Updating .env file with dexto env variables: envFilePath ${envFilePath}`);

    // Ensure directory exists (especially for global ~/.dexto/.env)
    await fs.mkdir(path.dirname(envFilePath), { recursive: true });

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

    // Log where the API key was written for visibility
    if (llmProvider && llmApiKey) {
        console.log(chalk.green(`✓ Wrote ${llmProvider.toUpperCase()} API key to: ${envFilePath}`));
    }
}

/**
 * Updates or creates a project .env file during init command.
 * Always saves to the current directory (for new project initialization).
 * This function is specifically for the init command where project structure
 * is being created and project detection won't work yet.
 *
 * @param directory - The directory to create .env file in (current directory for init)
 * @param llmProvider - The LLM provider to use (openai, anthropic, google, groq, etc.).
 * @param llmApiKey - The API key for the specified LLM provider.
 */
export async function updateProjectEnvFile(
    directory: string,
    llmProvider?: LLMProvider,
    llmApiKey?: string
): Promise<void> {
    const envFilePath = path.join(directory, '.env');
    await updateEnvFileCore(envFilePath, llmProvider, llmApiKey);
}

/**
 * Updates or creates an .env file using smart file selection for interactive setup.
 * Uses layered environment logic: saves to project .env if in dexto project,
 * otherwise saves to global ~/.dexto/.env for CLI-wide usage.
 *
 * @param startPath - Starting directory for project detection
 * @param llmProvider - The LLM provider to use (openai, anthropic, google, groq, etc.).
 * @param llmApiKey - The API key for the specified LLM provider.
 */
export async function updateEnvFile(
    startPath: string,
    llmProvider?: LLMProvider,
    llmApiKey?: string
): Promise<void> {
    const envFilePath = getEnvFilePath(startPath);
    await updateEnvFileCore(envFilePath, llmProvider, llmApiKey);
}
