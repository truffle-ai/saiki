import type { IConversationHistoryProvider } from './types.js';
import type { InternalMessage } from '../types.js';
import { logger } from '../../../../logger/index.js';
import type { HistoryStorage } from '../../../../storage/types.js';

/**
 * Universal history provider that works with any HistoryStorage implementation.
 * The storage layer handles the specifics of memory vs file vs database storage.
 */
export class HistoryProvider implements IConversationHistoryProvider {
    constructor(
        private sessionId: string,
        private storage: HistoryStorage
    ) {}

    async getHistory(): Promise<InternalMessage[]> {
        const messages = await this.storage.getMessages(this.sessionId);
        logger.debug(
            `HistoryProvider: Retrieved ${messages.length} messages for session ${this.sessionId}`
        );
        return messages;
    }

    async saveMessage(message: InternalMessage): Promise<void> {
        await this.storage.addMessage(this.sessionId, message);
        logger.debug(`HistoryProvider: Saved message for session ${this.sessionId}`);
    }

    async clearHistory(): Promise<void> {
        await this.storage.clearSession(this.sessionId);
        logger.debug(`HistoryProvider: Cleared history for session ${this.sessionId}`);
    }
}

/**
 * Create a history provider with storage instance
 */
export function createHistoryProviderWithStorage(
    storage: HistoryStorage,
    sessionId: string
): IConversationHistoryProvider {
    return new HistoryProvider(sessionId, storage);
}
