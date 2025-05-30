import type { HistoryStorage } from '../types.js';
import type { InternalMessage } from '../../ai/llm/messages/types.js';
import { logger } from '../../logger/index.js';

/**
 * Memory-based history storage.
 * Messages are stored in memory and lost when the process ends.
 */
export class MemoryHistoryStorage implements HistoryStorage {
    private sessions = new Map<string, InternalMessage[]>();

    async addMessage(sessionId: string, message: InternalMessage): Promise<void> {
        const messages = this.sessions.get(sessionId) || [];
        messages.push(message);
        this.sessions.set(sessionId, messages);

        logger.debug(
            `MemoryHistoryStorage: Added message to session ${sessionId} (total: ${messages.length})`
        );
    }

    async getMessages(sessionId: string): Promise<InternalMessage[]> {
        const messages = this.sessions.get(sessionId) || [];
        logger.debug(
            `MemoryHistoryStorage: Retrieved ${messages.length} messages for session ${sessionId}`
        );
        return [...messages]; // Return a copy
    }

    async clearSession(sessionId: string): Promise<void> {
        const count = this.sessions.get(sessionId)?.length || 0;
        this.sessions.delete(sessionId);
        logger.debug(`MemoryHistoryStorage: Cleared ${count} messages for session ${sessionId}`);
    }

    async getSessions(): Promise<string[]> {
        return Array.from(this.sessions.keys());
    }

    async close(): Promise<void> {
        this.sessions.clear();
    }
}
