import fs from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'yaml';
import chalk from 'chalk';
import { LLMProvider, getDefaultModelForProvider } from '@core/index.js';
import { getPrimaryApiKeyEnvVar } from '@core/utils/api-key-resolver.js';
import { getDextoEnvPath } from '@core/utils/path.js';
import { updateEnvFile } from '@core/utils/env.js';
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
 * Helper to build environment variable updates for API key providers
 */
async function updateEnvFileWithLLMKeys(
    envFilePath: string,
    llmProvider?: LLMProvider,
    llmApiKey?: string
): Promise<void> {
    logger.debug(`Updating .env file with dexto env variables: envFilePath ${envFilePath}`);

    // Build updates object for the specific provider
    const updates: Record<string, string> = {};
    if (llmProvider && llmApiKey) {
        const envVar = getPrimaryApiKeyEnvVar(llmProvider);
        updates[envVar] = llmApiKey;
    }

    // Use the generic env file writer
    await updateEnvFile(envFilePath, updates);

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
export async function updateProjectEnvFileWithLLMKeys(
    directory: string,
    llmProvider?: LLMProvider,
    llmApiKey?: string
): Promise<void> {
    const envFilePath = path.join(directory, '.env');
    await updateEnvFileWithLLMKeys(envFilePath, llmProvider, llmApiKey);
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
export async function updateDetectedEnvFileWithLLMKeys(
    startPath: string,
    llmProvider?: LLMProvider,
    llmApiKey?: string
): Promise<void> {
    const envFilePath = getDextoEnvPath(startPath);
    await updateEnvFileWithLLMKeys(envFilePath, llmProvider, llmApiKey);
}
