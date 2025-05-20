import { promises as fs } from 'fs';
import path from 'path';
import type { ConversationHistoryProvider } from './types.js';
import type { InternalMessage } from '../types.js';
import { logger } from '../../../../logger/index.js';

export class FileHistoryProvider implements ConversationHistoryProvider {
    private dir: string;
    // Queue to serialize write operations and prevent concurrent corruption
    private writeQueue: Promise<void> = Promise.resolve();

    constructor(dir: string) {
        this.dir = dir;
    }

    private filePath(sessionId: string): string {
        return path.join(this.dir, `${sessionId}.json`);
    }

    async getHistory(sessionId: string): Promise<InternalMessage[]> {
        logger.debug(`FileHistoryProvider: Getting history for session "${sessionId}"`);
        const fp = this.filePath(sessionId);
        try {
            const data = await fs.readFile(fp, 'utf-8');
            return JSON.parse(data) as InternalMessage[];
        } catch (e: any) {
            if (e.code === 'ENOENT') {
                // No file yet
                return [];
            }
            throw e;
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
                    `FileHistoryProvider: Saving history for session "${sessionId}" to ${fp}: ${JSON.stringify(history, null, 2)}`
                );
                // Ensure the history directory exists
                await fs.mkdir(path.dirname(fp), { recursive: true });
                // Serialize and write directly to the JSON file (atomic via truncate)
                const data = JSON.stringify(history, null, 2) + '\n';
                await fs.writeFile(fp, data, 'utf-8');
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
