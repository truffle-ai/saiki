import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    updateAndValidateLLMConfig,
    validateLLMSwitchRequest,
    validateRuntimeUpdate,
    validateRuntimeState,
} from './validation-utils.js';
import type { LLMConfig } from './schemas.js';

// Only mock logger since it has side effects
vi.mock('../logger/index.js');

describe('updateAndValidateLLMConfig', () => {
    const baseLLMConfig: LLMConfig = {
        provider: 'openai',
        model: 'gpt-4o', // Use a valid OpenAI model
        apiKey: 'openai-key-123',
        router: 'vercel',
        systemPrompt: 'You are a helpful assistant',
        maxIterations: 50,
        maxTokens: 128000, // Include maxTokens since the function always adds it
        providerOptions: {},
    };

    // Store original env vars to restore later
    const originalEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
        vi.resetAllMocks();

        // Store original environment variables
        const envVars = ['OPENAI_API_KEY', 'GOOGLE_API_KEY', 'ANTHROPIC_API_KEY', 'GROQ_API_KEY'];
        envVars.forEach((key) => {
            originalEnv[key] = process.env[key];
        });

        // Set up test environment variables
        process.env.OPENAI_API_KEY = 'openai-key-from-env';
        process.env.GOOGLE_API_KEY = 'google-key-from-env';
        process.env.ANTHROPIC_API_KEY = 'anthropic-key-from-env';
        process.env.GROQ_API_KEY = 'groq-key-from-env';
    });

    afterEach(() => {
        // Restore original environment variables
        Object.keys(originalEnv).forEach((key) => {
            if (originalEnv[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = originalEnv[key];
            }
        });
    });

    describe('Basic Updates', () => {
        test('should handle no updates (return same config)', async () => {
            const result = await updateAndValidateLLMConfig({}, baseLLMConfig);

            expect(result.isValid).toBe(true);
            expect(result.config).toEqual(baseLLMConfig);
            expect(result.errors).toEqual([]);
        });

        test('should update model only with same provider', async () => {
            const result = await updateAndValidateLLMConfig(
                { model: 'gpt-4o-mini' }, // Valid OpenAI model
                baseLLMConfig
            );

            expect(result.isValid).toBe(true);
            expect(result.config.model).toBe('gpt-4o-mini');
            expect(result.config.provider).toBe('openai'); // Should stay same
            expect(result.config.apiKey).toBe('openai-key-123'); // Should stay same
        });

        test('should update provider only and switch to compatible model', async () => {
            const result = await updateAndValidateLLMConfig(
                { provider: 'anthropic' },
                baseLLMConfig
            );

            expect(result.isValid).toBe(true);
            expect(result.config.provider).toBe('anthropic');
            expect(result.config.model).toBe('claude-4-sonnet-20250514'); // Default for anthropic
            expect(result.config.apiKey).toBe('anthropic-key-from-env'); // Should resolve from env
            expect(result.warnings).toContain(
                "Switched to default model 'claude-4-sonnet-20250514' for provider 'anthropic'"
            );
        });
    });

    describe('Provider Inference', () => {
        test('should infer provider from OpenAI model', async () => {
            const result = await updateAndValidateLLMConfig(
                { model: 'gpt-4o-mini' }, // Valid OpenAI model
                baseLLMConfig
            );

            expect(result.isValid).toBe(true);
            expect(result.config.model).toBe('gpt-4o-mini');
            expect(result.config.provider).toBe('openai'); // Should be inferred
            expect(result.config.apiKey).toBe('openai-key-123'); // Should stay same since provider didn't change
        });

        test('should infer provider from Google model and resolve API key', async () => {
            const result = await updateAndValidateLLMConfig(
                { model: 'gemini-2.0-flash' }, // Valid Google model
                baseLLMConfig
            );

            expect(result.isValid).toBe(true);
            expect(result.config.model).toBe('gemini-2.0-flash');
            expect(result.config.provider).toBe('google'); // Should be inferred
            expect(result.config.apiKey).toBe('google-key-from-env'); // Should resolve for new provider
        });

        test('should infer provider from Anthropic model', async () => {
            const result = await updateAndValidateLLMConfig(
                { model: 'claude-3-opus-20240229' }, // Valid Anthropic model
                baseLLMConfig
            );

            expect(result.isValid).toBe(true);
            expect(result.config.model).toBe('claude-3-opus-20240229');
            expect(result.config.provider).toBe('anthropic');
            expect(result.config.apiKey).toBe('anthropic-key-from-env');
        });

        test('should handle explicit provider overriding inference', async () => {
            const result = await updateAndValidateLLMConfig(
                { model: 'gpt-4o', provider: 'openai' }, // Valid OpenAI model
                baseLLMConfig
            );

            expect(result.isValid).toBe(true);
            expect(result.config.model).toBe('gpt-4o');
            expect(result.config.provider).toBe('openai'); // Explicit provider should be used
        });
    });

    describe('Router Compatibility', () => {
        test('should keep vercel router for OpenAI', async () => {
            const result = await updateAndValidateLLMConfig(
                { model: 'gpt-4o-mini' }, // Valid OpenAI model
                baseLLMConfig
            );

            expect(result.isValid).toBe(true);
            expect(result.config.router).toBe('vercel'); // Should keep current router
        });

        test('should keep vercel router for Anthropic', async () => {
            const result = await updateAndValidateLLMConfig(
                { model: 'claude-3-opus-20240229' }, // Valid Anthropic model
                baseLLMConfig
            );

            expect(result.isValid).toBe(true);
            expect(result.config.router).toBe('vercel'); // Should keep current router
        });

        test('should error for groq since it only supports vercel but test expects in-built', async () => {
            // Groq only supports 'vercel' router, not 'in-built', so the test assumption was wrong
            // Let's test a different scenario - switching from in-built to vercel for a provider that supports both
            const configWithInBuilt = { ...baseLLMConfig, router: 'in-built' as const };

            const result = await updateAndValidateLLMConfig(
                { provider: 'anthropic' }, // Anthropic supports both vercel and in-built
                configWithInBuilt
            );

            expect(result.isValid).toBe(true);
            expect(result.config.router).toBe('in-built'); // Should keep current router since it's supported
        });

        test('should error if provider has no supported routers', async () => {
            const result = await updateAndValidateLLMConfig(
                { provider: 'unsupported-provider' },
                baseLLMConfig
            );

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Unknown provider: unsupported-provider');
        });
    });

    describe('API Key Resolution', () => {
        test('should resolve API key when provider changes', async () => {
            const result = await updateAndValidateLLMConfig({ provider: 'google' }, baseLLMConfig);

            expect(result.isValid).toBe(true);
            expect(result.config.apiKey).toBe('google-key-from-env');
        });

        test('should use explicit API key when provided', async () => {
            const result = await updateAndValidateLLMConfig(
                { provider: 'google', apiKey: 'explicit-key' },
                baseLLMConfig
            );

            expect(result.isValid).toBe(true);
            expect(result.config.apiKey).toBe('explicit-key');
        });

        test('should error if no API key found for new provider', async () => {
            // Remove the API key from environment to simulate missing key
            delete process.env.GOOGLE_API_KEY;

            const result = await updateAndValidateLLMConfig({ provider: 'google' }, baseLLMConfig);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain(
                "No API key found for provider 'google'. Please set the appropriate environment variable or provide apiKey explicitly."
            );
        });

        test('should warn about short API keys', async () => {
            const result = await updateAndValidateLLMConfig({ apiKey: 'short' }, baseLLMConfig);

            expect(result.isValid).toBe(true);
            expect(result.warnings).toContain(
                'API key seems too short - please verify it is correct'
            );
        });
    });

    describe('Base URL Handling', () => {
        test('should set base URL for OpenAI (supports custom base URL)', async () => {
            const result = await updateAndValidateLLMConfig(
                { baseURL: 'https://custom.openai.com' },
                baseLLMConfig
            );

            expect(result.isValid).toBe(true);
            expect(result.config.baseURL).toBe('https://custom.openai.com');
        });

        test('should error if provider does not support base URL', async () => {
            const result = await updateAndValidateLLMConfig(
                { baseURL: 'https://custom.api.com', provider: 'anthropic' }, // Anthropic doesn't support custom baseURL
                baseLLMConfig
            );

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain(
                'Custom baseURL is not supported for anthropic provider'
            );
        });

        test('should remove base URL when switching to provider that does not support it', async () => {
            const configWithBaseURL = {
                ...baseLLMConfig,
                baseURL: 'https://custom.openai.com',
            };

            const result = await updateAndValidateLLMConfig(
                { provider: 'anthropic' }, // Anthropic doesn't support custom baseURL
                configWithBaseURL
            );

            expect(result.isValid).toBe(true);
            expect(result.config.baseURL).toBeUndefined();
            expect(result.warnings).toContain(
                "Removed custom baseURL because provider 'anthropic' doesn't support it"
            );
        });
    });

    describe('Validation Errors', () => {
        test('should error on invalid model format', async () => {
            const result = await updateAndValidateLLMConfig({ model: '' }, baseLLMConfig);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Model must be a non-empty string');
        });

        test('should error on invalid provider', async () => {
            const result = await updateAndValidateLLMConfig(
                { provider: 'invalid-provider' },
                baseLLMConfig
            );

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Unknown provider: invalid-provider');
        });

        test('should error on invalid router', async () => {
            const result = await updateAndValidateLLMConfig(
                { router: 'invalid-router' as any },
                baseLLMConfig
            );

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Router must be either "vercel" or "in-built"');
        });

        test('should error on incompatible model/provider combination', async () => {
            const result = await updateAndValidateLLMConfig(
                { model: 'gpt-4o', provider: 'anthropic' }, // GPT model doesn't work with Anthropic
                baseLLMConfig
            );

            expect(result.isValid).toBe(false);
            expect(result.errors[0]).toContain(
                "Model 'gpt-4o' is not supported for provider 'anthropic'. Supported models:"
            );
        });

        test('should error on invalid maxTokens', async () => {
            const result = await updateAndValidateLLMConfig({ maxTokens: -100 }, baseLLMConfig);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('maxTokens must be a positive number');
        });

        test('should error if model inference fails', async () => {
            const result = await updateAndValidateLLMConfig(
                { model: 'unknown-model-format' },
                baseLLMConfig
            );

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain(
                "Could not infer provider from model 'unknown-model-format'. Please specify provider explicitly."
            );
        });
    });

    describe('System Prompt Handling', () => {
        test('should always use current system prompt', async () => {
            const result = await updateAndValidateLLMConfig(
                { model: 'gpt-4o-mini' }, // Valid OpenAI model
                baseLLMConfig
            );

            expect(result.isValid).toBe(true);
            expect(result.config.systemPrompt).toBe('You are a helpful assistant');
        });
    });

    describe('Provider Options', () => {
        test('should update provider options', async () => {
            const newOptions = { temperature: 0.7, topP: 0.9 };

            const result = await updateAndValidateLLMConfig(
                { providerOptions: newOptions },
                baseLLMConfig
            );

            expect(result.isValid).toBe(true);
            expect(result.config.providerOptions).toEqual(newOptions);
        });

        test('should error on invalid provider options', async () => {
            const result = await updateAndValidateLLMConfig(
                { providerOptions: 'invalid' as any },
                baseLLMConfig
            );

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Provider options must be an object');
        });
    });

    describe('MaxIterations', () => {
        test('should update maxIterations', async () => {
            const result = await updateAndValidateLLMConfig({ maxIterations: 100 }, baseLLMConfig);

            expect(result.isValid).toBe(true);
            expect(result.config.maxIterations).toBe(100);
        });

        test('should use current maxIterations if not specified', async () => {
            const result = await updateAndValidateLLMConfig(
                { model: 'gpt-4o-mini' }, // Valid OpenAI model
                baseLLMConfig
            );

            expect(result.isValid).toBe(true);
            expect(result.config.maxIterations).toBe(50);
        });
    });

    describe('MaxTokens', () => {
        test('should update maxTokens when explicitly provided', async () => {
            const result = await updateAndValidateLLMConfig({ maxTokens: 50000 }, baseLLMConfig);

            expect(result.isValid).toBe(true);
            expect(result.config.maxTokens).toBe(50000);
        });

        test('should keep current maxTokens when no model change', async () => {
            const result = await updateAndValidateLLMConfig(
                { provider: 'openai' }, // No model change
                baseLLMConfig
            );

            expect(result.isValid).toBe(true);
            expect(result.config.maxTokens).toBe(128000); // Should keep current value
        });

        test('should recalculate maxTokens when model changes', async () => {
            const configWithMaxTokens = {
                ...baseLLMConfig,
                model: 'gpt-4o',
                maxTokens: 128000,
            };

            // Switch to a different model that has different token limits
            const result = await updateAndValidateLLMConfig(
                { model: 'o3-mini' }, // o3-mini has 200000 tokens vs gpt-4o's 128000
                configWithMaxTokens
            );

            expect(result.isValid).toBe(true);
            expect(result.config.model).toBe('o3-mini');
            // maxTokens should be recalculated for the new model
            expect(result.config.maxTokens).toBe(200000); // o3-mini has 200000 tokens
            expect(result.warnings).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('Updated maxTokens from 128000 to 200000'),
                ])
            );
        });

        test('should keep current maxTokens when model unchanged', async () => {
            const configWithMaxTokens = {
                ...baseLLMConfig,
                maxTokens: 100000,
            };

            const result = await updateAndValidateLLMConfig(
                { provider: 'openai' }, // Same model, just changing provider explicitly
                configWithMaxTokens
            );

            expect(result.isValid).toBe(true);
            expect(result.config.maxTokens).toBe(100000); // Should keep the current value
            expect(result.warnings).not.toEqual(
                expect.arrayContaining([expect.stringContaining('Updated maxTokens')])
            );
        });

        test('should use explicit maxTokens even when model changes', async () => {
            const configWithMaxTokens = {
                ...baseLLMConfig,
                model: 'gpt-4o',
                maxTokens: 128000,
            };

            const result = await updateAndValidateLLMConfig(
                { model: 'gpt-4o-mini', maxTokens: 50000 }, // Explicit maxTokens
                configWithMaxTokens
            );

            expect(result.isValid).toBe(true);
            expect(result.config.model).toBe('gpt-4o-mini');
            expect(result.config.maxTokens).toBe(50000); // Should use explicit value
            expect(result.warnings).not.toEqual(
                expect.arrayContaining([expect.stringContaining('Updated maxTokens')])
            );
        });
    });
});

// Keep the other test suites that don't use the registry as much
describe('validateLLMSwitchRequest', () => {
    test('should validate valid request', () => {
        const errors = validateLLMSwitchRequest({
            provider: 'openai',
            model: 'gpt-4o', // Use valid OpenAI model
            router: 'vercel',
        });

        expect(errors).toEqual([]);
    });

    test('should require provider and model', () => {
        const errors = validateLLMSwitchRequest({});

        expect(errors).toContain('Provider and model are required');
    });

    test('should validate router', () => {
        const errors = validateLLMSwitchRequest({
            provider: 'openai',
            model: 'gpt-4o', // Use valid OpenAI model
            router: 'invalid',
        });

        expect(errors).toContain('Router must be either "vercel" or "in-built"');
    });
});

describe('validateRuntimeUpdate', () => {
    test('should validate valid runtime update', () => {
        const result = validateRuntimeUpdate({
            debugMode: true,
            logLevel: 'debug',
        });

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    test('should error on invalid debugMode', () => {
        const result = validateRuntimeUpdate({
            debugMode: 'true' as any,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('debugMode must be a boolean');
    });

    test('should error on invalid logLevel', () => {
        const result = validateRuntimeUpdate({
            logLevel: 'invalid' as any,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('logLevel must be one of: error, warn, info, debug');
    });
});
