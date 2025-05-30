import { randomUUID } from 'crypto';
import { ChatSession } from './chat-session.js';
import { PromptManager } from '../systemPrompt/manager.js';
import { MCPClientManager } from '../../client/manager.js';
import { AgentEventBus } from '../../events/index.js';
import { logger } from '../../logger/index.js';
import type { AgentStateManager } from '../../config/agent-state-manager.js';
import type { LLMConfig } from '../../config/schemas.js';
import type { StorageInstances, SessionData } from '../../storage/types.js';

export interface SessionMetadata {
    createdAt: number;
    lastActivity: number;
    messageCount: number;
    // Additional metadata for session management
    maxSessions?: number;
    sessionTTL?: number;
}

/**
 * Manages multiple chat sessions within a Saiki agent.
 *
 * The SessionManager is responsible for:
 * - Creating and managing multiple isolated chat sessions
 * - Enforcing session limits and TTL policies
 * - Cleaning up expired sessions
 * - Providing session lifecycle management
 * - Persisting session data using SessionStorage
 */
export class SessionManager {
    private sessions: Map<string, ChatSession> = new Map();
    private readonly maxSessions: number;
    private readonly sessionTTL: number;
    private initialized = false;
    private cleanupInterval?: NodeJS.Timeout;

    constructor(
        private services: {
            stateManager: AgentStateManager;
            promptManager: PromptManager;
            clientManager: MCPClientManager;
            agentEventBus: AgentEventBus;
            storageManager: StorageInstances;
        },
        options: {
            maxSessions?: number;
            sessionTTL?: number;
        } = {}
    ) {
        this.maxSessions = options.maxSessions ?? 100;
        this.sessionTTL = options.sessionTTL ?? 3600000; // 1 hour
    }

    /**
     * Initialize the SessionManager with persistent storage.
     * This must be called before using any session operations.
     */
    public async init(): Promise<void> {
        if (this.initialized) {
            return;
        }

        // Restore any existing sessions from storage
        await this.restoreSessionsFromStorage();

        // Start periodic cleanup to prevent memory leaks from long-lived sessions
        // Clean up every 15 minutes or 1/4 of session TTL, whichever is smaller
        const cleanupIntervalMs = Math.min(this.sessionTTL / 4, 15 * 60 * 1000);
        this.cleanupInterval = setInterval(
            () =>
                this.cleanupExpiredSessions().catch((err) =>
                    logger.error('Periodic session cleanup failed:', err)
                ),
            cleanupIntervalMs
        );

        this.initialized = true;
        logger.debug(
            `SessionManager initialized with periodic cleanup every ${Math.round(cleanupIntervalMs / 1000 / 60)} minutes`
        );
    }

    /**
     * Restore sessions from persistent storage on startup.
     * This allows sessions to survive application restarts.
     */
    private async restoreSessionsFromStorage(): Promise<void> {
        try {
            const sessionIds = await this.services.storageManager.sessions.getActiveSessions();
            logger.debug(`Found ${sessionIds.length} persisted sessions to restore`);

            for (const sessionId of sessionIds) {
                const sessionData =
                    await this.services.storageManager.sessions.getSession(sessionId);
                if (sessionData) {
                    // Check if session is still valid (not expired)
                    const now = Date.now();
                    const lastActivity = sessionData.lastActivity;

                    if (now - lastActivity <= this.sessionTTL) {
                        // Session is still valid, but don't create ChatSession until requested
                        logger.debug(`Session ${sessionId} restored from storage`);
                    } else {
                        // Session expired, clean it up
                        await this.services.storageManager.sessions.deleteSession(sessionId);
                        logger.debug(`Expired session ${sessionId} cleaned up during restore`);
                    }
                }
            }
        } catch (error) {
            logger.error('Failed to restore sessions from storage:', error);
        }
    }

    /**
     * Ensures the SessionManager is initialized before operations.
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.init();
        }
    }

    /**
     * Creates a new chat session or returns an existing one.
     *
     * @param sessionId Optional session ID. If not provided, a UUID will be generated.
     * @returns The created or existing ChatSession
     * @throws Error if maximum sessions limit is reached
     */
    public async createSession(sessionId?: string): Promise<ChatSession> {
        await this.ensureInitialized();

        const id = sessionId ?? randomUUID();

        // Clean up expired sessions first
        await this.cleanupExpiredSessions();

        // Check if session already exists in memory
        if (this.sessions.has(id)) {
            await this.updateSessionActivity(id);
            return this.sessions.get(id)!;
        }

        // Check if session exists in storage
        const existingMetadata = await this.services.storageManager.sessions.getSession(id);
        if (existingMetadata) {
            // Session exists in storage, restore it
            await this.updateSessionActivity(id);
            const session = new ChatSession(this.services, id);
            await session.init();
            this.sessions.set(id, session);
            logger.debug(`Restored session from storage: ${id}`);
            return session;
        }

        // Check session limits
        const activeSessions = await this.services.storageManager.sessions.getActiveSessions();
        if (activeSessions.length >= this.maxSessions) {
            throw new Error(`Maximum sessions (${this.maxSessions}) reached`);
        }

        // Create new session
        const session = new ChatSession(this.services, id);
        await session.init();

        this.sessions.set(id, session);

        // Store session metadata in persistent storage
        const sessionData: SessionData = {
            id,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            messageCount: 0,
        };

        await this.services.storageManager.sessions.setSessionWithTTL(
            id,
            sessionData,
            this.sessionTTL
        );

        logger.debug(`Created new session: ${id}`);
        return session;
    }

    /**
     * Gets or creates the default session.
     * This is used for backward compatibility with single-session operations.
     *
     * @returns The default ChatSession (creates one if it doesn't exist)
     */
    public async getDefaultSession(): Promise<ChatSession> {
        const defaultSessionId = 'default';
        return await this.createSession(defaultSessionId);
    }

    /**
     * Retrieves an existing session by ID.
     *
     * @param sessionId The session ID to retrieve
     * @returns The ChatSession if found, undefined otherwise
     */
    public async getSession(sessionId: string): Promise<ChatSession | undefined> {
        await this.ensureInitialized();

        // Check if session is in memory
        let session = this.sessions.get(sessionId);
        if (session) {
            await this.updateSessionActivity(sessionId);
            return session;
        }

        // Check if session exists in storage
        const metadata = await this.services.storageManager.sessions.getSession(sessionId);
        if (metadata) {
            // Session exists in storage, restore it to memory
            session = new ChatSession(this.services, sessionId);
            await session.init();
            this.sessions.set(sessionId, session);
            await this.updateSessionActivity(sessionId);
            logger.debug(`Restored session from storage: ${sessionId}`);
            return session;
        }

        return undefined;
    }

    /**
     * Ends a session and cleans up its resources.
     *
     * @param sessionId The session ID to end
     */
    public async endSession(sessionId: string): Promise<void> {
        await this.ensureInitialized();

        const session = this.sessions.get(sessionId);
        if (session) {
            try {
                await session.reset();
                // Clean up event listeners to prevent memory leaks
                session.dispose();
            } finally {
                this.sessions.delete(sessionId);
            }
        }

        // Remove from persistent storage
        await this.services.storageManager.sessions.deleteSession(sessionId);
        logger.debug(`Ended session: ${sessionId}`);
    }

    /**
     * Lists all active session IDs.
     *
     * @returns Array of session IDs
     */
    public async listSessions(): Promise<string[]> {
        await this.ensureInitialized();
        return await this.services.storageManager.sessions.getActiveSessions();
    }

    /**
     * Gets metadata for a specific session.
     */
    public async getSessionMetadata(sessionId: string): Promise<SessionMetadata | undefined> {
        await this.ensureInitialized();
        return await this.services.storageManager.sessions.getSession(sessionId);
    }

    /**
     * Updates the last activity timestamp for a session.
     */
    private async updateSessionActivity(sessionId: string): Promise<void> {
        const sessionData = await this.services.storageManager.sessions.getSession(sessionId);
        if (sessionData) {
            sessionData.lastActivity = Date.now();
            await this.services.storageManager.sessions.setSessionWithTTL(
                sessionId,
                sessionData,
                this.sessionTTL
            );
        }
    }

    /**
     * Increments the message count for a session and updates activity.
     * This should be called whenever a message is sent in the session.
     *
     * Note: This method is not thread-safe. Concurrent calls for the same
     * session may overwrite each other. Consider using a lock or
     * an atomic increment in the storage layer.
     */
    public async incrementMessageCount(sessionId: string): Promise<void> {
        await this.ensureInitialized();

        const sessionData = await this.services.storageManager.sessions.getSession(sessionId);
        if (sessionData) {
            sessionData.messageCount += 1;
            sessionData.lastActivity = Date.now();
            await this.services.storageManager.sessions.setSessionWithTTL(
                sessionId,
                sessionData,
                this.sessionTTL
            );

            logger.debug(
                `Session ${sessionId}: Message count incremented to ${sessionData.messageCount}`
            );
        }
    }

    /**
     * Cleans up expired sessions based on TTL.
     * The SessionStorage handles automatic TTL expiration,
     * but we also clean up in-memory sessions here.
     */
    private async cleanupExpiredSessions(): Promise<void> {
        try {
            // Get all sessions from storage (expired ones are automatically cleaned up by storage)
            const activeSessionIds =
                await this.services.storageManager.sessions.getActiveSessions();
            const activeSessionSet = new Set(activeSessionIds);

            // Clean up in-memory sessions that are no longer in storage
            for (const [sessionId, session] of Array.from(this.sessions.entries())) {
                if (!activeSessionSet.has(sessionId)) {
                    try {
                        await session.reset();
                        session.dispose();
                        this.sessions.delete(sessionId);
                        logger.debug(`Cleaned up expired in-memory session: ${sessionId}`);
                    } catch (error) {
                        logger.error(`Failed to cleanup in-memory session ${sessionId}:`, error);
                    }
                }
            }
        } catch (error) {
            logger.error('Failed to cleanup expired sessions:', error);
        }
    }

    /**
     * Switch LLM for all sessions.
     * @param newLLMConfig The new LLM configuration to apply
     * @returns Result object with success message and any warnings
     */
    public async switchLLMForAllSessions(
        newLLMConfig: LLMConfig
    ): Promise<{ message: string; warnings: string[] }> {
        await this.ensureInitialized();

        const sessionIds = await this.listSessions();
        const failedSessions: string[] = [];

        for (const sId of sessionIds) {
            const session = await this.getSession(sId);
            if (session) {
                try {
                    // Validate for this specific session
                    const sessionValidation = this.services.stateManager.updateLLM(
                        newLLMConfig,
                        sId
                    );
                    if (sessionValidation.isValid) {
                        await session.switchLLM(newLLMConfig);
                    } else {
                        failedSessions.push(sId);
                        logger.warn(
                            `Failed to switch LLM for session ${sId}:`,
                            sessionValidation.errors
                        );
                    }
                } catch (error) {
                    failedSessions.push(sId);
                    logger.warn(`Error switching LLM for session ${sId}:`, error);
                }
            }
        }

        this.services.agentEventBus.emit('saiki:llmSwitched', {
            newConfig: newLLMConfig,
            router: newLLMConfig.router,
            historyRetained: true,
            sessionIds: sessionIds.filter((id) => !failedSessions.includes(id)),
        });

        const message =
            failedSessions.length > 0
                ? `Successfully switched to ${newLLMConfig.provider}/${newLLMConfig.model} using ${newLLMConfig.router} router (${failedSessions.length} sessions failed)`
                : `Successfully switched to ${newLLMConfig.provider}/${newLLMConfig.model} using ${newLLMConfig.router} router for all sessions`;

        const warnings =
            failedSessions.length > 0
                ? [`Failed to switch LLM for sessions: ${failedSessions.join(', ')}`]
                : [];

        return { message, warnings };
    }

    /**
     * Switch LLM for a specific session.
     * @param newLLMConfig The new LLM configuration to apply
     * @param sessionId The session ID to switch LLM for
     * @returns Result object with success message and any warnings
     */
    public async switchLLMForSpecificSession(
        newLLMConfig: LLMConfig,
        sessionId: string
    ): Promise<{ message: string; warnings: string[] }> {
        const session = await this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        await session.switchLLM(newLLMConfig);

        this.services.agentEventBus.emit('saiki:llmSwitched', {
            newConfig: newLLMConfig,
            router: newLLMConfig.router,
            historyRetained: true,
            sessionId: sessionId,
        });

        const message = `Successfully switched to ${newLLMConfig.provider}/${newLLMConfig.model} using ${newLLMConfig.router} router for session ${sessionId}`;

        return { message, warnings: [] };
    }

    /**
     * Switch LLM for the default session.
     * @param newLLMConfig The new LLM configuration to apply
     * @returns Result object with success message and any warnings
     */
    public async switchLLMForDefaultSession(
        newLLMConfig: LLMConfig
    ): Promise<{ message: string; warnings: string[] }> {
        const defaultSession = await this.getDefaultSession();

        await defaultSession.switchLLM(newLLMConfig);

        this.services.agentEventBus.emit('saiki:llmSwitched', {
            newConfig: newLLMConfig,
            router: newLLMConfig.router,
            historyRetained: true,
            sessionId: defaultSession.id,
        });

        const message = `Successfully switched to ${newLLMConfig.provider}/${newLLMConfig.model} using ${newLLMConfig.router} router`;

        return { message, warnings: [] };
    }

    /**
     * Get session statistics for monitoring and debugging.
     */
    public async getSessionStats(): Promise<{
        totalSessions: number;
        inMemorySessions: number;
        maxSessions: number;
        sessionTTL: number;
    }> {
        await this.ensureInitialized();

        const totalSessions = (await this.listSessions()).length;
        const inMemorySessions = this.sessions.size;

        return {
            totalSessions,
            inMemorySessions,
            maxSessions: this.maxSessions,
            sessionTTL: this.sessionTTL,
        };
    }

    /**
     * Cleanup all sessions and resources.
     * This should be called when shutting down the application.
     */
    public async cleanup(): Promise<void> {
        if (!this.initialized) {
            return;
        }

        // Stop periodic cleanup
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
            logger.debug('Periodic session cleanup stopped');
        }

        // Close all in-memory sessions
        const sessionIds = Array.from(this.sessions.keys());
        for (const sessionId of sessionIds) {
            try {
                await this.endSession(sessionId);
            } catch (error) {
                logger.error(`Failed to cleanup session ${sessionId}:`, error);
            }
        }

        this.sessions.clear();
        this.initialized = false;
        logger.debug('SessionManager cleanup completed');
    }
}
