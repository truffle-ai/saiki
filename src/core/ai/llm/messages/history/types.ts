import { InternalMessage } from '../types.js';

export interface ConversationHistoryProvider {
    /** Load the full message history for a given session */
    getHistory(sessionId: string): Promise<InternalMessage[]>;

    /** Append a message to the session's history */
    saveMessage(sessionId: string, message: InternalMessage): Promise<void>;

    /** Clear all messages for the given session */
    clearHistory(sessionId: string): Promise<void>;
}
