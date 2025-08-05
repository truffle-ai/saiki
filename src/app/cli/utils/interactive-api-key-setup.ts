import * as p from '@clack/prompts';
import chalk from 'chalk';
import { updateEnvFile, updateDextoConfigFile } from '../project-commands/init.js';
import { LLMProvider, logger, resolveConfigPath, DEFAULT_CONFIG_PATH } from '@core/index.js';
import { getPrimaryApiKeyEnvVar } from '@core/utils/api-key-resolver.js';

interface ApiKeySetupResult {
    success: boolean;
    provider?: LLMProvider;
    skipSetup?: boolean;
}

/**
 * Interactively prompts the user to set up an API key when none are found.
 * Provides options for different providers, including information about free tiers.
 */
export async function interactiveApiKeySetup(): Promise<ApiKeySetupResult> {
    try {
        // Welcome message
        p.intro(chalk.cyan('🔑 API Key Setup'));

        // Show informative message about API keys
        p.note(
            `Dexto needs an API key to work with AI models. You can:\n\n` +
                `• ${chalk.green('Google Gemini')} - Free tier available (15 requests/minute)\n` +
                `• ${chalk.blue('OpenAI')} - Most popular, requires payment\n` +
                `• ${chalk.magenta('Anthropic')} - High quality models, requires payment\n` +
                `• ${chalk.yellow('Groq')} - Fast inference, free tier available\n\n` +
                `Don't have an API key? Get a free one from Google AI Studio!`,
            chalk.bold('Choose your AI provider')
        );

        // First, ask what they want to do
        const action = await p.select({
            message: 'What would you like to do?',
            options: [
                {
                    value: 'setup',
                    label: 'Set up an API key now',
                    hint: 'Interactive setup (recommended)',
                },
                {
                    value: 'manual',
                    label: 'Set up manually later',
                    hint: 'Get instructions for manual setup',
                },
                {
                    value: 'exit',
                    label: 'Exit',
                    hint: 'Quit Dexto for now',
                },
            ],
        });

        if (action === 'exit') {
            p.cancel('Setup cancelled. Run dexto again when you have an API key!');
            return { success: false, skipSetup: true };
        }

        if (action === 'manual') {
            showManualSetupInstructions();
            return { success: false, skipSetup: true };
        }

        // Interactive setup flow
        const provider = (await p.select({
            message: 'Select your AI provider',
            options: [
                {
                    value: 'google',
                    label: 'Google Gemini',
                    hint: '🆓 Free tier available - get key from aistudio.google.com',
                },
                {
                    value: 'openai',
                    label: 'OpenAI',
                    hint: '💰 Requires payment - get key from platform.openai.com',
                },
                {
                    value: 'anthropic',
                    label: 'Anthropic Claude',
                    hint: '💰 Requires payment - get key from console.anthropic.com',
                },
                {
                    value: 'groq',
                    label: 'Groq',
                    hint: '🆓 Free tier available - get key from console.groq.com',
                },
            ],
        })) as LLMProvider;

        // Show provider-specific instructions
        showProviderInstructions(provider);

        const apiKey = await p.text({
            message: `Enter your ${getProviderDisplayName(provider)} API key`,
            placeholder: getApiKeyPlaceholder(provider),
            validate: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'API key is required';
                }
                if (!isValidApiKeyFormat(value.trim(), provider)) {
                    return `Invalid ${getProviderDisplayName(provider)} API key format`;
                }
                return undefined;
            },
        });

        if (p.isCancel(apiKey)) {
            p.cancel('Setup cancelled');
            return { success: false };
        }

        // Update .env file and agent configuration
        const spinner = p.spinner();
        spinner.start('Saving API key and updating configuration...');

        try {
            // Update .env file
            await updateEnvFile(process.cwd(), provider, apiKey.trim());

            // Update agent configuration if it exists and is different from the selected provider
            try {
                const configPath = resolveConfigPath(DEFAULT_CONFIG_PATH);
                await updateDextoConfigFile(configPath, provider);
                spinner.stop('Configuration updated successfully! ✨');
            } catch (configError) {
                // If config update fails, still proceed but show a warning
                spinner.stop('API key saved, but config update failed');
                logger.debug(`Failed to update agent config: ${configError}`);

                p.note(
                    `API key saved successfully, but automatic config update failed.\n\n` +
                        `To use ${getProviderDisplayName(provider)}, you may need to:\n` +
                        `1. Edit your agent.yml file\n` +
                        `2. Update the llm.provider to "${provider}"\n` +
                        `3. Update the llm.apiKey to "$${getPrimaryApiKeyEnvVar(provider)}"`,
                    chalk.yellow('Manual config update needed')
                );
            }

            p.outro(
                chalk.green('🎉 Setup complete!') +
                    '\n\n' +
                    `Your ${getProviderDisplayName(provider)} API key has been saved to .env\n` +
                    `Dexto is now configured to use ${getProviderDisplayName(provider)}.`
            );

            return { success: true, provider };
        } catch (error) {
            spinner.stop('Failed to save API key');
            logger.error(`Failed to update .env file: ${error}`);

            p.note(
                `Manual setup required:\n\n` +
                    `1. Create a .env file in your project root\n` +
                    `2. Add this line: ${getPrimaryApiKeyEnvVar(provider)}=${apiKey}\n` +
                    `3. Update your agent.yml llm.provider to "${provider}"\n` +
                    `4. Update your agent.yml llm.apiKey to "$${getPrimaryApiKeyEnvVar(provider)}"\n` +
                    `5. Run dexto again`,
                chalk.yellow('Save this API key manually')
            );

            return { success: false, provider };
        }
    } catch (error) {
        if (p.isCancel(error)) {
            p.cancel('Setup cancelled');
            return { success: false };
        }
        throw error;
    }
}

/**
 * Shows manual setup instructions to the user
 */
function showManualSetupInstructions(): void {
    const instructions = [
        `${chalk.bold('1. Get an API key:')}`,
        `   • ${chalk.green('Google Gemini (Free)')}:  https://aistudio.google.com/apikey`,
        `   • ${chalk.blue('OpenAI')}:           https://platform.openai.com/api-keys`,
        `   • ${chalk.magenta('Anthropic')}:        https://console.anthropic.com/keys`,
        `   • ${chalk.yellow('Groq (Free)')}:      https://console.groq.com/keys`,
        ``,
        `${chalk.bold('2. Create a .env file in your project:')}`,
        `   echo "GOOGLE_GENERATIVE_AI_API_KEY=your_key_here" > .env`,
        `   # OR for other providers:`,
        `   # OPENAI_API_KEY=your_key_here`,
        `   # ANTHROPIC_API_KEY=your_key_here`,
        `   # GROQ_API_KEY=your_key_here`,
        ``,
        `${chalk.bold('3. Run dexto again:')}`,
        `   npx dexto`,
        ``,
        `${chalk.dim('💡 Tip: Start with Google Gemini for a free experience!')}`,
    ].join('\n');

    p.note(instructions, chalk.bold('Manual Setup Instructions'));
}

/**
 * Shows provider-specific instructions for getting API keys
 */
function showProviderInstructions(provider: LLMProvider): void {
    const instructions = getProviderInstructions(provider);
    if (instructions) {
        p.note(instructions.content, instructions.title);
    }
}

/**
 * Gets provider-specific instructions for API key setup
 */
function getProviderInstructions(provider: LLMProvider): { title: string; content: string } | null {
    switch (provider) {
        case 'google':
            return {
                title: chalk.green('Google Gemini - Free API Key'),
                content:
                    `1. Visit: ${chalk.cyan('https://aistudio.google.com/apikey')}\n` +
                    `2. Sign in with your Google account\n` +
                    `3. Click "Create API Key"\n` +
                    `4. Copy the key (starts with "AIza...")\n\n` +
                    `${chalk.dim('✨ Free tier: 15 requests/minute, 1500 requests/day')}`,
            };
        case 'openai':
            return {
                title: chalk.blue('OpenAI API Key'),
                content:
                    `1. Visit: ${chalk.cyan('https://platform.openai.com/api-keys')}\n` +
                    `2. Sign in to your OpenAI account\n` +
                    `3. Click "Create new secret key"\n` +
                    `4. Copy the key (starts with "sk-...")\n\n` +
                    `${chalk.dim('💰 Requires payment - $5 minimum credit')}`,
            };
        case 'anthropic':
            return {
                title: chalk.magenta('Anthropic API Key'),
                content:
                    `1. Visit: ${chalk.cyan('https://console.anthropic.com/keys')}\n` +
                    `2. Sign in to your Anthropic account\n` +
                    `3. Click "Create Key"\n` +
                    `4. Copy the key (starts with "sk-ant-...")\n\n` +
                    `${chalk.dim('💰 Requires payment - $5 minimum credit')}`,
            };
        case 'groq':
            return {
                title: chalk.yellow('Groq API Key'),
                content:
                    `1. Visit: ${chalk.cyan('https://console.groq.com/keys')}\n` +
                    `2. Sign in with your account\n` +
                    `3. Click "Create API Key"\n` +
                    `4. Copy the key (starts with "gsk_...")\n\n` +
                    `${chalk.dim('🆓 Free tier: 30 requests/minute')}`,
            };
        default:
            return null;
    }
}

/**
 * Gets display name for a provider
 */
function getProviderDisplayName(provider: LLMProvider): string {
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
function getApiKeyPlaceholder(provider: LLMProvider): string {
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
function isValidApiKeyFormat(apiKey: string, provider: LLMProvider): boolean {
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
