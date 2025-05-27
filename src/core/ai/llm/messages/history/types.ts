export interface ConversationHistoryProvider {
    /** Load the full message history for a given session */
    getHistory(sessionId: string): Promise<import('../types.js').InternalMessage[]>;

    /** Append a message to the session's history */
    saveMessage(sessionId: string, message: import('../types.js').InternalMessage): Promise<void>;

    /** Clear all messages for the given session */
    clearHistory(sessionId: string): Promise<void>;
}
