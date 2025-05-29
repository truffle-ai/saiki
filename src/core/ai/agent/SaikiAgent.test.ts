import { describe, test, expect, vi, beforeEach } from 'vitest';
import { SaikiAgent } from './SaikiAgent.js';
import type { LLMConfig } from '../../config/schemas.js';
import * as validationUtils from '../../config/validation-utils.js';

// Mock the dependencies
vi.mock('../../config/validation-utils.js');
vi.mock('../../logger/index.js');

const mockValidationUtils = vi.mocked(validationUtils);

describe('SaikiAgent.switchLLM', () => {
    let agent: SaikiAgent;
    let mockStateManager: any;
    let mockSessionManager: any;
    let mockEventBus: any;
    let mockClientManager: any;
    let mockPromptManager: any;
    let mockConfigManager: any;

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
                runtime: { debugMode: false, logLevel: 'info' },
            }),
            getEffectiveState: vi.fn().mockReturnValue({
                llm: mockLLMConfig,
            }),
            updateLLM: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
            updateLLMConfig: vi.fn().mockResolvedValue(undefined),
            validateLLMUpdate: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
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
            switchLLM: vi.fn().mockResolvedValue({ success: true, warnings: [] }),
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

        // Create SaikiAgent with all required services
        agent = new SaikiAgent({
            clientManager: mockClientManager,
            promptManager: mockPromptManager,
            agentEventBus: mockEventBus,
            configManager: mockConfigManager,
            stateManager: mockStateManager,
            sessionManager: mockSessionManager,
        });

        // Mock the validation function
        mockValidationUtils.updateAndValidateLLMConfig.mockImplementation(
            async (updates, currentConfig) => {
                return {
                    config: {
                        ...mockLLMConfig,
                        ...updates, // Apply the updates so router is properly set
                    },
                    isValid: true,
                    errors: [],
                    warnings: [],
                };
            }
        );
    });

    describe('Basic Validation', () => {
        test('should require model parameter', async () => {
            await expect(agent.switchLLM()).rejects.toThrow('Model must be specified');
        });

        test('should throw on validation failure', async () => {
            mockValidationUtils.updateAndValidateLLMConfig.mockResolvedValue({
                isValid: false,
                config: mockLLMConfig,
                errors: ['Invalid model'],
                warnings: [],
            });

            await expect(agent.switchLLM('openai', 'invalid-model')).rejects.toThrow(
                'LLM configuration validation failed: Invalid model'
            );
        });

        test('should throw on state manager validation failure', async () => {
            mockStateManager.updateLLM.mockReturnValue({
                isValid: false,
                errors: ['State update failed'],
                warnings: [],
            });

            await expect(agent.switchLLM('openai', 'gpt-4')).rejects.toThrow(
                'State manager validation failed: State update failed'
            );
        });
    });

    describe('Default Session Switch', () => {
        test('should switch LLM for default session', async () => {
            const result = await agent.switchLLM('openai', 'gpt-3.5-turbo');

            expect(result.success).toBe(true);
            expect(result.config.model).toBe('gpt-3.5-turbo');
            expect(result.message).toContain('Successfully switched to openai/gpt-3.5-turbo');
            expect(mockSessionManager.getDefaultSession().switchLLM).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gpt-3.5-turbo',
                    router: 'vercel',
                })
            );
            expect(mockEventBus.emit).toHaveBeenCalledWith('saiki:llmSwitched', {
                newConfig: expect.objectContaining({ model: 'gpt-3.5-turbo' }),
                router: 'vercel',
                historyRetained: true,
                sessionId: 'default',
            });
        });

        test('should use specified router', async () => {
            await agent.switchLLM('openai', 'gpt-4', undefined, 'in-built');

            expect(mockSessionManager.getDefaultSession().switchLLM).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gpt-4',
                    router: 'in-built',
                })
            );
        });

        test('should include warnings in response', async () => {
            mockValidationUtils.updateAndValidateLLMConfig.mockResolvedValue({
                config: { ...mockLLMConfig, model: 'gpt-4o' },
                isValid: true,
                errors: [],
                warnings: ['Config warning'],
            });

            mockStateManager.updateLLM.mockReturnValue({
                isValid: true,
                errors: [],
                warnings: ['State warning'],
            });

            const result = await agent.switchLLM('openai', 'gpt-3.5-turbo');

            expect(result.warnings).toEqual(['Config warning', 'State warning']);
        });
    });

    describe('Specific Session Switch', () => {
        test('should switch LLM for specific session', async () => {
            const result = await agent.switchLLM(
                'openai',
                'gpt-3.5-turbo',
                undefined,
                undefined,
                undefined,
                'session1'
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('for session session1');
            expect(mockSessionManager.getSession).toHaveBeenCalledWith('session1');
            expect(mockEventBus.emit).toHaveBeenCalledWith('saiki:llmSwitched', {
                newConfig: expect.objectContaining({ model: 'gpt-3.5-turbo' }),
                router: 'vercel',
                historyRetained: true,
                sessionId: 'session1',
            });
        });

        test('should throw if session not found', async () => {
            mockSessionManager.getSession.mockReturnValue(null);

            await expect(
                agent.switchLLM('openai', 'gpt-4', undefined, undefined, undefined, 'nonexistent')
            ).rejects.toThrow('Session nonexistent not found');
        });

        test('should use session-specific state', async () => {
            const sessionLLMConfig = { ...mockLLMConfig, model: 'session-model' };
            mockStateManager.getEffectiveState.mockReturnValue({ llm: sessionLLMConfig });

            await agent.switchLLM('openai', 'gpt-4', undefined, undefined, undefined, 'session1');

            expect(mockStateManager.getEffectiveState).toHaveBeenCalledWith('session1');
            expect(mockValidationUtils.updateAndValidateLLMConfig).toHaveBeenCalledWith(
                expect.objectContaining({ provider: 'openai', model: 'gpt-4' }),
                sessionLLMConfig
            );
        });
    });

    describe('All Sessions Switch', () => {
        test('should switch LLM for all sessions successfully', async () => {
            const mockSession1 = { id: 'session1', switchLLM: vi.fn() };
            const mockSession2 = { id: 'session2', switchLLM: vi.fn() };

            mockSessionManager.getSession
                .mockReturnValueOnce(mockSession1)
                .mockReturnValueOnce(mockSession2);

            const result = await agent.switchLLM(
                'openai',
                'gpt-3.5-turbo',
                undefined,
                undefined,
                undefined,
                '*'
            );

            expect(result.success).toBe(true);
            expect(mockSession1.switchLLM).toHaveBeenCalled();
            expect(mockSession2.switchLLM).toHaveBeenCalled();
            expect(mockEventBus.emit).toHaveBeenCalledWith('saiki:llmSwitched', {
                newConfig: expect.objectContaining({ model: 'gpt-3.5-turbo' }),
                router: 'vercel',
                historyRetained: true,
                sessionIds: ['session1', 'session2'],
            });
        });

        test('should handle failed sessions gracefully', async () => {
            const mockSession1 = { id: 'session1', switchLLM: vi.fn() };
            const mockSession2 = { id: 'session2', switchLLM: vi.fn() };

            mockSessionManager.getSession
                .mockReturnValueOnce(mockSession1)
                .mockReturnValueOnce(mockSession2);

            // Make session2 fail validation
            mockStateManager.updateLLM
                .mockReturnValueOnce({ isValid: true, errors: [], warnings: [] }) // for default session
                .mockReturnValueOnce({ isValid: true, errors: [], warnings: [] }) // for session1
                .mockReturnValueOnce({ isValid: false, errors: ['Session2 failed'], warnings: [] }); // for session2

            const result = await agent.switchLLM(
                'openai',
                'gpt-3.5-turbo',
                undefined,
                undefined,
                undefined,
                '*'
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('1 sessions failed');
            expect(result.warnings).toContain('Failed to switch LLM for sessions: session2');
            expect(mockEventBus.emit).toHaveBeenCalledWith('saiki:llmSwitched', {
                newConfig: expect.objectContaining({ model: 'gpt-3.5-turbo' }),
                router: 'vercel',
                historyRetained: true,
                sessionIds: ['session1'],
            });
        });

        test('should handle session validation failures', async () => {
            const mockSession1 = { id: 'session1', switchLLM: vi.fn() };
            const mockSession2 = { id: 'session2', switchLLM: vi.fn() };

            // Reset the mock and set up specific return values
            mockSessionManager.getSession.mockReset();
            mockSessionManager.getSession
                .mockReturnValueOnce(mockSession1)
                .mockReturnValueOnce(mockSession2);

            // Reset the updateLLM mock and set up specific return values
            mockStateManager.updateLLM.mockReset();
            mockStateManager.updateLLM
                .mockReturnValueOnce({ isValid: true, errors: [], warnings: [] }) // for default session
                .mockReturnValueOnce({ isValid: true, errors: [], warnings: [] }) // for session1
                .mockReturnValueOnce({
                    isValid: false,
                    errors: ['Validation failed'],
                    warnings: [],
                }); // for session2

            const result = await agent.switchLLM(
                'openai',
                'gpt-3.5-turbo',
                undefined,
                undefined,
                undefined,
                '*'
            );

            expect(result.success).toBe(true);
            expect(result.warnings).toEqual(['Failed to switch LLM for sessions: session2']);
            expect(mockSession1.switchLLM).toHaveBeenCalled();
            expect(mockSession2.switchLLM).not.toHaveBeenCalled();
        });

        test('should handle missing sessions', async () => {
            // Reset the mocks and make them return empty/null values
            mockSessionManager.getSession.mockReset();
            mockSessionManager.getSession.mockReturnValue(null);
            mockSessionManager.listSessions.mockReturnValue([]); // No sessions exist

            const result = await agent.switchLLM(
                'openai',
                'gpt-3.5-turbo',
                undefined,
                undefined,
                undefined,
                '*'
            );

            expect(result.success).toBe(true);
            expect(mockEventBus.emit).toHaveBeenCalledWith('saiki:llmSwitched', {
                newConfig: expect.objectContaining({ model: 'gpt-3.5-turbo' }),
                router: 'vercel',
                historyRetained: true,
                sessionIds: [],
            });
        });
    });

    describe('Parameter Handling', () => {
        test('should pass all parameters to validation', async () => {
            await agent.switchLLM(
                'google',
                'gemini-pro',
                'custom-key',
                'in-built',
                'https://custom.api.com'
            );

            expect(mockValidationUtils.updateAndValidateLLMConfig).toHaveBeenCalledWith(
                {
                    provider: 'google',
                    model: 'gemini-pro',
                    apiKey: 'custom-key',
                    router: 'in-built',
                    baseURL: 'https://custom.api.com',
                },
                mockLLMConfig
            );
        });

        test('should handle partial parameters', async () => {
            await agent.switchLLM(undefined, 'gpt-3.5-turbo');

            expect(mockValidationUtils.updateAndValidateLLMConfig).toHaveBeenCalledWith(
                {
                    model: 'gpt-3.5-turbo',
                },
                mockLLMConfig
            );
        });

        test('should use default router when not specified', async () => {
            await agent.switchLLM('openai', 'gpt-4');

            expect(mockSessionManager.getDefaultSession().switchLLM).toHaveBeenCalledWith(
                expect.objectContaining({
                    router: 'vercel', // Default router
                })
            );
        });
    });

    describe('Warning Collection', () => {
        test('should collect and deduplicate warnings', async () => {
            mockValidationUtils.updateAndValidateLLMConfig.mockResolvedValue({
                isValid: true,
                config: { ...mockLLMConfig, model: 'gpt-3.5-turbo' },
                errors: [],
                warnings: ['Config warning', 'Duplicate warning'],
            });

            mockStateManager.updateLLM.mockReturnValue({
                isValid: true,
                errors: [],
                warnings: ['State warning', 'Duplicate warning'], // Duplicate should be removed
            });

            const result = await agent.switchLLM('openai', 'gpt-3.5-turbo');

            expect(result.warnings).toEqual([
                'Config warning',
                'Duplicate warning',
                'State warning',
            ]);
        });

        test('should return undefined warnings when none exist', async () => {
            const result = await agent.switchLLM('openai', 'gpt-3.5-turbo');

            expect(result.warnings).toBeUndefined();
        });
    });

    describe('Error Handling', () => {
        test('should re-throw validation errors', async () => {
            const validationError = new Error('Validation failed');
            mockValidationUtils.updateAndValidateLLMConfig.mockRejectedValue(validationError);

            await expect(agent.switchLLM('openai', 'gpt-4')).rejects.toThrow('Validation failed');
        });

        test('should handle state manager errors', async () => {
            const stateError = new Error('State update failed');
            mockStateManager.updateLLM.mockImplementation(() => {
                throw stateError;
            });

            await expect(agent.switchLLM('openai', 'gpt-4')).rejects.toThrow('State update failed');
        });

        test('should handle session manager errors', async () => {
            const sessionError = new Error('Session error');
            mockSessionManager.getDefaultSession.mockImplementation(() => {
                throw sessionError;
            });

            await expect(agent.switchLLM('openai', 'gpt-4')).rejects.toThrow('Session error');
        });
    });
});
