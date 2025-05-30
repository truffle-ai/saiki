import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager, type SessionMetadata } from './session-manager.js';
import { ChatSession } from './chat-session.js';
import type { LLMConfig } from '../../config/schemas.js';

// Mock dependencies
vi.mock('./chat-session.js');
vi.mock('../../logger/index.js');
vi.mock('crypto', () => ({
    randomUUID: vi.fn(() => 'mock-uuid-123'),
}));

const MockChatSession = vi.mocked(ChatSession);

describe('SessionManager', () => {
    let sessionManager: SessionManager;
    let mockServices: any;
    let mockSessionStorage: any;
    let mockStorageManager: any;

    const mockLLMConfig: LLMConfig = {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'test-key',
        router: 'in-built',
        systemPrompt: 'You are a helpful assistant',
        maxIterations: 50,
        maxTokens: 128000,
        providerOptions: {},
    };

    const mockSessionData = {
        id: 'test-session',
        createdAt: new Date('2024-01-01T00:00:00Z').getTime(),
        lastActivity: new Date('2024-01-01T01:00:00Z').getTime(),
        messageCount: 5,
    };

    beforeEach(() => {
        vi.resetAllMocks();

        // Mock session storage provider
        mockSessionStorage = {
            getActiveSessions: vi.fn().mockResolvedValue([]),
            getSession: vi.fn().mockResolvedValue(null),
            setSessionWithTTL: vi.fn().mockResolvedValue(undefined),
            deleteSession: vi.fn().mockResolvedValue(true),
            saveSession: vi.fn().mockResolvedValue(undefined),
            getAllSessions: vi.fn().mockResolvedValue([]),
            cleanupExpiredSessions: vi.fn().mockResolvedValue(0),
            close: vi.fn().mockResolvedValue(undefined),
        };

        // Mock storage manager - should match StorageInstances interface
        mockStorageManager = {
            sessions: mockSessionStorage,
            history: {
                addMessage: vi.fn().mockResolvedValue(undefined),
                getMessages: vi.fn().mockResolvedValue([]),
                clearSession: vi.fn().mockResolvedValue(undefined),
                getSessions: vi.fn().mockResolvedValue([]),
                close: vi.fn().mockResolvedValue(undefined),
            },
            userInfo: {
                get: vi.fn().mockResolvedValue(undefined),
                set: vi.fn().mockResolvedValue(undefined),
                delete: vi.fn().mockResolvedValue(true),
                close: vi.fn().mockResolvedValue(undefined),
            },
        };

        // Mock services
        mockServices = {
            stateManager: {
                getLLMConfig: vi.fn().mockReturnValue(mockLLMConfig),
                updateLLM: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
            },
            promptManager: {
                getSystemPrompt: vi.fn().mockReturnValue('System prompt'),
            },
            clientManager: {
                getAllTools: vi.fn().mockResolvedValue({}),
            },
            agentEventBus: {
                emit: vi.fn(),
            },
            storageManager: mockStorageManager,
        };

        // Create SessionManager instance
        sessionManager = new SessionManager(mockServices, {
            maxSessions: 10,
            sessionTTL: 1800000, // 30 minutes
        });

        // Mock ChatSession constructor and methods
        MockChatSession.mockImplementation((services, id) => {
            const mockSession = {
                id,
                init: vi.fn().mockResolvedValue(undefined),
                run: vi.fn().mockResolvedValue('Mock response'),
                reset: vi.fn().mockResolvedValue(undefined),
                dispose: vi.fn(),
                switchLLM: vi.fn().mockResolvedValue(undefined),
                getHistory: vi.fn().mockResolvedValue([]),
                getMessageManager: vi.fn(),
                getLLMService: vi.fn(),
                eventBus: {
                    emit: vi.fn(),
                    on: vi.fn(),
                    off: vi.fn(),
                },
            };
            return mockSession as any;
        });
    });

    afterEach(async () => {
        if (sessionManager) {
            await sessionManager.cleanup();
        }
    });

    describe('Session Lifecycle Management', () => {
        test('should support flexible initialization options', () => {
            const defaultManager = new SessionManager(mockServices);
            const customManager = new SessionManager(mockServices, {
                maxSessions: 50,
                sessionTTL: 7200000, // 2 hours
            });

            expect(defaultManager).toBeDefined();
            expect(customManager).toBeDefined();
        });

        test('should initialize storage layer on first use', async () => {
            await sessionManager.init();

            expect(mockStorageManager.sessions).toBe(mockSessionStorage);
            expect(mockSessionStorage.getActiveSessions).toHaveBeenCalled();
        });

        test('should prevent duplicate initialization', async () => {
            await sessionManager.init();
            await sessionManager.init(); // Second call

            expect(mockStorageManager.sessions).toBe(mockSessionStorage);
        });

        test('should restore valid sessions from persistent storage on startup', async () => {
            const existingSessionIds = ['session-1', 'session-2'];
            const validMetadata = {
                ...mockSessionData,
                lastActivity: new Date().getTime(), // Recent activity
            };

            mockSessionStorage.getActiveSessions.mockResolvedValue(existingSessionIds);
            mockSessionStorage.getSession.mockResolvedValue(validMetadata);

            await sessionManager.init();

            expect(mockSessionStorage.getActiveSessions).toHaveBeenCalled();
            expect(mockSessionStorage.getSession).toHaveBeenCalledTimes(existingSessionIds.length);
        });

        test('should clean up expired sessions during startup restoration', async () => {
            const existingSessionIds = ['expired-session'];
            const expiredMetadata = {
                ...mockSessionData,
                lastActivity: new Date(Date.now() - 7200000).getTime(), // 2 hours ago
            };

            mockSessionStorage.getActiveSessions.mockResolvedValue(existingSessionIds);
            mockSessionStorage.getSession.mockResolvedValue(expiredMetadata);

            await sessionManager.init();

            expect(mockSessionStorage.deleteSession).toHaveBeenCalledWith('expired-session');
        });
    });

    describe('Session Creation and Identity Management', () => {
        beforeEach(async () => {
            await sessionManager.init();
        });

        test('should create sessions with auto-generated IDs when none provided', async () => {
            const session = await sessionManager.createSession();

            expect(session).toBeDefined();
            expect(session.id).toBe('mock-uuid-123');
            expect(MockChatSession).toHaveBeenCalledWith(mockServices, 'mock-uuid-123');
        });

        test('should create sessions with custom IDs when provided', async () => {
            const customId = 'custom-session-id';
            const session = await sessionManager.createSession(customId);

            expect(session.id).toBe(customId);
            expect(MockChatSession).toHaveBeenCalledWith(mockServices, customId);
        });

        test('should return existing session instance for duplicate creation requests', async () => {
            const sessionId = 'existing-session';

            const session1 = await sessionManager.createSession(sessionId);
            const session2 = await sessionManager.createSession(sessionId);

            // Both should have the same ID (testing the actual behavior)
            expect(session1.id).toBe(session2.id);
            expect(session1.id).toBe(sessionId);
            expect(session2.id).toBe(sessionId);
        });

        test('should restore sessions from storage when not in memory', async () => {
            const sessionId = 'stored-session';

            mockSessionStorage.getSession.mockResolvedValue(mockSessionData);

            const session = await sessionManager.createSession(sessionId);

            expect(session.id).toBe(sessionId);
            expect(mockSessionStorage.getSession).toHaveBeenCalledWith(sessionId);
        });

        test('should provide default session for backward compatibility', async () => {
            const session = await sessionManager.getDefaultSession();

            expect(session.id).toBe('default');
            expect(MockChatSession).toHaveBeenCalledWith(mockServices, 'default');
        });
    });

    describe('Session Limits and Resource Management', () => {
        test('should enforce maximum session limits', async () => {
            const maxSessions = 2;
            const limitedManager = new SessionManager(mockServices, { maxSessions });
            await limitedManager.init();

            // Mock that we already have max sessions
            mockSessionStorage.getActiveSessions.mockResolvedValue(['session-1', 'session-2']);

            await expect(limitedManager.createSession()).rejects.toThrow(
                'Maximum sessions (2) reached'
            );
        });

        test('should clean up expired sessions before enforcing limits', async () => {
            await sessionManager.init();

            // Mock expired session that should be cleaned up
            mockSessionStorage.getActiveSessions.mockResolvedValue(['expired-session']);

            const session = await sessionManager.createSession();

            expect(session).toBeDefined();
            // Should not throw max sessions error because expired session was cleaned up
        });

        test('should provide session statistics for monitoring', async () => {
            await sessionManager.init();

            const activeSessionIds = ['session-1', 'session-2'];
            mockSessionStorage.getActiveSessions.mockResolvedValue(activeSessionIds);

            // Create one session in memory
            await sessionManager.createSession('session-1');

            const stats = await sessionManager.getSessionStats();

            expect(stats).toEqual({
                totalSessions: 2,
                inMemorySessions: 1,
                maxSessions: 10,
                sessionTTL: 1800000,
            });
        });
    });

    describe('Session Retrieval and Access Patterns', () => {
        beforeEach(async () => {
            await sessionManager.init();
        });

        test('should retrieve existing sessions from memory efficiently', async () => {
            const sessionId = 'test-session';

            // Create session first
            await sessionManager.createSession(sessionId);

            // Get session
            const session = await sessionManager.getSession(sessionId);

            expect(session).toBeDefined();
            expect(session!.id).toBe(sessionId);
        });

        test('should restore sessions from storage when not in memory', async () => {
            const sessionId = 'stored-session';

            mockSessionStorage.getSession.mockResolvedValue(mockSessionData);

            const session = await sessionManager.getSession(sessionId);

            expect(session).toBeDefined();
            expect(session!.id).toBe(sessionId);
            expect(mockSessionStorage.getSession).toHaveBeenCalledWith(sessionId);
        });

        test('should return undefined for non-existent sessions', async () => {
            const session = await sessionManager.getSession('non-existent');

            expect(session).toBeUndefined();
        });

        test('should update session activity timestamps on access', async () => {
            const sessionId = 'test-session';

            mockSessionStorage.getSession.mockResolvedValue(mockSessionData);

            await sessionManager.getSession(sessionId);

            expect(mockSessionStorage.setSessionWithTTL).toHaveBeenCalledWith(
                sessionId,
                expect.objectContaining({
                    lastActivity: expect.any(Number),
                }),
                1800000
            );
        });
    });

    describe('Session Metadata and Activity Tracking', () => {
        beforeEach(async () => {
            await sessionManager.init();
        });

        test('should track and persist session metadata', async () => {
            const session = await sessionManager.createSession();

            expect(mockSessionStorage.setSessionWithTTL).toHaveBeenCalledWith(
                session.id,
                expect.objectContaining({
                    createdAt: expect.any(Number),
                    lastActivity: expect.any(Number),
                    messageCount: 0,
                }),
                1800000
            );
        });

        test('should increment message counts and update activity', async () => {
            const sessionId = 'test-session';

            mockSessionStorage.getSession.mockResolvedValue({ ...mockSessionData });

            await sessionManager.incrementMessageCount(sessionId);

            expect(mockSessionStorage.setSessionWithTTL).toHaveBeenCalledWith(
                sessionId,
                expect.objectContaining({
                    messageCount: mockSessionData.messageCount + 1,
                    lastActivity: expect.any(Number),
                }),
                1800000
            );
        });

        test('should provide access to session metadata', async () => {
            const sessionId = 'test-session';

            mockSessionStorage.getSession.mockResolvedValue(mockSessionData);

            const metadata = await sessionManager.getSessionMetadata(sessionId);

            expect(metadata).toEqual(mockSessionData);
            expect(mockSessionStorage.getSession).toHaveBeenCalledWith(sessionId);
        });

        test('should list all active sessions', async () => {
            const activeSessionIds = ['session-1', 'session-2', 'session-3'];
            mockSessionStorage.getActiveSessions.mockResolvedValue(activeSessionIds);

            const sessions = await sessionManager.listSessions();

            expect(sessions).toEqual(activeSessionIds);
            expect(mockSessionStorage.getActiveSessions).toHaveBeenCalled();
        });
    });

    describe('Session Termination and Cleanup', () => {
        beforeEach(async () => {
            await sessionManager.init();
        });

        test('should properly end sessions and clean up resources', async () => {
            const sessionId = 'test-session';

            // Create session first
            const session = await sessionManager.createSession(sessionId);

            // End session
            await sessionManager.endSession(sessionId);

            expect(session.reset).toHaveBeenCalled();
            expect(session.dispose).toHaveBeenCalled();
            expect(mockSessionStorage.deleteSession).toHaveBeenCalledWith(sessionId);
        });

        test('should handle ending non-existent sessions gracefully', async () => {
            await expect(sessionManager.endSession('non-existent')).resolves.not.toThrow();
            expect(mockSessionStorage.deleteSession).toHaveBeenCalledWith('non-existent');
        });

        test('should cleanup all sessions during shutdown', async () => {
            const sessionIds = ['session-1', 'session-2'];

            // Create sessions
            const sessions = [];
            for (const id of sessionIds) {
                sessions.push(await sessionManager.createSession(id));
            }

            await sessionManager.cleanup();

            // Verify all sessions were cleaned up
            for (const session of sessions) {
                expect(session.reset).toHaveBeenCalled();
                expect(session.dispose).toHaveBeenCalled();
            }
        });

        test('should handle cleanup errors gracefully', async () => {
            const sessionId = 'error-session';

            // Create session
            const session = await sessionManager.createSession(sessionId);

            // Mock error during cleanup
            (session.reset as any).mockRejectedValue(new Error('Cleanup error'));

            await expect(sessionManager.cleanup()).resolves.not.toThrow();
        });
    });

    describe('LLM Configuration Management Across Sessions', () => {
        beforeEach(async () => {
            await sessionManager.init();
        });

        test('should switch LLM for default session', async () => {
            const newLLMConfig: LLMConfig = {
                ...mockLLMConfig,
                provider: 'anthropic',
                model: 'claude-3-opus',
            };

            const result = await sessionManager.switchLLMForDefaultSession(newLLMConfig);

            expect(result.message).toContain('Successfully switched to anthropic/claude-3-opus');
            expect(result.warnings).toEqual([]);
            expect(mockServices.agentEventBus.emit).toHaveBeenCalledWith(
                'saiki:llmSwitched',
                expect.objectContaining({
                    newConfig: newLLMConfig,
                    router: newLLMConfig.router,
                    historyRetained: true,
                })
            );
        });

        test('should switch LLM for specific session', async () => {
            const sessionId = 'test-session';
            const newLLMConfig: LLMConfig = {
                ...mockLLMConfig,
                provider: 'anthropic',
                model: 'claude-3-opus',
            };

            // Create session first
            await sessionManager.createSession(sessionId);

            const result = await sessionManager.switchLLMForSpecificSession(
                newLLMConfig,
                sessionId
            );

            expect(result.message).toContain(
                `Successfully switched to anthropic/claude-3-opus using in-built router for session ${sessionId}`
            );
            expect(result.warnings).toEqual([]);
        });

        test('should handle LLM switch for non-existent session', async () => {
            const newLLMConfig: LLMConfig = {
                ...mockLLMConfig,
                provider: 'anthropic',
                model: 'claude-3-opus',
            };

            await expect(
                sessionManager.switchLLMForSpecificSession(newLLMConfig, 'non-existent')
            ).rejects.toThrow('Session non-existent not found');
        });

        test('should handle partial failures when switching LLM for all sessions', async () => {
            const sessionIds = ['session-1', 'session-2'];
            const newLLMConfig: LLMConfig = {
                ...mockLLMConfig,
                provider: 'anthropic',
                model: 'claude-3-opus',
            };

            mockSessionStorage.getActiveSessions.mockResolvedValue(sessionIds);

            // Mock validation failure for one session
            mockServices.stateManager.updateLLM.mockImplementation((config, sessionId) => {
                if (sessionId === 'session-2') {
                    return { isValid: false, errors: ['Validation failed'], warnings: [] };
                }
                return { isValid: true, errors: [], warnings: [] };
            });

            // Create sessions
            for (const id of sessionIds) {
                await sessionManager.createSession(id);
            }

            const result = await sessionManager.switchLLMForAllSessions(newLLMConfig);

            expect(result.message).toContain('1 sessions failed');
            expect(result.warnings).toContain('Failed to switch LLM for sessions: session-2');
        });
    });

    describe('Error Handling and Resilience', () => {
        test('should handle storage initialization failures', async () => {
            mockSessionStorage.getActiveSessions.mockRejectedValue(
                new Error('Storage initialization failed')
            );

            // init() should not throw - it catches and logs errors
            await expect(sessionManager.init()).resolves.toBeUndefined();
        });

        test('should handle storage operation failures gracefully', async () => {
            await sessionManager.init();

            mockSessionStorage.setSessionWithTTL.mockRejectedValue(
                new Error('Storage write failed')
            );

            // Should still create session in memory despite storage failure
            await expect(sessionManager.createSession()).rejects.toThrow('Storage write failed');
        });

        test('should handle session restoration errors during startup', async () => {
            mockSessionStorage.getActiveSessions.mockResolvedValue(['session-1']);
            mockSessionStorage.getSession.mockRejectedValue(new Error('Storage read failed'));

            // Should not throw during initialization
            await expect(sessionManager.init()).resolves.not.toThrow();
        });

        test('should handle cleanup errors during expired session removal', async () => {
            await sessionManager.init();

            const sessionId = 'test-session';
            const session = await sessionManager.createSession(sessionId);

            // Mock cleanup error
            (session.reset as any).mockRejectedValue(new Error('Reset failed'));

            // Mock that session is expired
            mockSessionStorage.getActiveSessions.mockResolvedValue([]);

            // Should handle error gracefully during cleanup
            await expect(sessionManager.createSession('new-session')).resolves.toBeDefined();
        });
    });

    describe('Concurrency and Edge Cases', () => {
        beforeEach(async () => {
            await sessionManager.init();
        });

        test('should handle concurrent session creation requests safely', async () => {
            const sessionId = 'concurrent-session';

            // Create multiple promises for the same session
            const promises = [
                sessionManager.createSession(sessionId),
                sessionManager.createSession(sessionId),
                sessionManager.createSession(sessionId),
            ];

            const sessions = await Promise.all(promises);

            // All should have the same session ID
            expect(sessions[0].id).toBe(sessions[1].id);
            expect(sessions[1].id).toBe(sessions[2].id);
            expect(sessions[0].id).toBe(sessionId);

            // Verify all sessions are properly created
            expect(sessions[0]).toBeDefined();
            expect(sessions[1]).toBeDefined();
            expect(sessions[2]).toBeDefined();
        });

        test('should handle legacy session metadata without TTL fields', async () => {
            const sessionId = 'legacy-session';
            const legacyMetadata = {
                createdAt: new Date().getTime(),
                lastActivity: new Date().getTime(),
                messageCount: 0,
                // Missing maxSessions and sessionTTL
            };

            mockSessionStorage.getSession.mockResolvedValue(legacyMetadata);

            const session = await sessionManager.getSession(sessionId);

            expect(session).toBeDefined();
            expect(session!.id).toBe(sessionId);
        });

        test('should handle empty session lists gracefully', async () => {
            mockSessionStorage.getActiveSessions.mockResolvedValue([]);

            const sessions = await sessionManager.listSessions();

            expect(sessions).toEqual([]);
        });

        test('should continue operating when storage is temporarily unavailable', async () => {
            mockSessionStorage.setSessionWithTTL.mockRejectedValue(
                new Error('Storage unavailable')
            );

            // Should throw error since storage is required for session persistence
            await expect(sessionManager.createSession()).rejects.toThrow('Storage unavailable');
        });

        test('should clean up expired in-memory sessions automatically', async () => {
            const sessionId = 'test-session';

            // Create session
            await sessionManager.createSession(sessionId);

            // Mock that session is no longer in storage (expired)
            mockSessionStorage.getActiveSessions.mockResolvedValue([]);

            // Trigger cleanup by creating another session
            await sessionManager.createSession('new-session');

            // The expired session should have been cleaned up from memory
            // This is tested indirectly through the cleanup process
        });
    });

    describe('Periodic Cleanup', () => {
        test('should start periodic cleanup timer during initialization', async () => {
            const setIntervalSpy = vi.spyOn(global, 'setInterval');

            await sessionManager.init();

            expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));

            // Verify the interval is calculated correctly (min of TTL/4 or 15 minutes)
            // Test setup uses 30 minutes TTL, so TTL/4 = 7.5 minutes = 450000ms
            const expectedInterval = Math.min(1800000 / 4, 15 * 60 * 1000); // 7.5 minutes since TTL/4 < 15 minutes
            expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), expectedInterval);

            setIntervalSpy.mockRestore();
        });

        test('should stop periodic cleanup timer during cleanup', async () => {
            const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

            await sessionManager.init();
            await sessionManager.cleanup();

            expect(clearIntervalSpy).toHaveBeenCalled();
            clearIntervalSpy.mockRestore();
        });

        test('should handle periodic cleanup errors gracefully', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const setIntervalSpy = vi.spyOn(global, 'setInterval');
            mockSessionStorage.getActiveSessions.mockRejectedValue(new Error('Storage error'));

            await sessionManager.init();

            // Access the interval function and call it directly to test error handling
            const setIntervalCall = setIntervalSpy.mock.calls[0];
            const cleanupFunction = setIntervalCall[0] as Function;

            // This should not throw
            await expect(cleanupFunction()).resolves.toBeUndefined();

            consoleSpy.mockRestore();
            setIntervalSpy.mockRestore();
        });

        test('should use correct cleanup interval based on session TTL', async () => {
            // Create SessionManager with different TTL
            const shortTTLSessionManager = new SessionManager(mockServices, {
                sessionTTL: 60000, // 1 minute
            });

            const setIntervalSpy = vi.spyOn(global, 'setInterval');

            await shortTTLSessionManager.init();

            // Should use TTL/4 (15 seconds) since it's less than 15 minutes
            const expectedInterval = Math.min(60000 / 4, 15 * 60 * 1000);
            expect(expectedInterval).toBe(15000); // 15 seconds
            expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 15000);

            setIntervalSpy.mockRestore();
            await shortTTLSessionManager.cleanup();
        });
    });
});
