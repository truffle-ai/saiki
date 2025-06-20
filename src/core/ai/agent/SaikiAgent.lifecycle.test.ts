import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { SaikiAgent } from './SaikiAgent.js';
import type { AgentConfig } from '../../config/schemas.js';
import type { AgentServices } from '../../utils/service-initializer.js';

// Mock the createAgentServices function
vi.mock('../../utils/service-initializer.js', () => ({
    createAgentServices: vi.fn(),
}));

import { createAgentServices } from '../../utils/service-initializer.js';
const mockCreateAgentServices = vi.mocked(createAgentServices);

describe('SaikiAgent Lifecycle Management', () => {
    let mockConfig: AgentConfig;
    let mockServices: AgentServices;

    beforeEach(() => {
        vi.resetAllMocks();

        mockConfig = {
            llm: {
                provider: 'openai',
                model: 'gpt-4o',
                apiKey: 'test-key',
                router: 'vercel',
                systemPrompt: 'You are a helpful assistant',
                maxIterations: 50,
                maxInputTokens: 128000,
            },
            mcpServers: {},
            storage: {
                cache: { type: 'in-memory' },
                database: { type: 'in-memory' },
            },
            sessions: {
                maxSessions: 10,
                sessionTTL: 3600,
            },
        };

        mockServices = {
            clientManager: {
                disconnectAll: vi.fn().mockResolvedValue(undefined),
                initializeFromConfig: vi.fn().mockResolvedValue(undefined),
            } as any,
            promptManager: {} as any,
            agentEventBus: {} as any,
            stateManager: {
                getRuntimeState: vi.fn().mockReturnValue({
                    llm: mockConfig.llm,
                    mcpServers: {},
                    runtime: { debugMode: false, logLevel: 'info' },
                }),
            } as any,
            sessionManager: {
                cleanup: vi.fn().mockResolvedValue(undefined),
                init: vi.fn().mockResolvedValue(undefined),
                createSession: vi.fn().mockResolvedValue({ id: 'test-session' }),
            } as any,
            storage: {} as any,
            storageManager: {
                disconnect: vi.fn().mockResolvedValue(undefined),
            } as any,
        };

        mockCreateAgentServices.mockResolvedValue(mockServices);
    });

    describe('Constructor Patterns', () => {
        test('should create agent with config (new pattern)', () => {
            const agent = new SaikiAgent(mockConfig);

            expect(agent.getIsStarted()).toBe(false);
            expect(agent.getIsStopped()).toBe(false);
        });
    });

    describe('start() Method', () => {
        test('should start successfully with valid config', async () => {
            const agent = new SaikiAgent(mockConfig);

            await agent.start();

            expect(agent.getIsStarted()).toBe(true);
            expect(agent.getIsStopped()).toBe(false);
            expect(mockCreateAgentServices).toHaveBeenCalledWith(mockConfig, undefined, undefined);
        });

        test('should start with overrides and options', async () => {
            const agent = new SaikiAgent(
                mockConfig,
                { model: 'gpt-4' },
                { connectionMode: 'strict' }
            );

            await agent.start();

            expect(mockCreateAgentServices).toHaveBeenCalledWith(
                mockConfig,
                { model: 'gpt-4' },
                { connectionMode: 'strict' }
            );
        });

        test('should throw error when starting twice', async () => {
            const agent = new SaikiAgent(mockConfig);

            await agent.start();

            await expect(agent.start()).rejects.toThrow('Agent is already started');
        });

        test('should handle start failure gracefully', async () => {
            const agent = new SaikiAgent(mockConfig);
            mockCreateAgentServices.mockRejectedValue(new Error('Service initialization failed'));

            await expect(agent.start()).rejects.toThrow('Service initialization failed');
            expect(agent.getIsStarted()).toBe(false);
        });
    });

    describe('stop() Method', () => {
        test('should stop successfully after start', async () => {
            const agent = new SaikiAgent(mockConfig);
            await agent.start();

            await agent.stop();

            expect(agent.getIsStarted()).toBe(false);
            expect(agent.getIsStopped()).toBe(true);
            expect(mockServices.sessionManager.cleanup).toHaveBeenCalled();
            expect(mockServices.clientManager.disconnectAll).toHaveBeenCalled();
            expect(mockServices.storageManager.disconnect).toHaveBeenCalled();
        });

        test('should throw error when stopping before start', async () => {
            const agent = new SaikiAgent(mockConfig);

            await expect(agent.stop()).rejects.toThrow(
                'Agent must be started before it can be stopped'
            );
        });

        test('should warn when stopping twice but not throw', async () => {
            const agent = new SaikiAgent(mockConfig);
            await agent.start();
            await agent.stop();

            // Second stop should not throw but should warn
            await expect(agent.stop()).resolves.toBeUndefined();
        });

        test('should handle partial cleanup failures gracefully', async () => {
            const agent = new SaikiAgent(mockConfig);
            await agent.start();

            // Make session cleanup fail
            mockServices.sessionManager.cleanup.mockRejectedValue(
                new Error('Session cleanup failed')
            );

            // Should not throw, but should still mark as stopped
            await expect(agent.stop()).resolves.toBeUndefined();
            expect(agent.getIsStopped()).toBe(true);

            // Should still try to clean other services
            expect(mockServices.clientManager.disconnectAll).toHaveBeenCalled();
            expect(mockServices.storageManager.disconnect).toHaveBeenCalled();
        });
    });

    describe('Method Access Control', () => {
        const testMethods = [
            { name: 'run', args: ['test message'] },
            { name: 'createSession', args: [] },
            { name: 'getSession', args: ['session-id'] },
            { name: 'listSessions', args: [] },
            { name: 'deleteSession', args: ['session-id'] },
            { name: 'resetConversation', args: [] },
            { name: 'getCurrentLLMConfig', args: [] },
            { name: 'switchLLM', args: [{ model: 'gpt-4' }] },
            { name: 'connectMcpServer', args: ['test', { type: 'stdio', command: 'test' }] },
            { name: 'getAllMcpTools', args: [] },
        ];

        test.each(testMethods)('$name should throw before start()', async ({ name, args }) => {
            const agent = new SaikiAgent(mockConfig);

            let thrownError: Error | undefined;
            try {
                const method = agent[name as keyof SaikiAgent] as Function;
                await method.apply(agent, args);
            } catch (error) {
                thrownError = error as Error;
            }

            expect(thrownError).toBeDefined();
            expect(thrownError?.message).toBe(
                'Agent must be started before use. Call agent.start() first.'
            );
        });

        test.each(testMethods)('$name should throw after stop()', async ({ name, args }) => {
            const agent = new SaikiAgent(mockConfig);
            await agent.start();
            await agent.stop();

            let thrownError: Error | undefined;
            try {
                const method = agent[name as keyof SaikiAgent] as Function;
                await method.apply(agent, args);
            } catch (error) {
                thrownError = error as Error;
            }

            expect(thrownError).toBeDefined();
            expect(thrownError?.message).toBe('Agent has been stopped and cannot be used');
        });

        test('getCurrentSessionId should work without start() (read-only)', () => {
            const agent = new SaikiAgent(mockConfig);

            expect(() => agent.getCurrentSessionId()).not.toThrow();
        });

        test('getIsStarted and getIsStopped should work without start() (read-only)', () => {
            const agent = new SaikiAgent(mockConfig);

            expect(() => agent.getIsStarted()).not.toThrow();
            expect(() => agent.getIsStopped()).not.toThrow();
        });
    });

    describe('Integration Tests', () => {
        test('should handle complete lifecycle without errors', async () => {
            const agent = new SaikiAgent(mockConfig);

            // Initial state
            expect(agent.getIsStarted()).toBe(false);
            expect(agent.getIsStopped()).toBe(false);

            // Start
            await agent.start();
            expect(agent.getIsStarted()).toBe(true);
            expect(agent.getIsStopped()).toBe(false);

            // Use agent (mock a successful operation)
            expect(agent.getCurrentLLMConfig()).toBeDefined();

            // Stop
            await agent.stop();
            expect(agent.getIsStarted()).toBe(false);
            expect(agent.getIsStopped()).toBe(true);
        });

        test('should handle resource cleanup in correct order', async () => {
            const agent = new SaikiAgent(mockConfig);
            await agent.start();

            const cleanupOrder: string[] = [];

            mockServices.sessionManager.cleanup.mockImplementation(() => {
                cleanupOrder.push('sessions');
                return Promise.resolve();
            });

            mockServices.clientManager.disconnectAll.mockImplementation(() => {
                cleanupOrder.push('clients');
                return Promise.resolve();
            });

            mockServices.storageManager.disconnect.mockImplementation(() => {
                cleanupOrder.push('storage');
                return Promise.resolve();
            });

            await agent.stop();

            expect(cleanupOrder).toEqual(['sessions', 'clients', 'storage']);
        });
    });
});
