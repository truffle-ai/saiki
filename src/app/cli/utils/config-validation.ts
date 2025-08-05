import { z } from 'zod';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { AgentConfigSchema, type AgentConfig } from '@core/agent/schemas.js';
import { loadAgentConfig } from '@core/config/loader.js';
import { applyCLIOverrides, type CLIConfigOverrides } from '../../config/cli-overrides.js';
import { interactiveApiKeySetup } from './interactive-api-key-setup.js';
import { DextoErrorCode } from '@core/schemas/errors.js';
import type { LLMProvider } from '@core/index.js';

/**
 * Validates config with interactive fixes for user experience.
 * Uses schema parsing to detect API key issues and provides targeted setup.
 * Returns raw AgentConfig that will be validated again by DextoAgent.
 */
export async function validateConfigWithInteractiveSetup(
    cliOverrides: CLIConfigOverrides,
    configPath?: string
): Promise<AgentConfig> {
    // Load raw config
    const rawConfig = await loadAgentConfig(configPath);

    // Apply CLI overrides
    const mergedConfig = applyCLIOverrides(rawConfig, cliOverrides);

    // Debug: Check environment variables before validation
    console.log('DEBUG: Environment variables:');
    console.log(`ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET'}`);
    console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`);
    console.log('DEBUG: Merged config LLM:', JSON.stringify(mergedConfig.llm, null, 2));

    // Parse with schema to detect issues
    const parseResult = AgentConfigSchema.safeParse(mergedConfig);

    if (!parseResult.success) {
        // Check for API key validation errors using raw Zod error (preserves params)
        const apiKeyError = findApiKeyError(parseResult.error, mergedConfig);

        if (apiKeyError) {
            console.log(
                chalk.yellow(`\n🔑 API key required for ${apiKeyError.provider} provider\n`)
            );

            // Run interactive setup for the specific provider that failed
            const setupResult = await interactiveApiKeySetup(apiKeyError.provider);

            if (!setupResult.success) {
                if (setupResult.skipSetup) {
                    console.log(
                        chalk.dim('\n👋 Run dexto again once you have set up your API key!')
                    );
                } else {
                    console.error(chalk.red('\n❌ API key setup required to continue.'));
                }
                process.exit(0);
            }

            // Reload environment variables and retry
            dotenv.config();
            console.log(chalk.green('\n✨ API key configured! Continuing...\n'));
            return validateConfigWithInteractiveSetup(cliOverrides, configPath);
        }

        // Other validation errors - show user-friendly message
        console.error(chalk.red('❌ Configuration Error:'));
        formatZodError(parseResult.error);
        process.exit(1);
    }

    // Return the raw config (will be parsed again by DextoAgent)
    return mergedConfig;
}

/**
 * Extract API key error details from Zod validation error
 */
function findApiKeyError(
    error: z.ZodError,
    configData: AgentConfig
): { provider: LLMProvider } | null {
    for (const issue of error.issues) {
        // Check for our custom LLM_MISSING_API_KEY error code in params
        if (
            issue.code === 'custom' &&
            hasErrorCode(issue.params, DextoErrorCode.LLM_MISSING_API_KEY)
        ) {
            // Extract provider from error params (added by our schema)
            const provider = getProviderFromParams(issue.params);
            if (provider) {
                return { provider };
            }
        }

        // Fallback: check for apiKey path errors and extract provider from config
        if (issue.path.includes('apiKey') && issue.message.includes('Missing API key')) {
            const provider = configData.llm?.provider;
            if (provider) {
                return { provider };
            }
        }
    }
    return null;
}

/**
 * Type guard to check if params contains the expected error code
 */
function hasErrorCode(params: unknown, expectedCode: DextoErrorCode): boolean {
    return (
        typeof params === 'object' &&
        params !== null &&
        'code' in params &&
        params.code === expectedCode
    );
}

/**
 * Extract provider from Zod issue params
 */
function getProviderFromParams(params: unknown): LLMProvider | null {
    if (
        typeof params === 'object' &&
        params !== null &&
        'provider' in params &&
        typeof params.provider === 'string'
    ) {
        return params.provider as LLMProvider;
    }
    return null;
}

/**
 * Format Zod validation errors in a user-friendly way
 */
function formatZodError(error: z.ZodError): void {
    for (const issue of error.issues) {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'config';
        console.error(chalk.red(`  • ${path}: ${issue.message}`));
    }
}
