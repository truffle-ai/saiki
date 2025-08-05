import * as p from '@clack/prompts';
import chalk from 'chalk';
import { LLMProvider, logger, resolveConfigPath, DEFAULT_CONFIG_PATH } from '@core/index.js';
import { getPrimaryApiKeyEnvVar } from '@core/utils/api-key-resolver.js';
import {
    updateEnvFile,
    updateDextoConfigFile,
    getProviderDisplayName,
    getApiKeyPlaceholder,
    isValidApiKeyFormat,
    getProviderInstructions,
} from './api-key-utils.js';

interface ApiKeySetupResult {
    success: boolean;
    provider?: LLMProvider;
    skipSetup?: boolean;
}

/**
 * Interactively prompts the user to set up an API key when none are found.
 * Provides options for different providers, including information about free tiers.
 * @param requiredProvider - Optional specific provider that needs setup (skips provider selection)
 */
export async function interactiveApiKeySetup(
    requiredProvider?: LLMProvider
): Promise<ApiKeySetupResult> {
    try {
        // Welcome message
        p.intro(chalk.cyan('🔑 API Key Setup'));

        // Show targeted message based on whether we have a specific provider requirement
        if (requiredProvider) {
            const instructions = getProviderInstructions(requiredProvider);
            p.note(
                `Your configuration requires a ${getProviderDisplayName(requiredProvider)} API key.\n\n` +
                    (instructions
                        ? instructions.content
                        : 'Please get an API key for this provider.'),
                chalk.bold(`${getProviderDisplayName(requiredProvider)} API Key Required`)
            );
        } else {
            // Show general message for provider selection
            p.note(
                `Dexto needs an API key to work with AI models. You can:\n\n` +
                    `• ${chalk.green('Google Gemini')} - Free tier available (15 requests/minute)\n` +
                    `• ${chalk.blue('OpenAI')} - Most popular, requires payment\n` +
                    `• ${chalk.magenta('Anthropic')} - High quality models, requires payment\n` +
                    `• ${chalk.yellow('Groq')} - Fast inference, free tier available\n\n` +
                    `Don't have an API key? Get a free one from Google AI Studio!`,
                chalk.bold('Choose your AI provider')
            );
        }

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

        // Determine the provider - either use the required one or let user select
        let provider: LLMProvider;

        if (requiredProvider) {
            provider = requiredProvider;
        } else {
            // Interactive provider selection
            provider = (await p.select({
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

            // Show provider-specific instructions for user-selected provider
            showProviderInstructions(provider);
        }

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
