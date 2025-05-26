import { describe, it, expect } from 'vitest';
import {
    ContributorConfigSchema,
    SystemPromptConfigSchema,
    LLMConfigSchema,
    StdioServerConfigSchema,
    SseServerConfigSchema,
    HttpServerConfigSchema,
    McpServerConfigSchema,
    ServerConfigsSchema,
    AgentConfigSchema,
} from './schemas.js';

/**
 * This file contains tests for all of our top level configuration validations.
 * This ensures we have good validations in place to avoid invalid configs from being used.
 */
describe('Config Schemas', () => {
    describe('ContributorConfigSchema', () => {
        it('accepts valid config', () => {
            const valid = {
                id: 'user1',
                type: 'static',
                priority: 10,
                enabled: true,
                content: 'hello',
            };
            expect(() => ContributorConfigSchema.parse(valid)).not.toThrow();
        });

        it('rejects missing fields', () => {
            const invalid = { type: 'static', priority: 5 };
            expect(() => ContributorConfigSchema.parse(invalid as any)).toThrow();
        });

        it('applies default enabled if not provided', () => {
            const config = { id: 'test', type: 'static' as const, priority: 1, content: 'c' };
            const parsed = ContributorConfigSchema.parse(config);
            expect(parsed.enabled).toBe(true);
        });

        it('requires content for static type and source for dynamic type, and handles optional fields', () => {
            const staticMissingContent = { id: 's1', type: 'static' as const, priority: 1 };
            expect(() => ContributorConfigSchema.parse(staticMissingContent)).toThrow();

            const dynamicMissingSource = { id: 'd1', type: 'dynamic' as const, priority: 1 };
            expect(() => ContributorConfigSchema.parse(dynamicMissingSource)).toThrow();

            // With .strict(), extra fields are not allowed.
            const staticWithExtraneousSource = {
                id: 's2',
                type: 'static' as const,
                priority: 1,
                content: 'c',
                source: 's', // Extraneous field for static type
            };
            expect(() => ContributorConfigSchema.parse(staticWithExtraneousSource)).toThrow(
                /Unrecognized key\(s\) in object: 'source'/i
            );

            const dynamicWithExtraneousContent = {
                id: 'd2',
                type: 'dynamic' as const,
                priority: 1,
                source: 's',
                content: 'c', // Extraneous field for dynamic type
            };
            expect(() => ContributorConfigSchema.parse(dynamicWithExtraneousContent)).toThrow(
                /Unrecognized key\(s\) in object: 'content'/i
            );

            const validStatic = { id: 's3', type: 'static' as const, priority: 1, content: 'c' };
            expect(() => ContributorConfigSchema.parse(validStatic)).not.toThrow();
            const parsedStatic = ContributorConfigSchema.parse(validStatic);
            // Type guard for static contributor
            if (parsedStatic.type === 'static') {
                expect(parsedStatic.content).toBe('c');
                // Explicitly check that source is not a property of the static type after parsing
                expect('source' in parsedStatic).toBe(false);
            } else {
                // Should not happen based on input
                throw new Error('parsedStatic was not of type static');
            }

            const validDynamic = { id: 'd3', type: 'dynamic' as const, priority: 1, source: 's' };
            expect(() => ContributorConfigSchema.parse(validDynamic)).not.toThrow();
            const parsedDynamic = ContributorConfigSchema.parse(validDynamic);
            // Type guard for dynamic contributor
            if (parsedDynamic.type === 'dynamic') {
                expect(parsedDynamic.source).toBe('s');
                // Explicitly check that content is not a property of the dynamic type after parsing
                expect('content' in parsedDynamic).toBe(false);
            } else {
                // Should not happen based on input
                throw new Error('parsedDynamic was not of type dynamic');
            }
        });
    });

    describe('SystemPromptConfigSchema', () => {
        it('accepts valid prompts', () => {
            const valid = {
                contributors: [{ id: 'c1', type: 'dynamic' as const, priority: 1, source: 's' }],
            };
            expect(() => SystemPromptConfigSchema.parse(valid)).not.toThrow();
        });

        it('rejects an empty contributors array', () => {
            const invalidEmpty = { contributors: [] };
            expect(() => SystemPromptConfigSchema.parse(invalidEmpty)).toThrow();
        });

        it('rejects if a contributor object in the array is invalid', () => {
            const invalidContributorArray = {
                contributors: [
                    { id: 'c1', type: 'static' as const, priority: 1, content: 'valid' },
                    { id: 'c2', type: 'dynamic' as const, priority: 'low' }, // Invalid priority type
                ],
            };
            expect(() => SystemPromptConfigSchema.parse(invalidContributorArray as any)).toThrow();
        });
    });

    describe('LlmConfigSchema', () => {
        it('accepts valid string prompt', () => {
            const good = {
                provider: 'openai',
                model: 'o4-mini',
                systemPrompt: 'Hi',
                apiKey: 'key',
                maxIterations: 2,
            };
            expect(() => LLMConfigSchema.parse(good)).not.toThrow();
        });

        it('accepts valid object prompt', () => {
            const objPrompt = {
                contributors: [{ id: 'c1', type: 'static', priority: 1, content: 'x' }],
            };
            const good = {
                provider: 'openai',
                model: 'o4-mini',
                apiKey: 'key',
                systemPrompt: objPrompt,
            };
            expect(() => LLMConfigSchema.parse(good)).not.toThrow();
        });

        it('rejects unsupported provider', () => {
            const bad = { provider: 'bad', model: 'x', systemPrompt: 'Hi' };
            const error = expect(() => LLMConfigSchema.parse(bad));
            error.toThrow();
        });

        it('rejects unsupported model', () => {
            const badModel = { provider: 'openai', model: 'not-a-model', systemPrompt: 'Hi' };
            const error = expect(() => LLMConfigSchema.parse(badModel));
            error.toThrow();
        });

        // Placeholder tests for llmConfigSchema default values
        it('applies default maxIterations if not provided', () => {
            const config = {
                provider: 'openai',
                model: 'o4-mini',
                systemPrompt: 'Test prompt',
                apiKey: '123',
            };
            const parsed = LLMConfigSchema.parse(config);
            expect(parsed.maxIterations).toBe(50);
        });

        it('applies default providerOptions if not provided', () => {
            const config = {
                provider: 'openai',
                model: 'o4-mini',
                systemPrompt: 'Test prompt',
                apiKey: '123',
            };
            const parsed = LLMConfigSchema.parse(config);
            expect(parsed.providerOptions).toEqual({});
        });

        it('applies default router if not provided', () => {
            const config = {
                provider: 'openai',
                model: 'o4-mini',
                systemPrompt: 'Test prompt',
                apiKey: '123',
            };
            const parsed = LLMConfigSchema.parse(config);
            expect(parsed.router).toBe('vercel');
        });

        it('rejects config without apiKey', () => {
            const config = {
                provider: 'openai',
                model: 'o4-mini',
                systemPrompt: 'Test prompt',
            };
            expect(() => LLMConfigSchema.parse(config)).toThrow();
        });

        it('accepts valid provider-specific options', () => {
            const config = {
                provider: 'openai',
                model: 'o4-mini',
                systemPrompt: 'Test prompt',
                apiKey: '123',
                providerOptions: {
                    temperature: 0.7,
                    top_p: 0.9,
                },
            };
            expect(() => LLMConfigSchema.parse(config)).not.toThrow();
            const parsed = LLMConfigSchema.parse(config);
            expect(parsed.providerOptions).toEqual({
                temperature: 0.7,
                top_p: 0.9,
            });
        });

        it('correctly validates case-insensitive provider names', () => {
            const configMixedCase = {
                provider: 'OpenAI', // Mixed case
                model: 'o4-mini',
                systemPrompt: 'Test prompt for mixed case provider',
                apiKey: '123',
            };
            expect(() => LLMConfigSchema.parse(configMixedCase)).not.toThrow();

            const configUpperCase = {
                provider: 'ANTHROPIC', // Upper case
                model: 'claude-3-opus-20240229', // Valid model for anthropic
                systemPrompt: 'Test prompt for upper case provider',
                apiKey: '123',
            };
            expect(() => LLMConfigSchema.parse(configUpperCase)).not.toThrow();
        });

        it('rejects if baseURL is set but provider is not openai', () => {
            const config = {
                provider: 'anthropic',
                model: 'claude-3-opus-20240229',
                apiKey: '123',
                systemPrompt: 'Test',
                baseURL: 'https://api.custom.com/v1', // baseURL is set but provider is not openai
            };
            expect(() => LLMConfigSchema.parse(config)).toThrow();
        });

        it('accepts if baseURL is set but maxTokens is missing', () => {
            const config = {
                provider: 'openai',
                model: 'my-custom-model',
                systemPrompt: 'Test',
                apiKey: '123',
                baseURL: 'https://api.custom.com/v1', // baseURL is set
                // maxTokens is missing
            };
            expect(() => LLMConfigSchema.parse(config)).not.toThrow();
        });

        it('accepts valid config with baseURL and maxTokens for openai', () => {
            const config = {
                provider: 'openai',
                model: 'my-company-finetune-v3',
                systemPrompt: 'Test',
                apiKey: '123',
                baseURL: 'https://api.custom.com/v1',
                maxTokens: 8192,
            };
            expect(() => LLMConfigSchema.parse(config)).not.toThrow();
        });

        it('rejects if maxTokens exceeds limit for a known model (no baseURL)', () => {
            const config = {
                provider: 'openai',
                model: 'gpt-4o-mini',
                systemPrompt: 'Test',
                apiKey: '123',
                maxTokens: 200000, // Exceeds the limit
            };
            expect(() => LLMConfigSchema.parse(config)).toThrow();
        });

        it('accepts maxTokens within limit for a known model (no baseURL)', () => {
            const config = {
                provider: 'openai',
                model: 'gpt-4o-mini', // Known model
                systemPrompt: 'Test',
                apiKey: '123',
                maxTokens: 4096, // Within limit
            };
            expect(() => LLMConfigSchema.parse(config)).not.toThrow();
        });

        it('accepts known model without maxTokens specified (no baseURL)', () => {
            const config = {
                provider: 'anthropic',
                model: 'claude-3-haiku-20240307', // Known model
                systemPrompt: 'Test',
                apiKey: '123',
                // maxTokens is not provided, should be fine
            };
            expect(() => LLMConfigSchema.parse(config)).not.toThrow();
        });
    });

    describe('stdioServerConfigSchema', () => {
        it('accepts valid config', () => {
            const validConfig = {
                type: 'stdio',
                command: 'node',
                args: ['server.js'],
                env: { PORT: '3000' },
                timeout: 10000,
            };
            expect(() => StdioServerConfigSchema.parse(validConfig)).not.toThrow();
        });

        it('applies default env if not provided', () => {
            const config = {
                type: 'stdio',
                command: 'node',
                args: ['server.js'],
            };
            const parsed = StdioServerConfigSchema.parse(config);
            expect(parsed.env).toEqual({});
        });

        it('applies default timeout if not provided', () => {
            const config = {
                type: 'stdio',
                command: 'node',
                args: ['server.js'],
            };
            const parsed = StdioServerConfigSchema.parse(config);
            expect(parsed.timeout).toBe(30000);
        });

        it('rejects missing required fields (command, args)', () => {
            const missingCommand = {
                type: 'stdio',
                args: ['server.js'],
            };
            expect(() => StdioServerConfigSchema.parse(missingCommand as any)).toThrow();

            const missingArgs = {
                type: 'stdio',
                command: 'node',
            };
            expect(() => StdioServerConfigSchema.parse(missingArgs as any)).toThrow();
        });

        it('rejects invalid types for fields', () => {
            const invalidCommandType = {
                type: 'stdio',
                command: 123, // Should be string
                args: ['server.js'],
            };
            expect(() => StdioServerConfigSchema.parse(invalidCommandType as any)).toThrow();

            const invalidArgsType = {
                type: 'stdio',
                command: 'node',
                args: 'server.js', // Should be array of strings
            };
            expect(() => StdioServerConfigSchema.parse(invalidArgsType as any)).toThrow();

            const invalidEnvType = {
                type: 'stdio',
                command: 'node',
                args: ['server.js'],
                env: ['PORT=3000'], // Should be record
            };
            expect(() => StdioServerConfigSchema.parse(invalidEnvType as any)).toThrow();

            const invalidTimeoutType = {
                type: 'stdio',
                command: 'node',
                args: ['server.js'],
                timeout: 'fast', // Should be number
            };
            expect(() => StdioServerConfigSchema.parse(invalidTimeoutType as any)).toThrow();
        });
    });

    describe('sseServerConfigSchema', () => {
        it('accepts valid config', () => {
            const validConfig = {
                type: 'sse',
                url: 'http://localhost:8080/events',
                headers: { Authorization: 'Bearer token' },
                timeout: 15000,
            };
            expect(() => SseServerConfigSchema.parse(validConfig)).not.toThrow();
        });

        it('applies default headers if not provided', () => {
            const config = {
                type: 'sse',
                url: 'http://localhost:8080/events',
            };
            const parsed = SseServerConfigSchema.parse(config);
            expect(parsed.headers).toEqual({});
        });

        it('applies default timeout if not provided', () => {
            const config = {
                type: 'sse',
                url: 'http://localhost:8080/events',
            };
            const parsed = SseServerConfigSchema.parse(config);
            expect(parsed.timeout).toBe(30000);
        });

        it('rejects missing required fields (url)', () => {
            const missingUrl = {
                type: 'sse',
            };
            expect(() => SseServerConfigSchema.parse(missingUrl as any)).toThrow();
        });

        it('rejects invalid types for fields (url, headers, timeout)', () => {
            const invalidUrlType = {
                type: 'sse',
                url: 12345, // Should be string URL
            };
            expect(() => SseServerConfigSchema.parse(invalidUrlType as any)).toThrow();

            const invalidHeadersType = {
                type: 'sse',
                url: 'http://localhost:8080/events',
                headers: ['Authorization: Bearer token'], // Should be record
            };
            expect(() => SseServerConfigSchema.parse(invalidHeadersType as any)).toThrow();

            const invalidTimeoutType = {
                type: 'sse',
                url: 'http://localhost:8080/events',
                timeout: 'medium', // Should be number
            };
            expect(() => SseServerConfigSchema.parse(invalidTimeoutType as any)).toThrow();
        });
    });

    describe('httpServerConfigSchema', () => {
        it('accepts valid config', () => {
            const validConfig = {
                type: 'http' as const,
                baseUrl: 'http://localhost:9000/api',
                headers: { 'X-API-Key': 'secretkey' },
                timeout: 20000,
            };
            expect(() => HttpServerConfigSchema.parse(validConfig)).not.toThrow();
        });

        it('applies default headers if not provided', () => {
            const config = { type: 'http' as const, baseUrl: 'http://localhost:9000/api' };
            const parsed = HttpServerConfigSchema.parse(config);
            expect(parsed.headers).toEqual({});
        });

        it('applies default timeout if not provided', () => {
            const config = { type: 'http' as const, baseUrl: 'http://localhost:9000/api' };
            const parsed = HttpServerConfigSchema.parse(config);
            expect(parsed.timeout).toBe(30000);
        });

        it('rejects missing required fields (baseUrl)', () => {
            const missingBaseUrl = { type: 'http' as const };
            expect(() => HttpServerConfigSchema.parse(missingBaseUrl as any)).toThrow();
        });

        it('rejects invalid types for fields (baseUrl, headers, timeout)', () => {
            const invalidBaseUrlType = { type: 'http' as const, baseUrl: 'not-a-url' };
            expect(() => HttpServerConfigSchema.parse(invalidBaseUrlType as any)).toThrow(); // Zod's .url() catches this

            const invalidHeadersType = {
                type: 'http' as const,
                baseUrl: 'http://localhost:9000/api',
                headers: 'X-API-Key: secretkey', // Should be record
            };
            expect(() => HttpServerConfigSchema.parse(invalidHeadersType as any)).toThrow();

            const invalidTimeoutType = {
                type: 'http' as const,
                baseUrl: 'http://localhost:9000/api',
                timeout: false, // Should be number
            };
            expect(() => HttpServerConfigSchema.parse(invalidTimeoutType as any)).toThrow();
        });
    });

    describe('ServerConfigsSchema', () => {
        it('accepts a valid record of different server types', () => {
            const validRecord = {
                server1: { type: 'stdio' as const, command: 'node', args: ['s1.js'] },
                server2: { type: 'sse' as const, url: 'http://localhost/sse2' },
                server3: { type: 'http' as const, baseUrl: 'http://localhost/http3' },
            };
            expect(() => ServerConfigsSchema.parse(validRecord)).not.toThrow();
        });

        it('rejects an empty object (due to refine)', () => {
            expect(() => ServerConfigsSchema.parse({} as any)).toThrow(
                /At least one MCP server configuration is required/
            );
        });

        it('rejects if any server config in the record is invalid', () => {
            const invalidRecord = {
                server1: { type: 'stdio' as const, command: 'node', args: ['s1.js'] },
                server2: { type: 'sse' as const, url: 12345 }, // Invalid URL type
            };
            expect(() => ServerConfigsSchema.parse(invalidRecord as any)).toThrow();
        });
    });

    describe('AgentConfigSchema', () => {
        it('accepts a complete valid config', () => {
            const validAgentConfig = {
                mcpServers: {
                    main: { type: 'stdio' as const, command: 'node', args: ['agent-server.js'] },
                },
                llm: {
                    provider: 'openai',
                    model: 'o4-mini',
                    systemPrompt: 'You are an agent.',
                    apiKey: '123',
                },
            };
            expect(() => AgentConfigSchema.parse(validAgentConfig)).not.toThrow();
        });

        it('rejects if mcpServers is missing', () => {
            const missingMcp = {
                llm: { provider: 'openai', model: 'o4-mini', systemPrompt: 'Y' },
            };
            expect(() => AgentConfigSchema.parse(missingMcp as any)).toThrow();
        });

        it('rejects if mcpServers is invalid (e.g., empty object)', () => {
            const invalidMcp = {
                mcpServers: {}, // ServerConfigsSchema rejects this
                llm: { provider: 'openai', model: 'o4-mini', systemPrompt: 'Y' },
            };
            expect(() => AgentConfigSchema.parse(invalidMcp as any)).toThrow();
        });

        it('rejects if llm config is missing', () => {
            const missingLlm = {
                mcpServers: { main: { type: 'stdio' as const, command: 'n', args: ['a'] } },
            };
            expect(() => AgentConfigSchema.parse(missingLlm as any)).toThrow();
        });

        it('rejects if llm config is invalid', () => {
            const invalidLlm = {
                mcpServers: { main: { type: 'stdio' as const, command: 'n', args: ['a'] } },
                llm: { provider: 'unknownProvider', model: 'm', systemPrompt: 'Y' }, // invalid provider
            };
            expect(() => AgentConfigSchema.parse(invalidLlm as any)).toThrow();
        });
    });

    describe('McpServerConfigSchema (Union)', () => {
        it('accepts valid stdio server config', () => {
            const stdioConf = { type: 'stdio' as const, command: 'node', args: ['s.js'] };
            expect(() => McpServerConfigSchema.parse(stdioConf)).not.toThrow();
        });

        it('accepts valid sse server config', () => {
            const sseConf = { type: 'sse' as const, url: 'http://localhost/sse' };
            expect(() => McpServerConfigSchema.parse(sseConf)).not.toThrow();
        });

        it('accepts valid http server config', () => {
            const httpConf = { type: 'http' as const, baseUrl: 'http://localhost/http' };
            expect(() => McpServerConfigSchema.parse(httpConf)).not.toThrow();
        });

        it('rejects config with an invalid type literal', () => {
            const invalidType = { type: 'ftp' as any, host: 'localhost' }; // 'ftp' is not a valid type
            expect(() => McpServerConfigSchema.parse(invalidType)).toThrow();
        });

        it('rejects config missing the type field', () => {
            const missingType = { command: 'node', args: ['s.js'] }; // Missing 'type' to discriminate union
            expect(() => McpServerConfigSchema.parse(missingType as any)).toThrow();
        });
        it('rejects config with a valid type but invalid fields for that type', () => {
            const stdioInvalidArgs = {
                type: 'stdio' as const,
                command: 'node',
                args: 'not-an-array',
            };
            expect(() => McpServerConfigSchema.parse(stdioInvalidArgs as any)).toThrow();
        });
    });
});
