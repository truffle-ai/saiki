import { describe, it, expect } from 'vitest';
import { ContributorConfigSchema, SystemPromptConfigSchema, AgentConfigSchema } from './schemas.js';
import { LLMConfigSchema } from '../schemas/llm.js';
import {
    StdioServerConfigSchema,
    SseServerConfigSchema,
    HttpServerConfigSchema,
    McpServerConfigSchema,
    ServerConfigsSchema,
} from '../schemas/mcp.js';

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
        it('accepts valid config with minimal fields', () => {
            const good = {
                provider: 'openai',
                model: 'o4-mini',
                apiKey: 'key',
                maxIterations: 2,
            };
            expect(() => LLMConfigSchema.parse(good)).not.toThrow();
        });

        it('rejects unsupported provider', () => {
            const bad = { provider: 'bad', model: 'x', apiKey: 'key' };
            const error = expect(() => LLMConfigSchema.parse(bad));
            error.toThrow();
        });

        it('rejects unsupported model', () => {
            const badModel = { provider: 'openai', model: 'not-a-model', apiKey: 'key' };
            const error = expect(() => LLMConfigSchema.parse(badModel));
            error.toThrow();
        });

        // Placeholder tests for llmConfigSchema default values
        it('applies default maxIterations if not provided', () => {
            const config = {
                provider: 'openai',
                model: 'o4-mini',
                apiKey: '123',
            };
            const parsed = LLMConfigSchema.parse(config);
            expect(parsed.maxIterations).toBe(50);
        });

        it('handles explicit temperature and maxOutputTokens', () => {
            const config = {
                provider: 'openai',
                model: 'o4-mini',
                apiKey: '123',
                temperature: 0.7,
                maxOutputTokens: 4000,
            };
            const parsed = LLMConfigSchema.parse(config);
            expect(parsed.temperature).toBe(0.7);
            expect(parsed.maxOutputTokens).toBe(4000);
        });

        it('applies default router if not provided', () => {
            const config = {
                provider: 'openai',
                model: 'o4-mini',
                apiKey: '123',
            };
            const parsed = LLMConfigSchema.parse(config);
            expect(parsed.router).toBe('vercel');
        });

        it('rejects config without apiKey', () => {
            const config = {
                provider: 'openai',
                model: 'o4-mini',
            };
            expect(() => LLMConfigSchema.parse(config)).toThrow();
        });

        it.each([
            { temperature: -0.1, description: 'below minimum' },
            { temperature: 1.5, description: 'above maximum' },
            { temperature: -1, description: 'negative value' },
            { temperature: 2, description: 'greater than 1' },
        ])('rejects temperature $description ($temperature)', ({ temperature }) => {
            const config = {
                provider: 'openai',
                model: 'o4-mini',
                apiKey: '123',
                temperature,
            };
            expect(() => LLMConfigSchema.parse(config)).toThrow();
        });

        it('requires exact case for provider names', () => {
            const configMixedCase = {
                provider: 'OpenAI', // Mixed case - should fail
                model: 'o4-mini',
                apiKey: '123',
            };
            expect(() => LLMConfigSchema.parse(configMixedCase)).toThrow();

            const configUpperCase = {
                provider: 'ANTHROPIC', // Upper case - should fail
                model: 'claude-3-opus-20240229',
                apiKey: '123',
            };
            expect(() => LLMConfigSchema.parse(configUpperCase)).toThrow();

            // But correct case should work
            const configCorrectCase = {
                provider: 'anthropic', // Correct case
                model: 'claude-3-opus-20240229',
                apiKey: '123',
            };
            expect(() => LLMConfigSchema.parse(configCorrectCase)).not.toThrow();
        });

        it('rejects if baseURL is set but provider does not support it', () => {
            const config = {
                provider: 'anthropic',
                model: 'claude-3-opus-20240229',
                apiKey: '123',
                baseURL: 'https://api.custom.com/v1', // baseURL is set but anthropic doesn't support it
            };
            expect(() => LLMConfigSchema.parse(config)).toThrow();
        });

        it('accepts if baseURL is set but maxInputTokens is missing for openai-compatible', () => {
            const config = {
                provider: 'openai-compatible',
                model: 'my-custom-model',
                apiKey: '123',
                baseURL: 'https://api.custom.com/v1', // baseURL is set
                // maxInputTokens is missing
            };
            expect(() => LLMConfigSchema.parse(config)).not.toThrow();
        });

        it('accepts valid config with baseURL and maxInputTokens for openai-compatible', () => {
            const config = {
                provider: 'openai-compatible',
                model: 'my-company-finetune-v3',
                apiKey: '123',
                baseURL: 'https://api.custom.com/v1',
                maxInputTokens: 8192,
            };
            expect(() => LLMConfigSchema.parse(config)).not.toThrow();
        });

        it('rejects if openai-compatible provider is used without baseURL', () => {
            const config = {
                provider: 'openai-compatible',
                model: 'my-custom-model',
                apiKey: '123',
                // baseURL is missing - should be required for openai-compatible
            };
            expect(() => LLMConfigSchema.parse(config)).toThrow();
        });

        it('rejects if maxInputTokens exceeds limit for a known model (no baseURL)', () => {
            const config = {
                provider: 'openai',
                model: 'gpt-4o-mini',
                apiKey: '123',
                maxInputTokens: 200000, // Exceeds the limit
            };
            expect(() => LLMConfigSchema.parse(config)).toThrow();
        });

        it('accepts maxInputTokens within limit for a known model (no baseURL)', () => {
            const config = {
                provider: 'openai',
                model: 'gpt-4o-mini', // Known model
                apiKey: '123',
                maxInputTokens: 4096, // Within limit
            };
            expect(() => LLMConfigSchema.parse(config)).not.toThrow();
        });

        it('accepts known model without maxInputTokens specified (no baseURL)', () => {
            const config = {
                provider: 'anthropic',
                model: 'claude-3-haiku-20240307', // Known model
                apiKey: '123',
                // maxInputTokens is not provided, should be fine
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

        it('applies default connectionMode if not provided', () => {
            const config = {
                type: 'stdio',
                command: 'node',
                args: ['server.js'],
            };
            const parsed = StdioServerConfigSchema.parse(config);
            expect(parsed.connectionMode).toBe('lenient');
        });

        it('accepts valid connectionMode values', () => {
            const strictConfig = {
                type: 'stdio',
                command: 'node',
                args: ['server.js'],
                connectionMode: 'strict',
            };
            expect(() => StdioServerConfigSchema.parse(strictConfig)).not.toThrow();
            const parsedStrict = StdioServerConfigSchema.parse(strictConfig);
            expect(parsedStrict.connectionMode).toBe('strict');

            const lenientConfig = {
                type: 'stdio',
                command: 'node',
                args: ['server.js'],
                connectionMode: 'lenient',
            };
            expect(() => StdioServerConfigSchema.parse(lenientConfig)).not.toThrow();
            const parsedLenient = StdioServerConfigSchema.parse(lenientConfig);
            expect(parsedLenient.connectionMode).toBe('lenient');
        });

        it('rejects invalid connectionMode values', () => {
            const invalidConfig = {
                type: 'stdio',
                command: 'node',
                args: ['server.js'],
                connectionMode: 'invalid',
            };
            expect(() => StdioServerConfigSchema.parse(invalidConfig as any)).toThrow();
        });

        it('rejects missing required fields (command)', () => {
            const missingCommand = {
                type: 'stdio',
                args: ['server.js'],
            };
            expect(() => StdioServerConfigSchema.parse(missingCommand as any)).toThrow();

            // args is optional with default [], so this should NOT throw
            const missingArgs = {
                type: 'stdio',
                command: 'node',
            };
            expect(() => StdioServerConfigSchema.parse(missingArgs as any)).not.toThrow();
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

        it('applies default connectionMode if not provided', () => {
            const config = {
                type: 'sse',
                url: 'http://localhost:8080/events',
            };
            const parsed = SseServerConfigSchema.parse(config);
            expect(parsed.connectionMode).toBe('lenient');
        });

        it('accepts valid connectionMode values', () => {
            const strictConfig = {
                type: 'sse',
                url: 'http://localhost:8080/events',
                connectionMode: 'strict',
            };
            expect(() => SseServerConfigSchema.parse(strictConfig)).not.toThrow();
            const parsedStrict = SseServerConfigSchema.parse(strictConfig);
            expect(parsedStrict.connectionMode).toBe('strict');

            const lenientConfig = {
                type: 'sse',
                url: 'http://localhost:8080/events',
                connectionMode: 'lenient',
            };
            expect(() => SseServerConfigSchema.parse(lenientConfig)).not.toThrow();
            const parsedLenient = SseServerConfigSchema.parse(lenientConfig);
            expect(parsedLenient.connectionMode).toBe('lenient');
        });

        it('rejects invalid connectionMode values', () => {
            const invalidConfig = {
                type: 'sse',
                url: 'http://localhost:8080/events',
                connectionMode: 'invalid',
            };
            expect(() => SseServerConfigSchema.parse(invalidConfig as any)).toThrow();
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
        it('accepts valid config with optional fields', () => {
            const validConfig = {
                type: 'http' as const,
                url: 'http://localhost:9000/api',
                headers: { 'X-API-Key': 'secretkey' },
                timeout: 20000,
            };
            expect(() => HttpServerConfigSchema.parse(validConfig)).not.toThrow();
        });

        it('rejects missing required fields (url)', () => {
            const missingUrl = { type: 'http' as const };
            expect(() => HttpServerConfigSchema.parse(missingUrl as any)).toThrow();
        });

        it('applies default connectionMode if not provided', () => {
            const config = {
                type: 'http' as const,
                url: 'http://localhost:9000/api',
            };
            const parsed = HttpServerConfigSchema.parse(config);
            expect(parsed.connectionMode).toBe('lenient');
        });

        it('accepts valid connectionMode values', () => {
            const strictConfig = {
                type: 'http' as const,
                url: 'http://localhost:9000/api',
                connectionMode: 'strict',
            };
            expect(() => HttpServerConfigSchema.parse(strictConfig)).not.toThrow();
            const parsedStrict = HttpServerConfigSchema.parse(strictConfig);
            expect(parsedStrict.connectionMode).toBe('strict');

            const lenientConfig = {
                type: 'http' as const,
                url: 'http://localhost:9000/api',
                connectionMode: 'lenient',
            };
            expect(() => HttpServerConfigSchema.parse(lenientConfig)).not.toThrow();
            const parsedLenient = HttpServerConfigSchema.parse(lenientConfig);
            expect(parsedLenient.connectionMode).toBe('lenient');
        });

        it('rejects invalid connectionMode values', () => {
            const invalidConfig = {
                type: 'http' as const,
                url: 'http://localhost:9000/api',
                connectionMode: 'invalid',
            };
            expect(() => HttpServerConfigSchema.parse(invalidConfig as any)).toThrow();
        });

        it('rejects invalid types for fields (url, headers, timeout)', () => {
            const invalidUrlType = { type: 'http' as const, url: 'not-a-url' };
            expect(() => HttpServerConfigSchema.parse(invalidUrlType as any)).toThrow(); // Zod's .url() catches this

            const invalidHeadersType = {
                type: 'http' as const,
                url: 'http://localhost:9000/api',
                headers: 'not-an-object',
            };
            expect(() => HttpServerConfigSchema.parse(invalidHeadersType as any)).toThrow();

            const invalidTimeoutType = {
                type: 'http' as const,
                url: 'http://localhost:9000/api',
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
                server3: { type: 'http' as const, url: 'http://localhost/http3' },
            };
            expect(() => ServerConfigsSchema.parse(validRecord)).not.toThrow();
        });

        it('accepts an empty object (no refine validation)', () => {
            expect(() => ServerConfigsSchema.parse({} as any)).not.toThrow();
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
        it('accepts valid config with string systemPrompt', () => {
            const validAgentConfig = {
                systemPrompt: 'You are an agent.',
                mcpServers: {
                    main: { type: 'stdio' as const, command: 'node', args: ['agent-server.js'] },
                },
                llm: {
                    provider: 'openai',
                    model: 'o4-mini',
                    apiKey: '123',
                },
            };
            expect(() => AgentConfigSchema.parse(validAgentConfig)).not.toThrow();
        });

        it('accepts valid config with structured systemPrompt', () => {
            const objPrompt = {
                contributors: [
                    { id: 'c1', type: 'static', priority: 1, content: 'You are helpful' },
                ],
            };
            const validAgentConfig = {
                systemPrompt: objPrompt,
                mcpServers: {
                    main: { type: 'stdio' as const, command: 'node', args: ['agent-server.js'] },
                },
                llm: {
                    provider: 'openai',
                    model: 'o4-mini',
                    apiKey: '123',
                },
            };
            expect(() => AgentConfigSchema.parse(validAgentConfig)).not.toThrow();
        });

        it('rejects config without systemPrompt', () => {
            const missingSystemPrompt = {
                mcpServers: {
                    main: { type: 'stdio' as const, command: 'node', args: ['agent-server.js'] },
                },
                llm: { provider: 'openai', model: 'o4-mini', apiKey: 'key' },
            };
            expect(() => AgentConfigSchema.parse(missingSystemPrompt as any)).toThrow();
        });

        it('accepts config when mcpServers is missing (uses default)', () => {
            const missingMcp = {
                systemPrompt: 'You are helpful',
                llm: { provider: 'openai', model: 'o4-mini', apiKey: 'key' },
            };
            expect(() => AgentConfigSchema.parse(missingMcp as any)).not.toThrow();
        });

        it('accepts config with empty mcpServers object (valid empty configuration)', () => {
            const emptyMcp = {
                systemPrompt: 'You are helpful',
                mcpServers: {}, // This is valid - no servers configured
                llm: { provider: 'openai', model: 'o4-mini', apiKey: 'key' },
            };
            expect(() => AgentConfigSchema.parse(emptyMcp as any)).not.toThrow();
        });

        it('rejects if llm config is missing', () => {
            const missingLlm = {
                systemPrompt: 'You are helpful',
                mcpServers: { main: { type: 'stdio' as const, command: 'n', args: ['a'] } },
            };
            expect(() => AgentConfigSchema.parse(missingLlm as any)).toThrow();
        });

        it('rejects if llm config is invalid', () => {
            const invalidLlm = {
                systemPrompt: 'You are helpful',
                mcpServers: { main: { type: 'stdio' as const, command: 'n', args: ['a'] } },
                llm: { provider: 'unknownProvider', model: 'm', apiKey: 'key' }, // invalid provider
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
            const httpConf = { type: 'http' as const, url: 'http://localhost/http' };
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

    describe('AgentConfigSchema - Sessions Configuration', () => {
        const baseValidConfig = {
            systemPrompt: 'You are an agent.',
            mcpServers: {
                main: { type: 'stdio' as const, command: 'node', args: ['agent-server.js'] },
            },
            llm: {
                provider: 'openai',
                model: 'o4-mini',
                apiKey: '123',
            },
        };

        it('applies default sessions config if not provided', () => {
            const parsed = AgentConfigSchema.parse(baseValidConfig);
            expect(parsed.sessions).toEqual({
                maxSessions: 100,
                sessionTTL: 3600000,
            });
        });

        it('accepts valid sessions config', () => {
            const configWithSessions = {
                ...baseValidConfig,
                sessions: {
                    maxSessions: 50,
                    sessionTTL: 1800000, // 30 minutes
                },
            };
            expect(() => AgentConfigSchema.parse(configWithSessions)).not.toThrow();
            const parsed = AgentConfigSchema.parse(configWithSessions);
            expect(parsed.sessions.maxSessions).toBe(50);
            expect(parsed.sessions.sessionTTL).toBe(1800000);
        });

        it('applies default maxSessions if only sessionTTL is provided', () => {
            const configWithPartialSessions = {
                ...baseValidConfig,
                sessions: {
                    sessionTTL: 7200000, // 2 hours
                },
            };
            const parsed = AgentConfigSchema.parse(configWithPartialSessions);
            expect(parsed.sessions.maxSessions).toBe(100); // default
            expect(parsed.sessions.sessionTTL).toBe(7200000);
        });

        it('applies default sessionTTL if only maxSessions is provided', () => {
            const configWithPartialSessions = {
                ...baseValidConfig,
                sessions: {
                    maxSessions: 25,
                },
            };
            const parsed = AgentConfigSchema.parse(configWithPartialSessions);
            expect(parsed.sessions.maxSessions).toBe(25);
            expect(parsed.sessions.sessionTTL).toBe(3600000); // default
        });

        it('rejects negative maxSessions', () => {
            const configWithNegativeMaxSessions = {
                ...baseValidConfig,
                sessions: {
                    maxSessions: -5,
                },
            };
            expect(() => AgentConfigSchema.parse(configWithNegativeMaxSessions)).toThrow();
        });

        it('rejects zero maxSessions', () => {
            const configWithZeroMaxSessions = {
                ...baseValidConfig,
                sessions: {
                    maxSessions: 0,
                },
            };
            expect(() => AgentConfigSchema.parse(configWithZeroMaxSessions)).toThrow();
        });

        it('rejects non-integer maxSessions', () => {
            const configWithFloatMaxSessions = {
                ...baseValidConfig,
                sessions: {
                    maxSessions: 10.5,
                },
            };
            expect(() => AgentConfigSchema.parse(configWithFloatMaxSessions)).toThrow();
        });

        it('rejects negative sessionTTL', () => {
            const configWithNegativeTTL = {
                ...baseValidConfig,
                sessions: {
                    sessionTTL: -1000,
                },
            };
            expect(() => AgentConfigSchema.parse(configWithNegativeTTL)).toThrow();
        });

        it('rejects zero sessionTTL', () => {
            const configWithZeroTTL = {
                ...baseValidConfig,
                sessions: {
                    sessionTTL: 0,
                },
            };
            expect(() => AgentConfigSchema.parse(configWithZeroTTL)).toThrow();
        });

        it('rejects non-integer sessionTTL', () => {
            const configWithFloatTTL = {
                ...baseValidConfig,
                sessions: {
                    sessionTTL: 1800.5,
                },
            };
            expect(() => AgentConfigSchema.parse(configWithFloatTTL)).toThrow();
        });

        it('rejects invalid types for sessions fields', () => {
            const configWithStringMaxSessions = {
                ...baseValidConfig,
                sessions: {
                    maxSessions: '100', // Should be number
                },
            };
            expect(() => AgentConfigSchema.parse(configWithStringMaxSessions as any)).toThrow();

            const configWithStringTTL = {
                ...baseValidConfig,
                sessions: {
                    sessionTTL: '3600000', // Should be number
                },
            };
            expect(() => AgentConfigSchema.parse(configWithStringTTL as any)).toThrow();
        });
    });
});
