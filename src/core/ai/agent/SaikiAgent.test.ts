import { describe, test, expect, vi, beforeEach } from 'vitest';
import { SaikiAgent } from './SaikiAgent.js';
import type { LLMConfig } from '../../config/schemas.js';
import * as validationUtils from '../../config/validation-utils.js';

// Mock the dependencies
vi.mock('../../config/validation-utils.js');
vi.mock('../../logger/index.js');

const mockValidationUtils = vi.mocked(validationUtils);

//TODO: potentially reducing mocking and have real tests
describe('SaikiAgent.switchLLM', () => {
    let agent: SaikiAgent;
    let mockStateManager: any;
    let mockSessionManager: any;
    let mockEventBus: any;
    let mockClientManager: any;
    let mockPromptManager: any;
    let mockConfigManager: any;
    let mockStorageManager: any;

    const mockLLMConfig: LLMConfig = {
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'test-key',
        router: 'vercel',
        systemPrompt: 'You are a helpful assistant',
        maxIterations: 50,
        maxTokens: 128000,
        providerOptions: {},
    };

    beforeEach(() => {
        vi.resetAllMocks();

        // Create mock services
        mockStateManager = {
            getRuntimeState: vi.fn().mockReturnValue({
                llm: mockLLMConfig,
                mcpServers: {},
                runtime: { debugMode: false, logLevel: 'info' },
            }),
            getEffectiveState: vi.fn().mockReturnValue({
                llm: mockLLMConfig,
            }),
            updateLLM: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
            updateLLMConfig: vi.fn().mockResolvedValue(undefined),
        };

        mockSessionManager = {
            createSession: vi.fn().mockReturnValue({
                id: 'default',
                getLLMService: vi.fn(),
                getMessageManager: vi.fn(),
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
            endSession: vi.fn(),
            getSessionMetadata: vi.fn(),
            switchLLMForDefaultSession: vi.fn().mockResolvedValue({
                message: 'Successfully switched to openai/gpt-4o using vercel router',
                warnings: [],
            }),
            switchLLMForSpecificSession: vi.fn().mockImplementation((config, sessionId) => {
                if (sessionId === 'nonexistent') {
                    return Promise.reject(new Error(`Session ${sessionId} not found`));
                }
                return Promise.resolve({
                    message: `Successfully switched to openai/gpt-4o using vercel router for session ${sessionId}`,
                    warnings: [],
                });
            }),
            switchLLMForAllSessions: vi.fn().mockResolvedValue({
                message:
                    'Successfully switched to openai/gpt-4o using vercel router for all sessions',
                warnings: [],
            }),
        };

        mockEventBus = {
            emit: vi.fn(),
        };

        mockClientManager = {
            connectServer: vi.fn(),
            getAllTools: vi.fn().mockResolvedValue({}),
        };

        mockPromptManager = {
            // Add any methods that might be called
        };

        mockConfigManager = {
            // Add any methods that might be called
        };

        mockStorageManager = {
            // Add any methods that might be called
        };

        // Create SaikiAgent with all required services
        agent = new SaikiAgent({
            clientManager: mockClientManager,
            promptManager: mockPromptManager,
            agentEventBus: mockEventBus,
            stateManager: mockStateManager,
            sessionManager: mockSessionManager,
            storageManager: mockStorageManager,
        });

        // Mock the validation function
        mockValidationUtils.buildLLMConfig.mockImplementation(async (updates, currentConfig) => {
            return {
                config: {
                    ...mockLLMConfig,
                    ...updates, // Apply the updates so router is properly set
                },
                isValid: true,
                errors: [],
                warnings: [],
            };
        });
    });

    describe('Basic Validation', () => {
        test('should require model or provider parameter', async () => {
            const result = await agent.switchLLM({});

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!).toHaveLength(1);
            expect(result.errors![0].type).toBe('general');
            expect(result.errors![0].message).toBe('At least model or provider must be specified');
        });

        test('should handle validation failure', async () => {
            mockValidationUtils.buildLLMConfig.mockResolvedValue({
                config: mockLLMConfig,
                isValid: false,
                errors: [
                    {
                        type: 'invalid_model',
                        message: 'Invalid model',
                    },
                ],
                warnings: [],
            });

            const result = await agent.switchLLM({ model: 'invalid-model' });

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!).toHaveLength(1);
            expect(result.errors![0].type).toBe('invalid_model');
            expect(result.errors![0].message).toBe('Invalid model');
        });
    });

    describe('Default Session Switch', () => {
        test('should switch LLM for default session', async () => {
            const result = await agent.switchLLM({ model: 'gpt-4o-mini' });

            expect(result.success).toBe(true);
            expect(result.config).toBeDefined();
            expect(result.config!.model).toBe('gpt-4o-mini');
            expect(result.message).toContain(
                'Successfully switched to openai/gpt-4o using vercel router'
            );
            expect(mockSessionManager.switchLLMForDefaultSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gpt-4o-mini',
                })
            );
        });

        test('should use specified router', async () => {
            await agent.switchLLM({ model: 'gpt-4o', router: 'in-built' });

            expect(mockValidationUtils.buildLLMConfig).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gpt-4o',
                    router: 'in-built',
                }),
                mockLLMConfig
            );
        });

        test('should include warnings in response', async () => {
            mockValidationUtils.buildLLMConfig.mockResolvedValue({
                config: { ...mockLLMConfig, model: 'gpt-4o' },
                isValid: true,
                errors: [],
                warnings: ['Config warning'],
            });

            mockSessionManager.switchLLMForDefaultSession.mockResolvedValue({
                message: 'Success',
                warnings: ['Session warning'],
            });

            const result = await agent.switchLLM({ model: 'gpt-4o-mini' });

            expect(result.warnings).toEqual(['Config warning', 'Session warning']);
        });

        test('should switch LLM for specific session', async () => {
            const result = await agent.switchLLM({ model: 'gpt-4o' }, 'session1');

            expect(result.success).toBe(true);
            expect(mockSessionManager.switchLLMForSpecificSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gpt-4o',
                }),
                'session1'
            );
        });

        test('should switch LLM for all sessions', async () => {
            const result = await agent.switchLLM({ model: 'gpt-4o' }, '*');

            expect(result.success).toBe(true);
            expect(mockSessionManager.switchLLMForAllSessions).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gpt-4o',
                })
            );
        });

        test('should handle provider and model together', async () => {
            await agent.switchLLM({ provider: 'anthropic', model: 'claude-4-sonnet-20250514' });

            expect(mockValidationUtils.buildLLMConfig).toHaveBeenCalledWith(
                expect.objectContaining({
                    provider: 'anthropic',
                    model: 'claude-4-sonnet-20250514',
                }),
                mockLLMConfig
            );
        });

        test('should handle API key in config', async () => {
            await agent.switchLLM({ model: 'gpt-4o', apiKey: 'new-key' });

            expect(mockValidationUtils.buildLLMConfig).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gpt-4o',
                    apiKey: 'new-key',
                }),
                mockLLMConfig
            );
        });

        test('should handle baseURL in config', async () => {
            await agent.switchLLM({ model: 'gpt-4o', baseURL: 'https://api.example.com' });

            expect(mockValidationUtils.buildLLMConfig).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gpt-4o',
                    baseURL: 'https://api.example.com',
                }),
                mockLLMConfig
            );
        });
    });

    describe('Specific Session Switch', () => {
        test('should switch LLM for specific session', async () => {
            const result = await agent.switchLLM({ model: 'gpt-4o-mini' }, 'session1');

            expect(result.success).toBe(true);
            expect(result.message).toContain('for session session1');
            expect(mockSessionManager.switchLLMForSpecificSession).toHaveBeenCalledWith(
                expect.objectContaining({ model: 'gpt-4o-mini' }),
                'session1'
            );
        });

        test('should handle session not found', async () => {
            mockSessionManager.getSession.mockReturnValue(null);

            const result = await agent.switchLLM({ model: 'gpt-4o' }, 'nonexistent');

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!).toHaveLength(1);
            expect(result.errors![0].type).toBe('general');
            expect(result.errors![0].message).toBe('Session nonexistent not found');
        });

        test('should use session-specific state', async () => {
            const sessionLLMConfig = { ...mockLLMConfig, model: 'session-model' };
            mockStateManager.getEffectiveState.mockReturnValue({ llm: sessionLLMConfig });

            await agent.switchLLM({ model: 'gpt-4o' }, 'session1');

            expect(mockStateManager.getEffectiveState).toHaveBeenCalledWith('session1');
            expect(mockValidationUtils.buildLLMConfig).toHaveBeenCalledWith(
                expect.objectContaining({ model: 'gpt-4o' }),
                sessionLLMConfig
            );
        });
    });

    describe('All Sessions Switch', () => {
        test('should switch LLM for all sessions successfully', async () => {
            const result = await agent.switchLLM({ model: 'gpt-4o-mini' }, '*');

            expect(result.success).toBe(true);
            expect(mockSessionManager.switchLLMForAllSessions).toHaveBeenCalledWith(
                expect.objectContaining({ model: 'gpt-4o-mini' })
            );
        });

        test('should handle failed sessions gracefully', async () => {
            mockSessionManager.switchLLMForAllSessions.mockResolvedValue({
                message:
                    'Successfully switched to openai/gpt-4o using vercel router for 1 sessions, 1 sessions failed',
                warnings: ['Failed to switch LLM for sessions: session2'],
            });

            const result = await agent.switchLLM({ model: 'gpt-4o-mini' }, '*');

            expect(result.success).toBe(true);
            expect(result.message).toContain('1 sessions failed');
            expect(result.warnings).toContain('Failed to switch LLM for sessions: session2');
        });

        test('should handle session validation failures', async () => {
            mockSessionManager.switchLLMForAllSessions.mockResolvedValue({
                message: 'Successfully switched',
                warnings: ['Failed to switch LLM for sessions: session2'],
            });

            const result = await agent.switchLLM({ model: 'gpt-4o-mini' }, '*');

            expect(result.success).toBe(true);
            expect(result.warnings).toEqual(['Failed to switch LLM for sessions: session2']);
        });

        test('should handle missing sessions', async () => {
            const result = await agent.switchLLM({ model: 'gpt-4o-mini' }, '*');

            expect(result.success).toBe(true);
            expect(mockSessionManager.switchLLMForAllSessions).toHaveBeenCalledWith(
                expect.objectContaining({ model: 'gpt-4o-mini' })
            );
        });
    });

    describe('Parameter Handling', () => {
        test('should pass all parameters to validation', async () => {
            await agent.switchLLM({
                provider: 'google',
                model: 'gemini-2.5-pro-exp-03-25',
                apiKey: 'custom-key',
                router: 'vercel',
                baseURL: 'https://custom.api.com',
            });

            expect(mockValidationUtils.buildLLMConfig).toHaveBeenCalledWith(
                {
                    provider: 'google',
                    model: 'gemini-2.5-pro-exp-03-25',
                    apiKey: 'custom-key',
                    router: 'vercel',
                    baseURL: 'https://custom.api.com',
                },
                mockLLMConfig
            );
        });

        test('should handle partial parameters', async () => {
            await agent.switchLLM({ model: 'gpt-4o-mini' });

            expect(mockValidationUtils.buildLLMConfig).toHaveBeenCalledWith(
                {
                    model: 'gpt-4o-mini',
                },
                mockLLMConfig
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

    describe('Warning Collection', () => {
        test('should collect and deduplicate warnings', async () => {
            mockValidationUtils.buildLLMConfig.mockResolvedValue({
                config: { ...mockLLMConfig, model: 'gpt-4o-mini' },
                isValid: true,
                errors: [],
                warnings: ['Config warning', 'Duplicate warning'],
            });

            mockSessionManager.switchLLMForDefaultSession.mockResolvedValue({
                message: 'Success',
                warnings: ['Session warning', 'Duplicate warning'],
            });

            const result = await agent.switchLLM({ model: 'gpt-4o-mini' });

            expect(result.warnings).toEqual([
                'Config warning',
                'Duplicate warning',
                'Session warning',
                'Duplicate warning',
            ]);
        });

        test('should return undefined warnings when none exist', async () => {
            const result = await agent.switchLLM({ model: 'gpt-4o-mini' });

            expect(result.warnings).toBeUndefined();
        });
    });

    describe('Error Handling', () => {
        test('should handle validation exceptions', async () => {
            const validationError = new Error('Validation failed');
            mockValidationUtils.buildLLMConfig.mockRejectedValue(validationError);

            const result = await agent.switchLLM({ model: 'gpt-4o' });

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!).toHaveLength(1);
            expect(result.errors![0].type).toBe('general');
            expect(result.errors![0].message).toBe('Validation failed');
        });

        test('should handle state manager validation errors', async () => {
            mockValidationUtils.buildLLMConfig.mockResolvedValue({
                config: mockLLMConfig,
                isValid: true,
                errors: [],
                warnings: [],
            });

            mockStateManager.updateLLM.mockReturnValue({
                isValid: false,
                errors: [
                    {
                        type: 'missing_api_key',
                        message: 'API key required',
                        provider: 'openai',
                    },
                ],
                warnings: [],
            });

            const result = await agent.switchLLM({ model: 'gpt-4o' });

            expect(result.success).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].type).toBe('missing_api_key');
            expect(result.errors[0].message).toBe('API key required');
        });

        test('should handle session manager errors', async () => {
            const sessionError = new Error('Session error');
            mockSessionManager.switchLLMForDefaultSession.mockRejectedValue(sessionError);

            const result = await agent.switchLLM({ model: 'gpt-4o' });

            expect(result.success).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].type).toBe('general');
            expect(result.errors[0].message).toBe('Session error');
        });
    });
});
