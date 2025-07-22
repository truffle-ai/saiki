import { describe, test, expect } from 'vitest';
import { applyCLIOverrides, type CLIConfigOverrides } from './cli-overrides.js';
import type { AgentConfig } from '@core/index.js';

function clone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

describe('CLI Overrides', () => {
    const baseConfig: AgentConfig = {
        systemPrompt: 'hi',
        mcpServers: {
            test: {
                type: 'stdio',
                command: 'node',
                args: ['agent-server.js'],
            },
        },
        llm: {
            provider: 'openai',
            model: 'gpt-4o',
            apiKey: 'file-api-key',
        },
    };

    // Expected config after applying defaults through schema
    const expectedConfigWithDefaults = {
        systemPrompt: 'hi',
        mcpServers: {
            test: {
                type: 'stdio' as const,
                command: 'node',
                args: ['agent-server.js'],
                env: {},
                timeout: 30000,
                connectionMode: 'lenient' as const,
            },
        },
        llm: {
            provider: 'openai',
            model: 'gpt-4o',
            apiKey: 'file-api-key',
            maxIterations: 50,
            router: 'vercel' as const,
        },
        storage: {
            cache: {
                type: 'in-memory' as const,
            },
            database: {
                type: 'in-memory' as const,
            },
        },
        sessions: {
            maxSessions: 100,
            sessionTTL: 3600000,
        },
        toolConfirmation: {
            mode: 'event-based' as const,
            timeout: 30000,
            allowedToolsStorage: 'storage' as const,
        },
        plugins: [],
    };

    test('applies CLI overrides correctly', () => {
        const cliOverrides: CLIConfigOverrides = {
            model: 'claude-3-5-sonnet-20240620',
            provider: 'anthropic',
            router: 'in-built',
            apiKey: 'cli-api-key',
        };

        const result = applyCLIOverrides(clone(baseConfig), cliOverrides);

        expect(result.llm.model).toBe('claude-3-5-sonnet-20240620');
        expect(result.llm.provider).toBe('anthropic');
        expect(result.llm.router).toBe('in-built');
        expect(result.llm.apiKey).toBe('cli-api-key');
    });

    test('applies partial CLI overrides', () => {
        const cliOverrides: CLIConfigOverrides = {
            model: 'gpt-4o-mini',
            // Only override model, leave others unchanged
        };

        const result = applyCLIOverrides(clone(baseConfig), cliOverrides);

        expect(result.llm.model).toBe('gpt-4o-mini'); // Overridden
        expect(result.llm.provider).toBe('openai'); // Original
        expect(result.llm.router).toBe('vercel'); // Original
        expect(result.llm.apiKey).toBe('file-api-key'); // Original
    });

    test('returns config with defaults when no overrides provided', () => {
        const result = applyCLIOverrides(clone(baseConfig), undefined);

        expect(result).toEqual(expectedConfigWithDefaults);
        expect(result).not.toBe(baseConfig); // Should be a copy
    });

    test('returns config with defaults when empty overrides provided', () => {
        const result = applyCLIOverrides(clone(baseConfig), {});

        expect(result).toEqual(expectedConfigWithDefaults);
        expect(result).not.toBe(baseConfig); // Should be a copy
    });

    test('does not mutate original config', () => {
        const originalConfig = clone(baseConfig);
        const cliOverrides: CLIConfigOverrides = {
            model: 'gpt-4o-mini',
            provider: 'openai',
        };

        applyCLIOverrides(originalConfig, cliOverrides);

        // Original should be unchanged
        expect(originalConfig.llm.model).toBe('gpt-4o');
        expect(originalConfig.llm.provider).toBe('openai');
    });

    test('preserves all non-LLM config fields', () => {
        const cliOverrides: CLIConfigOverrides = {
            model: 'gpt-4o-mini',
        };

        const result = applyCLIOverrides(clone(baseConfig), cliOverrides);

        // Non-LLM fields should be preserved (with defaults applied)
        expect(result.systemPrompt).toBe(baseConfig.systemPrompt);
        expect(result.mcpServers?.test?.type).toBe('stdio');
        if (result.mcpServers?.test?.type === 'stdio') {
            expect(result.mcpServers.test.command).toBe('node');
            expect(result.mcpServers.test.args).toEqual(['agent-server.js']);
        }
    });

    test('handles undefined values in overrides gracefully', () => {
        const cliOverrides: CLIConfigOverrides = {
            model: 'gpt-4o-mini',
            // provider, router, apiKey intentionally omitted to test undefined handling
        };

        const result = applyCLIOverrides(clone(baseConfig), cliOverrides);

        expect(result.llm.model).toBe('gpt-4o-mini'); // Applied
        expect(result.llm.provider).toBe('openai'); // Original (undefined ignored)
        expect(result.llm.router).toBe('vercel'); // Default (undefined ignored)
        expect(result.llm.apiKey).toBe('file-api-key'); // Original (undefined ignored)
    });
});
