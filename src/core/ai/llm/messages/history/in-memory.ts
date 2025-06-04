import { IConversationHistoryProvider } from './types.js';
import { InternalMessage } from '../types.js';

export class InMemoryHistoryProvider implements IConversationHistoryProvider {
    private store: Map<string, InternalMessage[]> = new Map();

    async getHistory(sessionId: string): Promise<InternalMessage[]> {
        return this.store.get(sessionId) ?? [];
    }

    async saveMessage(sessionId: string, message: InternalMessage): Promise<void> {
        const arr = this.store.get(sessionId) || [];
        arr.push(message);
        this.store.set(sessionId, arr);
    }

    async clearHistory(sessionId: string): Promise<void> {
        this.store.delete(sessionId);
    }
}
