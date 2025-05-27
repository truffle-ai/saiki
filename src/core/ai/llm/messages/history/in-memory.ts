import { ConversationHistoryProvider } from './types.js';

export class InMemoryHistoryProvider implements ConversationHistoryProvider {
    private store: Map<string, import('../types.js').InternalMessage[]> = new Map();

    async getHistory(sessionId: string): Promise<import('../types.js').InternalMessage[]> {
        return this.store.get(sessionId) ?? [];
    }

    async saveMessage(
        sessionId: string,
        message: import('../types.js').InternalMessage
    ): Promise<void> {
        const arr = this.store.get(sessionId) || [];
        arr.push(message);
        this.store.set(sessionId, arr);
    }

    async clearHistory(sessionId: string): Promise<void> {
        this.store.delete(sessionId);
    }
}
