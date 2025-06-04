import { randomUUID } from 'crypto';
import { ChatSession } from './chat-session.js';
import { PromptManager } from '../systemPrompt/manager.js';
import { MCPClientManager } from '../../client/manager.js';
import { AgentEventBus } from '../../events/index.js';
import { logger } from '../../logger/index.js';
import type { AgentStateManager } from '../../config/agent-state-manager.js';
import type { LLMConfig } from '../../config/schemas.js';
import type { StorageBackends } from '../../storage/index.js';

export interface SessionMetadata {
    createdAt: number;
    lastActivity: number;
    messageCount: number;
    // Additional metadata for session management
    maxSessions?: number;
    sessionTTL?: number;
}

export interface SessionData {
    id: string;
    userId?: string;
    createdAt: number;
    lastActivity: number;
    messageCount: number;
    metadata?: Record<string, any>;
}

/**
 * Manages multiple chat sessions within a Saiki agent.
 *
 * The SessionManager is responsible for:
 * - Creating and managing multiple isolated chat sessions
 * - Enforcing session limits and TTL policies
 * - Cleaning up expired sessions
 * - Providing session lifecycle management
 * - Persisting session data using the simplified storage backends
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
            storage: StorageBackends;
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
            // Use the database backend to list sessions with the 'session:' prefix
            const sessionKeys = await this.services.storage.database.list('session:');
            logger.debug(`Found ${sessionKeys.length} persisted sessions to restore`);

            for (const sessionKey of sessionKeys) {
                const sessionId = sessionKey.replace('session:', '');
                const sessionData =
                    await this.services.storage.database.get<SessionData>(sessionKey);

                if (sessionData) {
                    // Check if session is still valid (not expired)
                    const now = Date.now();
                    const lastActivity = sessionData.lastActivity;

                    if (now - lastActivity <= this.sessionTTL) {
                        // Session is still valid, but don't create ChatSession until requested
                        logger.debug(`Session ${sessionId} restored from storage`);
                    } else {
                        // Session expired, clean it up
                        await this.services.storage.database.delete(sessionKey);
                        logger.debug(`Expired session ${sessionId} cleaned up during restore`);
                    }
                }
            }
        } catch (error) {
            logger.error(
                `Failed to restore sessions from storage: ${error instanceof Error ? error.message : String(error)}`
            );
            // Continue without restored sessions
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
        const sessionKey = `session:${id}`;
        const existingMetadata = await this.services.storage.database.get<SessionData>(sessionKey);
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
        const activeSessionKeys = await this.services.storage.database.list('session:');
        if (activeSessionKeys.length >= this.maxSessions) {
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

        await this.services.storage.database.set(sessionKey, sessionData);

        // Also store in cache with TTL for faster access
        await this.services.storage.cache.set(sessionKey, sessionData, this.sessionTTL / 1000);

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

        // Check memory first
        if (this.sessions.has(sessionId)) {
            return this.sessions.get(sessionId);
        }

        // Check storage
        const sessionKey = `session:${sessionId}`;
        const sessionData = await this.services.storage.database.get<SessionData>(sessionKey);
        if (sessionData) {
            // Restore session to memory
            const session = new ChatSession(this.services, sessionId);
            await session.init();
            this.sessions.set(sessionId, session);
            return session;
        }

        return undefined;
    }

    /**
     * Ends a session and removes it from memory and storage.
     *
     * @param sessionId The session ID to end
     */
    public async endSession(sessionId: string): Promise<void> {
        await this.ensureInitialized();

        // Remove from memory
        const session = this.sessions.get(sessionId);
        if (session) {
            await session.cleanup();
            this.sessions.delete(sessionId);
        }

        // Remove from storage
        const sessionKey = `session:${sessionId}`;
        await this.services.storage.database.delete(sessionKey);
        await this.services.storage.cache.delete(sessionKey);

        logger.debug(`Ended session: ${sessionId}`);
    }

    /**
     * Lists all active session IDs.
     *
     * @returns Array of active session IDs
     */
    public async listSessions(): Promise<string[]> {
        await this.ensureInitialized();
        const sessionKeys = await this.services.storage.database.list('session:');
        return sessionKeys.map((key) => key.replace('session:', ''));
    }

    /**
     * Gets metadata for a specific session.
     *
     * @param sessionId The session ID
     * @returns Session metadata if found, undefined otherwise
     */
    public async getSessionMetadata(sessionId: string): Promise<SessionMetadata | undefined> {
        await this.ensureInitialized();
        const sessionKey = `session:${sessionId}`;
        const sessionData = await this.services.storage.database.get<SessionData>(sessionKey);
        return sessionData
            ? {
                  createdAt: sessionData.createdAt,
                  lastActivity: sessionData.lastActivity,
                  messageCount: sessionData.messageCount,
                  maxSessions: this.maxSessions,
                  sessionTTL: this.sessionTTL,
              }
            : undefined;
    }

    /**
     * Updates the last activity timestamp for a session.
     */
    private async updateSessionActivity(sessionId: string): Promise<void> {
        const sessionKey = `session:${sessionId}`;
        const sessionData = await this.services.storage.database.get<SessionData>(sessionKey);

        if (sessionData) {
            sessionData.lastActivity = Date.now();
            await this.services.storage.database.set(sessionKey, sessionData);
            // Update cache as well
            await this.services.storage.cache.set(sessionKey, sessionData, this.sessionTTL / 1000);
        }
    }

    /**
     * Increments the message count for a session.
     */
    public async incrementMessageCount(sessionId: string): Promise<void> {
        await this.ensureInitialized();

        const sessionKey = `session:${sessionId}`;
        const sessionData = await this.services.storage.database.get<SessionData>(sessionKey);

        if (sessionData) {
            sessionData.messageCount++;
            sessionData.lastActivity = Date.now();
            await this.services.storage.database.set(sessionKey, sessionData);
            // Update cache as well
            await this.services.storage.cache.set(sessionKey, sessionData, this.sessionTTL / 1000);
        }
    }

    /**
     * Cleans up expired sessions from both memory and storage.
     */
    private async cleanupExpiredSessions(): Promise<void> {
        const now = Date.now();
        const sessionKeys = await this.services.storage.database.list('session:');

        for (const sessionKey of sessionKeys) {
            const sessionData = await this.services.storage.database.get<SessionData>(sessionKey);

            if (sessionData && now - sessionData.lastActivity > this.sessionTTL) {
                const sessionId = sessionKey.replace('session:', '');

                // Remove from memory
                const session = this.sessions.get(sessionId);
                if (session) {
                    await session.cleanup();
                    this.sessions.delete(sessionId);
                }

                // Remove from storage
                await this.services.storage.database.delete(sessionKey);
                await this.services.storage.cache.delete(sessionKey);

                logger.debug(`Cleaned up expired session: ${sessionId}`);
            }
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
                    logger.warn(
                        `Error switching LLM for session ${sId}: ${error instanceof Error ? error.message : String(error)}`
                    );
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
                logger.error(
                    `Failed to cleanup session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }

        this.sessions.clear();
        this.initialized = false;
        logger.debug('SessionManager cleanup completed');
    }
}
