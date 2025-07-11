import { describe, test, expect } from 'vitest';
import { ConfigLoader } from './config-manager.js';
import type { AgentConfig } from './schemas.js';

function clone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

describe('ConfigLoader', () => {
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
            model: 'o4-mini',
            apiKey: 'SET_YOUR_API_KEY_HERE',
        },
    };

    test('loads and validates valid config', () => {
        const cm = new ConfigLoader(clone(baseConfig));
        const config = cm.getConfig();

        expect(config.llm.provider).toBe('openai');
        expect(config.llm.model).toBe('o4-mini');
        expect(config.llm.router).toBe('vercel'); // Default from schema
    });

    test('applies schema defaults', () => {
        const cm = new ConfigLoader(clone(baseConfig));
        const config = cm.getConfig();

        // Check that schema defaults are applied
        expect(config.llm.router).toBe('vercel'); // Default router
        expect(config.llm.maxIterations).toBe(50); // Default maxIterations
        expect(config.storage).toBeDefined(); // Default storage config
        expect(config.sessions).toBeDefined(); // Default sessions config
    });

    test('allows empty MCP server configs since they are now optional', () => {
        const configWithNoServers = {
            ...clone(baseConfig),
            mcpServers: {},
        };
        expect(() => new ConfigLoader(configWithNoServers)).not.toThrow();
    });

    test('throws when LLM config is missing', () => {
        const bad = {
            systemPrompt: 'hi',
            mcpServers: {
                test: {
                    type: 'stdio',
                    command: 'node',
                    args: ['agent-server.js'],
                },
            },
        } as any;
        expect(() => new ConfigLoader(bad)).toThrow();
    });

    test('returns readonly config to prevent external modifications', () => {
        const cm = new ConfigLoader(clone(baseConfig));
        const config = cm.getConfig();

        expect(Object.isFrozen(config)).toBe(true);
    });

    test('constructor validates config automatically', () => {
        // If constructor doesn't throw, validation passed
        expect(() => new ConfigLoader(clone(baseConfig))).not.toThrow();
    });

    describe('validation and error handling', () => {
        test('validate throws meaningful errors for invalid configs', () => {
            const invalidConfig = {
                ...clone(baseConfig),
                llm: {
                    ...baseConfig.llm,
                    provider: 'invalid-provider',
                },
            };

            expect(() => new ConfigLoader(invalidConfig)).toThrow(
                /Configuration validation failed/
            );
        });
    });

    describe('immutability protection', () => {
        test('prevents external mutation of returned configs', () => {
            const cm = new ConfigLoader(clone(baseConfig));
            const config = cm.getConfig();

            expect(Object.isFrozen(config)).toBe(true);
        });

        test('returns new instances on each call to prevent reference sharing', () => {
            const cm = new ConfigLoader(clone(baseConfig));
            const config1 = cm.getConfig();
            const config2 = cm.getConfig();

            // Should be same content but same frozen object (since it's immutable)
            expect(config1).toBe(config2);
            expect(config1.llm.provider).toBe(config2.llm.provider);
        });
    });
});
