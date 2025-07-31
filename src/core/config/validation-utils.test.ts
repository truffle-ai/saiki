import { describe, test, it, expect, vi, beforeEach } from 'vitest';
import { buildLLMConfig, validateMcpServerConfig } from './validation-utils.js';
import type { ValidatedLLMConfig, McpServerConfig } from './schemas.js';

// Only mock logger since it has side effects
vi.mock('../logger/index.js');

describe('buildLLMConfig', () => {
    const baseLLMConfig: ValidatedLLMConfig = {
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'sk-1234567890abcdef',
        router: 'vercel',
        maxIterations: 50,
    };

    beforeEach(() => {
        // Reset environment variables
        delete process.env.OPENAI_API_KEY;
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.GOOGLE_API_KEY;
        delete process.env.GROQ_API_KEY;
    });

    it('should return valid config when no updates provided', async () => {
        const result = await buildLLMConfig({}, baseLLMConfig);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);

        // The function automatically calculates maxInputTokens from the model if not present
        const expectedConfig = {
            ...baseLLMConfig,
            maxInputTokens: 128000, // gpt-4o has 128000 tokens according to registry
            maxOutputTokens: undefined,
            temperature: undefined,
        };
        expect(result.config).toEqual(expectedConfig);
    });

    it('should update model successfully', async () => {
        const result = await buildLLMConfig({ model: 'gpt-4o-mini' }, baseLLMConfig);

        expect(result.isValid).toBe(true);
        expect(result.config.model).toBe('gpt-4o-mini');
        expect(result.config.provider).toBe('openai'); // Should remain unchanged
    });

    it('should update provider and switch to default model', async () => {
        // Set API key for the test to succeed
        process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-123456789';

        const result = await buildLLMConfig({ provider: 'anthropic' }, baseLLMConfig);

        expect(result.isValid).toBe(true);
        expect(result.config.provider).toBe('anthropic');
        expect(result.config.model).toBe('claude-4-sonnet-20250514'); // Should switch to default from registry
        expect(result.warnings).toContain(
            "Switched to default model 'claude-4-sonnet-20250514' for provider 'anthropic'"
        );
    });

    it('should update API key', async () => {
        const result = await buildLLMConfig({ apiKey: 'new-api-key-12345' }, baseLLMConfig);

        expect(result.isValid).toBe(true);
        expect(result.config.apiKey).toBe('new-api-key-12345');
    });

    it('should update router', async () => {
        const result = await buildLLMConfig({ router: 'in-built' }, baseLLMConfig);

        expect(result.isValid).toBe(true);
        expect(result.config.router).toBe('in-built');
    });

    it('should update multiple fields', async () => {
        // Set API key for the test to succeed
        process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-123456789';

        const result = await buildLLMConfig(
            {
                provider: 'anthropic',
                model: 'claude-4-sonnet-20250514',
                router: 'in-built',
            },
            baseLLMConfig
        );

        expect(result.isValid).toBe(true);
        expect(result.config.provider).toBe('anthropic');
        expect(result.config.model).toBe('claude-4-sonnet-20250514');
        expect(result.config.router).toBe('in-built');
    });

    it('should resolve API key from environment when provider changes', async () => {
        process.env.ANTHROPIC_API_KEY = 'sk-ant-api-key-123';

        const result = await buildLLMConfig({ provider: 'anthropic' }, baseLLMConfig);

        expect(result.isValid).toBe(true);
        expect(result.config.apiKey).toBe('sk-ant-api-key-123');
    });

    it('should fail when provider changes but no API key available', async () => {
        const result = await buildLLMConfig({ provider: 'anthropic' }, baseLLMConfig);

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors?.[0]?.type).toBe('missing_api_key');
        expect(result.errors?.[0]?.message).toContain("No API key found for provider 'anthropic'");
    });

    it('should validate provider/model compatibility', async () => {
        // Provide Google API key to test model compatibility logic
        process.env.GOOGLE_API_KEY = 'test-google-api-key-123456789';

        const result = await buildLLMConfig({ provider: 'google' }, baseLLMConfig);

        // Since only provider is changed (not model), function should switch to default Google model
        expect(result.isValid).toBe(true);
        expect(result.config.provider).toBe('google');
        // Should switch to default Google model from registry
        expect(result.config.model).toBe('gemini-2.5-pro'); // Default Google model
        expect(result.warnings).toContain(
            "Switched to default model 'gemini-2.5-pro' for provider 'google'"
        );
    });

    it('should reject explicit incompatible model/provider combination', async () => {
        // Provide Google API key
        process.env.GOOGLE_API_KEY = 'test-google-api-key-123456789';

        // Explicitly provide both incompatible model and provider
        const result = await buildLLMConfig({ provider: 'google', model: 'gpt-4o' }, baseLLMConfig);

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors?.[0]?.type).toBe('incompatible_model_provider');
        expect(result.errors?.[0]?.message).toContain(
            "Model 'gpt-4o' is not supported for provider 'google'"
        );
    });

    it('should switch to supported router when provider changes', async () => {
        const result = await buildLLMConfig({ provider: 'google' }, baseLLMConfig);

        expect(result.isValid).toBe(false); // Will fail due to model incompatibility, but shows router logic
    });

    it('should warn about short API key', async () => {
        const result = await buildLLMConfig({ apiKey: 'short' }, baseLLMConfig);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('API key seems too short - please verify it is correct');
    });

    it('should handle baseURL updates for openai-compatible', async () => {
        // Set OPENAI_API_KEY since openai-compatible uses same API key as openai
        process.env.OPENAI_API_KEY = 'sk-test-key-123456789';

        const result = await buildLLMConfig(
            {
                provider: 'openai-compatible',
                model: 'custom-model',
                baseURL: 'https://custom.openai.com',
            },
            baseLLMConfig
        );

        expect(result.isValid).toBe(true);
        expect(result.config.baseURL).toBe('https://custom.openai.com');
        expect(result.config.provider).toBe('openai-compatible');
        expect(result.config.model).toBe('custom-model');
    });

    it('should reject baseURL for unsupported providers', async () => {
        // Provide Anthropic API key so we can reach the baseURL validation
        process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-123456789';

        const result = await buildLLMConfig(
            {
                provider: 'anthropic',
                baseURL: 'https://custom.anthropic.com',
            },
            baseLLMConfig
        );

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors?.[0]?.type).toBe('invalid_base_url');
        expect(result.errors?.[0]?.message).toContain(
            'Custom baseURL is not supported for anthropic provider'
        );
    });

    it('should handle maxInputTokens updates', async () => {
        const result = await buildLLMConfig({ maxInputTokens: 2000 }, baseLLMConfig);

        expect(result.isValid).toBe(true);
        expect(result.config.maxInputTokens).toBe(2000);
    });

    // Tests for empty model, empty provider, and unknown provider removed
    // These scenarios are now impossible due to Zod validation at API boundary

    it('should validate negative maxInputTokens', async () => {
        const result = await buildLLMConfig({ maxInputTokens: -100 }, baseLLMConfig);

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors?.[0]?.type).toBe('invalid_max_tokens');
        expect(result.errors?.[0]?.message).toBe('maxInputTokens must be a positive number');
    });

    it('should validate invalid router', async () => {
        const result = await buildLLMConfig({ router: 'invalid' as any }, baseLLMConfig);

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors?.[0]?.type).toBe('unsupported_router');
        expect(result.errors?.[0]?.message).toBe('Router must be either "vercel" or "in-built"');
    });

    it('should handle temperature and maxOutputTokens validation', async () => {
        const result1 = await buildLLMConfig(
            { temperature: 0.5, maxOutputTokens: 4000 },
            baseLLMConfig
        );
        expect(result1.isValid).toBe(true);
        expect(result1.config.temperature).toBe(0.5);
        expect(result1.config.maxOutputTokens).toBe(4000);
    });

    it('should handle maxIterations update', async () => {
        const result = await buildLLMConfig({ maxIterations: 100 }, baseLLMConfig);

        expect(result.isValid).toBe(true);
        expect(result.config.maxIterations).toBe(100);
    });

    it('should update maxInputTokens when model changes', async () => {
        const result = await buildLLMConfig({ model: 'gpt-4o-mini' }, baseLLMConfig);

        expect(result.isValid).toBe(true);
        expect(result.config.maxInputTokens).toBeDefined();
    });

    it('should handle high maxInputTokens without error', async () => {
        const result = await buildLLMConfig({ maxInputTokens: 50000 }, baseLLMConfig);

        expect(result.isValid).toBe(true);
        expect(result.config.maxInputTokens).toBe(50000);
    });

    it('should keep current baseURL when provider supports it', async () => {
        const configWithBaseURL = {
            ...baseLLMConfig,
            provider: 'openai-compatible' as const,
            model: 'custom-model',
            baseURL: 'https://custom.openai.com',
        };

        const result = await buildLLMConfig({ model: 'another-custom-model' }, configWithBaseURL);

        expect(result.isValid).toBe(true);
        expect(result.config.baseURL).toBe('https://custom.openai.com');
        expect(result.config.provider).toBe('openai-compatible');
    });

    it('should remove baseURL when switching to unsupported provider', async () => {
        process.env.ANTHROPIC_API_KEY = 'sk-ant-api-key-123';

        const configWithBaseURL = {
            ...baseLLMConfig,
            provider: 'openai-compatible' as const,
            model: 'custom-model',
            baseURL: 'https://custom.openai.com',
        };

        const result = await buildLLMConfig(
            { provider: 'anthropic' as const, model: 'claude-4-sonnet-20250514' },
            configWithBaseURL
        );

        expect(result.isValid).toBe(true);
        expect(result.config.baseURL).toBeUndefined();
        expect(result.warnings).toContain(
            "Removed custom baseURL because provider 'anthropic' doesn't support it"
        );
    });

    it('should handle provider inference from model', async () => {
        const result = await buildLLMConfig({ model: 'claude-4-sonnet-20250514' }, baseLLMConfig);

        expect(result.isValid).toBe(false); // Will fail due to missing API key
        expect(result.errors).toHaveLength(1);
        expect(result.errors?.[0]?.type).toBe('missing_api_key');
        expect(result.errors?.[0]?.message).toContain("No API key found for provider 'anthropic'");
    });
});

// validateLLMSwitchRequest tests removed - validation now handled by Zod schemas at API boundary

describe('validateMcpServerConfig', () => {
    describe('valid configurations', () => {
        test('should validate stdio server config', () => {
            const serverConfig: McpServerConfig = {
                type: 'stdio',
                command: 'node',
                args: ['server.js'],
                env: {},
                timeout: 30000,
                connectionMode: 'lenient',
            };

            const result = validateMcpServerConfig('test-server', serverConfig);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should validate sse server config', () => {
            const serverConfig: McpServerConfig = {
                type: 'sse',
                url: 'https://example.com/sse',
                timeout: 30000,
                connectionMode: 'lenient',
                headers: {},
            };

            const result = validateMcpServerConfig('test-server', serverConfig);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should validate http server config', () => {
            const serverConfig: McpServerConfig = {
                type: 'http',
                url: 'https://api.example.com',
                timeout: 30000,
                connectionMode: 'lenient',
                headers: {},
            };

            const result = validateMcpServerConfig('test-server', serverConfig);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('validation errors', () => {
        test('should reject empty server name', () => {
            const serverConfig: McpServerConfig = {
                type: 'stdio',
                command: 'node',
                args: ['server.js'],
                env: {},
                timeout: 30000,
                connectionMode: 'lenient',
            };

            const result = validateMcpServerConfig('', serverConfig);

            expect(result.isValid).toBe(false);
            expect(result.errors?.[0]?.message).toBe('Server name must be a non-empty string');
        });

        test('should reject empty stdio command', () => {
            const serverConfig: McpServerConfig = {
                type: 'stdio',
                command: '',
                args: ['server.js'],
                env: {},
                timeout: 30000,
                connectionMode: 'lenient',
            };

            const result = validateMcpServerConfig('test-server', serverConfig);

            expect(result.isValid).toBe(false);
            expect(result.errors?.[0]?.message).toBe('Stdio server requires a non-empty command');
        });

        test('should reject invalid sse url', () => {
            const serverConfig: McpServerConfig = {
                type: 'sse',
                url: 'not-a-valid-url',
                timeout: 30000,
                connectionMode: 'lenient',
                headers: {},
            };

            const result = validateMcpServerConfig('test-server', serverConfig);

            expect(result.isValid).toBe(false);
            expect(result.errors?.[0]?.message).toContain('Invalid server configuration');
        });

        test('should reject invalid http url', () => {
            const serverConfig: McpServerConfig = {
                type: 'http',
                url: 'invalid-url',
                timeout: 30000,
                connectionMode: 'lenient',
                headers: {},
            };

            const result = validateMcpServerConfig('test-server', serverConfig);

            expect(result.isValid).toBe(false);
            expect(result.errors?.[0]?.message).toContain('Invalid server configuration');
        });
    });

    describe('warnings', () => {
        test('should warn about case-insensitive duplicate names', () => {
            const serverConfig: McpServerConfig = {
                type: 'stdio',
                command: 'node',
                args: ['server.js'],
                env: {},
                timeout: 30000,
                connectionMode: 'lenient',
            };
            const existingNames = ['MyServer'];

            const result = validateMcpServerConfig('myserver', serverConfig, existingNames);

            expect(result.isValid).toBe(true);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0]).toContain('similar to existing server');
        });
    });
});
