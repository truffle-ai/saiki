import type { SessionStorage, SessionData } from '../types.js';
import { logger } from '../../logger/index.js';

interface SessionWithTTL {
    data: SessionData;
    expiresAt?: number;
}

/**
 * Memory-based session storage with TTL support.
 * Sessions are stored in memory and lost when the process ends.
 */
export class MemorySessionStorage implements SessionStorage {
    private sessions = new Map<string, SessionWithTTL>();

    async saveSession(session: SessionData): Promise<void> {
        this.sessions.set(session.id, { data: { ...session } });
        logger.debug(`MemorySessionStorage: Saved session ${session.id}`);
    }

    async getSession(sessionId: string): Promise<SessionData | undefined> {
        const sessionWithTTL = this.sessions.get(sessionId);
        if (!sessionWithTTL) {
            return undefined;
        }

        // Check if session has expired
        if (sessionWithTTL.expiresAt && Date.now() > sessionWithTTL.expiresAt) {
            this.sessions.delete(sessionId);
            logger.debug(`MemorySessionStorage: Session ${sessionId} expired and removed`);
            return undefined;
        }

        logger.debug(`MemorySessionStorage: Retrieved session ${sessionId}`);
        return { ...sessionWithTTL.data }; // Return a copy
    }

    async deleteSession(sessionId: string): Promise<void> {
        const existed = this.sessions.delete(sessionId);
        if (existed) {
            logger.debug(`MemorySessionStorage: Deleted session ${sessionId}`);
        }
    }

    async getAllSessions(): Promise<SessionData[]> {
        await this.cleanupExpiredSessions(); // Clean up first
        const sessions = Array.from(this.sessions.values()).map((s) => ({ ...s.data }));
        logger.debug(`MemorySessionStorage: Retrieved ${sessions.length} sessions`);
        return sessions;
    }

    async setSessionWithTTL(
        sessionId: string,
        session: SessionData,
        ttlMs?: number
    ): Promise<void> {
        const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;
        this.sessions.set(sessionId, {
            data: { ...session, id: sessionId },
            expiresAt,
        });
        logger.debug(`MemorySessionStorage: Saved session ${sessionId} with TTL ${ttlMs}ms`);
    }

    async getActiveSessions(): Promise<string[]> {
        await this.cleanupExpiredSessions(); // Clean up first
        return Array.from(this.sessions.keys());
    }

    async cleanupExpiredSessions(): Promise<number> {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [sessionId, sessionWithTTL] of Array.from(this.sessions.entries())) {
            if (sessionWithTTL.expiresAt && now > sessionWithTTL.expiresAt) {
                this.sessions.delete(sessionId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            logger.debug(`MemorySessionStorage: Cleaned up ${cleanedCount} expired sessions`);
        }

        return cleanedCount;
    }

    async close(): Promise<void> {
        this.sessions.clear();
    }
}
