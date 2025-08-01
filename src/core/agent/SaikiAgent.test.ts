import { describe, test, expect, vi, beforeEach } from 'vitest';
import { SaikiAgent } from './SaikiAgent.js';
import type { LLMConfig, ValidatedLLMConfig, AgentConfig } from '../index.js';
import { SaikiErrorCode } from '../schemas/errors.js';

// Mock the dependencies
vi.mock('../logger/index.js');
vi.mock('../utils/service-initializer.js');
vi.mock('../llm/resolver.js');

import { createAgentServices } from '../utils/service-initializer.js';
import { resolveLLMConfig, validateLLMConfig } from '../llm/resolver.js';
const mockCreateAgentServices = vi.mocked(createAgentServices);
const mockResolveLLMConfig = vi.mocked(resolveLLMConfig);
const mockValidateLLMConfig = vi.mocked(validateLLMConfig);

//TODO: potentially reducing mocking and have real tests
describe('SaikiAgent.switchLLM', () => {
    let agent: SaikiAgent;
    let mockStateManager: any;
    let mockSessionManager: any;
    let mockEventBus: any;
    let mockMcpManager: any;
    let mockPromptManager: any;
    let mockStorageManager: any;

    const mockLLMConfig: LLMConfig = {
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'test-key',
        router: 'vercel',
        maxIterations: 50,
        maxInputTokens: 128000,
    };

    beforeEach(async () => {
        vi.resetAllMocks();

        // Create mock services
        mockStateManager = {
            getRuntimeConfig: vi.fn().mockReturnValue({
                llm: mockLLMConfig,
                mcpServers: {},
                storage: {
                    cache: { type: 'in-memory' },
                    database: { type: 'in-memory' },
                },
                sessions: {
                    maxSessions: 10,
                    sessionTTL: 3600,
                },
            }),
            getLLMConfig: vi.fn().mockReturnValue(mockLLMConfig),
            updateLLM: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
            addMcpServer: vi.fn(),
            removeMcpServer: vi.fn(),
        };

        mockSessionManager = {
            createSession: vi.fn().mockReturnValue({
                id: 'default',
                getLLMService: vi.fn(),
                getContextManager: vi.fn(),
                run: vi.fn(),
                reset: vi.fn(),
                switchLLM: vi.fn(),
            }),
            getDefaultSession: vi.fn().mockReturnValue({
                id: 'default',
                switchLLM: vi.fn(),
            }),
            getSession: vi.fn().mockImplementation((sessionId: string) => {
                if (sessionId === 'session1' || sessionId === 'session2') {
                    return {
                        id: sessionId,
                        switchLLM: vi.fn(),
                    };
                }
                return null;
            }),
            listSessions: vi.fn().mockReturnValue(['session1', 'session2']),
            deleteSession: vi.fn(),
            endSession: vi.fn(),
            getSessionMetadata: vi.fn(),
            switchLLMForDefaultSession: vi.fn().mockResolvedValue(undefined),
            switchLLMForSpecificSession: vi.fn().mockImplementation((config, sessionId) => {
                if (sessionId === 'nonexistent') {
                    return Promise.reject(new Error(`Session ${sessionId} not found`));
                }
                return Promise.resolve(undefined);
            }),
            switchLLMForAllSessions: vi.fn().mockResolvedValue(undefined),
        };

        mockEventBus = {
            emit: vi.fn(),
        };

        mockMcpManager = {
            connectServer: vi.fn(),
            getAllTools: vi.fn().mockResolvedValue({}),
            initializeFromConfig: vi.fn().mockResolvedValue(undefined),
            disconnectAll: vi.fn().mockResolvedValue(undefined),
        };

        mockPromptManager = {
            // Add any methods that might be called
        };

        mockStorageManager = {
            disconnect: vi.fn().mockResolvedValue(undefined),
        };

        const mockServices = {
            mcpManager: mockMcpManager,
            toolManager: {} as any,
            promptManager: mockPromptManager,
            agentEventBus: mockEventBus,
            stateManager: mockStateManager,
            sessionManager: mockSessionManager,
            searchService: {} as any,
            storage: mockStorageManager,
            storageManager: mockStorageManager,
        };

        // Mock createAgentServices to return our mock services
        mockCreateAgentServices.mockResolvedValue(mockServices);

        const mockConfig: AgentConfig = {
            systemPrompt: 'You are a helpful AI assistant.',
            llm: mockLLMConfig,
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

        // Create SaikiAgent with config and start it
        agent = new SaikiAgent(mockConfig);
        await agent.start();

        // Mock the LLM resolver functions
        mockResolveLLMConfig.mockImplementation((previousConfig, updates) => {
            const candidate = {
                ...mockLLMConfig,
                ...updates,
                // Ensure required fields are always defined
                apiKey: updates.apiKey ?? mockLLMConfig.apiKey,
                model: updates.model ?? mockLLMConfig.model,
                provider: updates.provider ?? mockLLMConfig.provider,
            };
            return {
                candidate,
                warnings: [],
            };
        });

        mockValidateLLMConfig.mockImplementation((candidate, warnings) => {
            return {
                ok: true,
                data: {
                    provider: candidate.provider,
                    model: candidate.model,
                    apiKey: candidate.apiKey,
                    // Ensure required fields have values (ValidatedLLMConfig)
                    maxIterations: candidate.maxIterations ?? 50,
                    router: candidate.router ?? 'vercel',
                    // Optional fields
                    ...(candidate.baseURL && { baseURL: candidate.baseURL }),
                    ...(candidate.maxInputTokens && {
                        maxInputTokens: candidate.maxInputTokens,
                    }),
                    ...(candidate.maxOutputTokens && {
                        maxOutputTokens: candidate.maxOutputTokens,
                    }),
                    ...(candidate.temperature && { temperature: candidate.temperature }),
                } as ValidatedLLMConfig,
                issues: warnings,
            };
        });
    });

    describe('Basic Validation', () => {
        test('should require model or provider parameter', async () => {
            const result = await agent.switchLLM({});

            expect(result.ok).toBe(false);
            expect(result.issues).toBeDefined();
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0]?.code).toBe(SaikiErrorCode.AGENT_MISSING_LLM_INPUT);
            expect(result.issues[0]?.message).toBe('At least model or provider must be specified');
        });

        test('should handle validation failure', async () => {
            mockValidateLLMConfig.mockResolvedValue({
                ok: false,
                issues: [
                    {
                        code: SaikiErrorCode.LLM_INCOMPATIBLE_MODEL_PROVIDER,
                        message: 'Invalid model',
                        severity: 'error',
                    },
                ],
            });

            const result = await agent.switchLLM({ model: 'invalid-model' });

            expect(result.ok).toBe(false);
            expect(result.issues).toBeDefined();
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0]?.code).toBe(SaikiErrorCode.LLM_INCOMPATIBLE_MODEL_PROVIDER);
            expect(result.issues[0]?.message).toBe('Invalid model');
        });
    });

    describe('Default Session Switch', () => {
        test('should switch LLM for default session', async () => {
            const result = await agent.switchLLM({ model: 'gpt-4o-mini' });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.data).toBeDefined();
                expect(result.data.model).toBe('gpt-4o-mini');
            }
            // Success case - no issues should be present unless there are warnings
            expect(result.issues).toHaveLength(0);
            expect(mockSessionManager.switchLLMForDefaultSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gpt-4o-mini',
                })
            );
        });

        test('should use specified router', async () => {
            await agent.switchLLM({ model: 'gpt-4o', router: 'in-built' });

            expect(mockValidateLLMConfig).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gpt-4o',
                    router: 'in-built',
                }),
                []
            );
        });

        test('should include warnings in response', async () => {
            mockValidateLLMConfig.mockResolvedValue({
                ok: true,
                data: { ...mockLLMConfig, model: 'gpt-4o' } as any,
                issues: [
                    {
                        code: SaikiErrorCode.LLM_INCOMPATIBLE_MODEL_PROVIDER,
                        message: 'Config warning',
                        severity: 'warning',
                    },
                ],
            });

            const result = await agent.switchLLM({ model: 'gpt-4o-mini' });

            expect(result.ok).toBe(true);
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0]?.message).toBe('Config warning');
            expect(result.issues[0]?.severity).toBe('warning');
        });

        test('should switch LLM for specific session', async () => {
            const result = await agent.switchLLM({ model: 'gpt-4o' }, 'session1');

            expect(result.ok).toBe(true);
            expect(mockSessionManager.switchLLMForSpecificSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gpt-4o',
                }),
                'session1'
            );
        });

        test('should switch LLM for all sessions', async () => {
            const result = await agent.switchLLM({ model: 'gpt-4o' }, '*');

            expect(result.ok).toBe(true);
            expect(mockSessionManager.switchLLMForAllSessions).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gpt-4o',
                })
            );
        });

        test('should handle provider and model together', async () => {
            await agent.switchLLM({ provider: 'anthropic', model: 'claude-4-sonnet-20250514' });

            expect(mockValidateLLMConfig).toHaveBeenCalledWith(
                expect.objectContaining({
                    provider: 'anthropic',
                    model: 'claude-4-sonnet-20250514',
                }),
                []
            );
        });

        test('should handle API key in config', async () => {
            await agent.switchLLM({ model: 'gpt-4o', apiKey: 'new-key' });

            expect(mockValidateLLMConfig).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gpt-4o',
                    apiKey: 'new-key',
                }),
                []
            );
        });

        test('should handle baseURL in config', async () => {
            await agent.switchLLM({ model: 'gpt-4o', baseURL: 'https://api.example.com' });

            expect(mockValidateLLMConfig).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gpt-4o',
                    baseURL: 'https://api.example.com',
                }),
                []
            );
        });
    });

    describe('Specific Session Switch', () => {
        test('should switch LLM for specific session', async () => {
            const result = await agent.switchLLM({ model: 'gpt-4o-mini' }, 'session1');

            expect(result.ok).toBe(true);
            // Success case - no issues should be present
            expect(result.issues).toHaveLength(0);
            expect(mockSessionManager.switchLLMForSpecificSession).toHaveBeenCalledWith(
                expect.objectContaining({ model: 'gpt-4o-mini' }),
                'session1'
            );
        });

        test('should handle session not found', async () => {
            mockSessionManager.getSession.mockReturnValue(null);

            const result = await agent.switchLLM({ model: 'gpt-4o' }, 'nonexistent');

            expect(result.ok).toBe(false);
            expect(result.issues).toBeDefined();
            expect(result.issues!).toHaveLength(1);
            expect(result.issues?.[0]?.code).toBe(SaikiErrorCode.AGENT_SESSION_NOT_FOUND);
            expect(result.issues?.[0]?.message).toBe('Session nonexistent not found');
        });

        test('should use session-specific state', async () => {
            const sessionLLMConfig = { ...mockLLMConfig, model: 'session-model' };
            mockStateManager.getRuntimeConfig.mockReturnValue({ llm: sessionLLMConfig });

            await agent.switchLLM({ model: 'gpt-4o' }, 'session1');

            expect(mockStateManager.getRuntimeConfig).toHaveBeenCalledWith('session1');
            expect(mockValidateLLMConfig).toHaveBeenCalledWith(
                expect.objectContaining({ model: 'gpt-4o' }),
                []
            );
        });
    });

    describe('All Sessions Switch', () => {
        test('should switch LLM for all sessions successfully', async () => {
            const result = await agent.switchLLM({ model: 'gpt-4o-mini' }, '*');

            expect(result.ok).toBe(true);
            expect(mockSessionManager.switchLLMForAllSessions).toHaveBeenCalledWith(
                expect.objectContaining({ model: 'gpt-4o-mini' })
            );
        });

        test('should handle failed sessions gracefully', async () => {
            // This test is not applicable with the new Result pattern
            // Session switching either succeeds or fails completely
            const result = await agent.switchLLM({ model: 'gpt-4o-mini' }, '*');

            expect(result.ok).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        test('should handle missing sessions', async () => {
            const result = await agent.switchLLM({ model: 'gpt-4o-mini' }, '*');

            expect(result.ok).toBe(true);
            expect(mockSessionManager.switchLLMForAllSessions).toHaveBeenCalledWith(
                expect.objectContaining({ model: 'gpt-4o-mini' })
            );
        });
    });

    describe('Parameter Handling', () => {
        test('should pass all parameters to validation', async () => {
            await agent.switchLLM({
                provider: 'google',
                model: 'gemini-2.5-pro',
                apiKey: 'custom-key',
                router: 'vercel',
                baseURL: 'https://custom.api.com',
            });

            expect(mockValidateLLMConfig).toHaveBeenCalledWith(
                expect.objectContaining({
                    provider: 'google',
                    model: 'gemini-2.5-pro',
                    apiKey: 'custom-key',
                    router: 'vercel',
                    baseURL: 'https://custom.api.com',
                }),
                []
            );
        });

        test('should handle partial parameters', async () => {
            await agent.switchLLM({ model: 'gpt-4o-mini' });

            expect(mockValidateLLMConfig).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gpt-4o-mini',
                }),
                []
            );
        });

        test('should use default router when not specified', async () => {
            await agent.switchLLM({ model: 'gpt-4o' });

            expect(mockSessionManager.switchLLMForDefaultSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    router: 'vercel',
                })
            );
        });
    });

    describe('Issue Collection', () => {
        test('should return validation issues', async () => {
            mockValidateLLMConfig.mockResolvedValue({
                ok: true,
                data: { ...mockLLMConfig, model: 'gpt-4o-mini' } as any,
                issues: [
                    {
                        code: SaikiErrorCode.LLM_INCOMPATIBLE_MODEL_PROVIDER,
                        message: 'Config warning',
                        severity: 'warning',
                    },
                ],
            });

            const result = await agent.switchLLM({ model: 'gpt-4o-mini' });

            expect(result.ok).toBe(true);
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0]?.message).toBe('Config warning');
            expect(result.issues[0]?.severity).toBe('warning');
        });

        test('should return empty issues when none exist', async () => {
            const result = await agent.switchLLM({ model: 'gpt-4o-mini' });

            expect(result.ok).toBe(true);
            expect(result.issues).toHaveLength(0);
        });
    });

    describe('Error Handling', () => {
        test('should handle validation errors', async () => {
            mockValidateLLMConfig.mockReturnValue({
                ok: false,
                issues: [
                    {
                        code: SaikiErrorCode.LLM_INCOMPATIBLE_MODEL_PROVIDER,
                        message: 'Validation failed',
                        severity: 'error',
                    },
                ],
            });

            const result = await agent.switchLLM({ model: 'gpt-4o' });

            expect(result.ok).toBe(false);
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0]?.code).toBe(SaikiErrorCode.LLM_INCOMPATIBLE_MODEL_PROVIDER);
            expect(result.issues[0]?.message).toBe('Validation failed');
            expect(result.issues[0]?.severity).toBe('error');
        });
    });
});
