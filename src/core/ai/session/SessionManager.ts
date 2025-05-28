import { randomUUID } from 'crypto';
import { ChatSession } from './ChatSession.js';
import { ConfigManager } from '../../config/manager.js';
import { PromptManager } from '../systemPrompt/manager.js';
import { MCPClientManager } from '../../client/manager.js';
import { AgentEventBus } from '../../events/index.js';
import { logger } from '../../logger/index.js';

export interface SessionMetadata {
    createdAt: Date;
    lastActivity: Date;
    messageCount: number;
}

/**
 * Manages multiple chat sessions within a Saiki agent.
 *
 * The SessionManager is responsible for:
 * - Creating and managing multiple isolated chat sessions
 * - Enforcing session limits and TTL policies
 * - Cleaning up expired sessions
 * - Providing session lifecycle management
 */
export class SessionManager {
    private sessions: Map<string, ChatSession> = new Map();
    private sessionMetadata: Map<string, SessionMetadata> = new Map();
    private readonly maxSessions: number;
    private readonly sessionTTL: number;

    constructor(
        private services: {
            configManager: ConfigManager;
            promptManager: PromptManager;
            clientManager: MCPClientManager;
            agentEventBus: AgentEventBus;
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
     * Creates a new chat session or returns an existing one.
     *
     * @param sessionId Optional session ID. If not provided, a UUID will be generated.
     * @returns The created or existing ChatSession
     * @throws Error if maximum sessions limit is reached
     */
    public createSession(sessionId?: string): ChatSession {
        const id = sessionId ?? randomUUID();

        this.cleanupExpiredSessions();

        if (this.sessions.has(id)) {
            this.updateSessionActivity(id);
            return this.sessions.get(id)!;
        }

        if (this.sessions.size >= this.maxSessions) {
            throw new Error(`Maximum sessions (${this.maxSessions}) reached`);
        }

        // Pass services to ChatSession instead of agent
        const session = new ChatSession(this.services, id);
        this.sessions.set(id, session);
        this.sessionMetadata.set(id, {
            createdAt: new Date(),
            lastActivity: new Date(),
            messageCount: 0,
        });

        logger.debug(`Created new session: ${id}`);
        return session;
    }

    /**
     * Retrieves an existing session by ID.
     *
     * @param sessionId The session ID to retrieve
     * @returns The ChatSession if found, undefined otherwise
     */
    public getSession(sessionId: string): ChatSession | undefined {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.updateSessionActivity(sessionId);
        }
        return session;
    }

    /**
     * Ends a session and cleans up its resources.
     *
     * @param sessionId The session ID to end
     */
    public async endSession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (session) {
            try {
                await session.reset();
                // Clean up event listeners to prevent memory leaks
                session.dispose();
            } finally {
                this.sessions.delete(sessionId);
                this.sessionMetadata.delete(sessionId);
                logger.debug(`Ended session: ${sessionId}`);
            }
        }
    }

    /**
     * Lists all active session IDs.
     *
     * @returns Array of session IDs
     */
    public listSessions(): string[] {
        return Array.from(this.sessions.keys());
    }

    /**
     * Gets metadata for a specific session.
     *
     * @param sessionId The session ID
     * @returns Session metadata if found, undefined otherwise
     */
    public getSessionMetadata(sessionId: string): SessionMetadata | undefined {
        return this.sessionMetadata.get(sessionId);
    }

    /**
     * Updates the last activity timestamp for a session.
     */
    private updateSessionActivity(sessionId: string): void {
        const metadata = this.sessionMetadata.get(sessionId);
        if (metadata) {
            metadata.lastActivity = new Date();
        }
    }

    /**
     * Cleans up expired sessions based on TTL.
     */
    private cleanupExpiredSessions(): void {
        const now = Date.now();
        for (const [id, metadata] of this.sessionMetadata.entries()) {
            if (now - metadata.lastActivity.getTime() > this.sessionTTL) {
                this.endSession(id).catch((err) =>
                    logger.error(`Failed to cleanup expired session ${id}:`, err)
                );
            }
        }
    }
}
