import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import type { IConversationHistoryProvider } from './types.js';
import type { InternalMessage } from '../types.js';
import { logger } from '../../../../logger/index.js';

// Zod schema for validating history data
const HistorySchema = z.array(z.any()).catch([]);

export class FileHistoryProvider implements IConversationHistoryProvider {
    private dir: string;
    // Queue to serialize write operations and prevent concurrent corruption
    private writeQueue: Promise<void> = Promise.resolve();

    constructor(dir: string) {
        this.dir = dir;
    }

    private filePath(sessionId: string): string {
        // Sanitize sessionId to prevent path traversal
        const sanitizedId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
        return path.join(this.dir, `${sanitizedId}.json`);
    }

    async getHistory(sessionId: string): Promise<InternalMessage[]> {
        logger.debug(`FileHistoryProvider: Getting history for session "${sessionId}"`);
        const fp = this.filePath(sessionId);
        try {
            const data = await fs.readFile(fp, 'utf-8');
            const parsed = JSON.parse(data);
            // Validate with Zod schema - returns empty array if invalid
            const validated = HistorySchema.parse(parsed);
            return validated as InternalMessage[];
        } catch (e: any) {
            if (e.code === 'ENOENT') {
                // No file yet
                return [];
            }
            logger.warn(
                `FileHistoryProvider: Failed to parse history for session "${sessionId}": ${e.message}`
            );
            return [];
        }
    }

    async saveMessage(sessionId: string, message: InternalMessage): Promise<void> {
        // Chain writes to avoid race conditions and file corruption
        this.writeQueue = this.writeQueue
            .then(async () => {
                const fp = this.filePath(sessionId);
                const history = await this.getHistory(sessionId);
                history.push(message);
                logger.debug(
                    `FileHistoryProvider: Saving message to session "${sessionId}" (${history.length} total messages)`
                );
                // Ensure the history directory exists
                await fs.mkdir(path.dirname(fp), { recursive: true });
                // Serialize and write directly to the JSON file (atomic via truncate)
                const data = JSON.stringify(history, null, 2) + '\n';
                const tmp = `${fp}.tmp`;
                await fs.writeFile(tmp, data, 'utf-8');
                await fs.rename(tmp, fp);
                logger.debug(
                    `FileHistoryProvider: Saved message to session "${sessionId}" (${history.length} total messages)`
                );
            })
            .catch((e) => {
                // Handle or log errors in the queue chain (prevent blocking subsequent writes)
                console.error(
                    `FileHistoryProvider: Error writing history for session "${sessionId}": ${e}`
                );
            });
        return this.writeQueue;
    }

    async clearHistory(sessionId: string): Promise<void> {
        const fp = this.filePath(sessionId);
        try {
            await fs.unlink(fp);
        } catch (e: any) {
            if (e.code !== 'ENOENT') {
                throw e;
            }
            // ignore if file does not exist
        }
    }
}
