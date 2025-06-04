import type { IConversationHistoryProvider } from './types.js';
import type { InternalMessage } from '../types.js';
import type { DatabaseBackend } from '../../../../storage/backend/types.js';
import { logger } from '../../../../logger/index.js';

/**
 * History provider that works directly with DatabaseBackend.
 * Handles message-specific operations and key formatting internally.
 */
export class DatabaseHistoryProvider implements IConversationHistoryProvider {
    constructor(
        private sessionId: string,
        private database: DatabaseBackend
    ) {}

    async getHistory(): Promise<InternalMessage[]> {
        const key = this.getMessagesKey();
        try {
            // Get all messages for this session (most recent first from append operations)
            const messages = await this.database.getRange<InternalMessage>(key, 0, 1000);
            // Reverse to get chronological order (oldest first)
            const chronologicalMessages = messages.reverse();

            logger.debug(
                `DatabaseHistoryProvider: Retrieved ${chronologicalMessages.length} messages for session ${this.sessionId}`
            );

            return chronologicalMessages;
        } catch (error) {
            logger.error(
                `DatabaseHistoryProvider: Error retrieving messages for session ${this.sessionId}: ${error instanceof Error ? error.message : String(error)}`
            );
            return [];
        }
    }

    async saveMessage(message: InternalMessage): Promise<void> {
        const key = this.getMessagesKey();
        try {
            await this.database.append(key, message);

            // Create safe content preview for logging
            let contentPreview = '[no content]';
            if (message.content) {
                if (typeof message.content === 'string') {
                    contentPreview =
                        message.content.length > 100
                            ? `${message.content.substring(0, 100)}...`
                            : message.content;
                } else if (Array.isArray(message.content)) {
                    contentPreview = `[${message.content.length} parts]`;
                }
            }

            logger.debug(`DatabaseHistoryProvider: Saved message for session ${this.sessionId}`, {
                role: message.role,
                content: contentPreview,
            });
        } catch (error) {
            logger.error(
                `DatabaseHistoryProvider: Error saving message for session ${this.sessionId}: ${error instanceof Error ? error.message : String(error)}`
            );
            throw new Error(
                `Failed to save message: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    async clearHistory(): Promise<void> {
        const key = this.getMessagesKey();
        try {
            await this.database.delete(key);
            logger.debug(`DatabaseHistoryProvider: Cleared history for session ${this.sessionId}`);
        } catch (error) {
            logger.error(
                `DatabaseHistoryProvider: Error clearing session ${this.sessionId}: ${error instanceof Error ? error.message : String(error)}`
            );
            throw new Error(
                `Failed to clear session: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private getMessagesKey(): string {
        return `messages:${this.sessionId}`;
    }
}

/**
 * Create a history provider directly with database backend
 */
export function createDatabaseHistoryProvider(
    database: DatabaseBackend,
    sessionId: string
): IConversationHistoryProvider {
    return new DatabaseHistoryProvider(sessionId, database);
}
