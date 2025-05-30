import * as path from 'path';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import type { HistoryStorage, StorageContext, StorageProviderConfig } from '../types.js';
import type { InternalMessage } from '../../ai/llm/messages/types.js';
import { logger } from '../../logger/index.js';
import { StoragePathResolver } from '../path-resolver.js';

/**
 * File-based history storage.
 * Each session's messages are stored in a separate JSON file.
 *
 * Directory structure:
 * .saiki/history/
 * ├── session-123.json
 * ├── session-456.json
 * └── index.json
 */
export class FileHistoryStorage implements HistoryStorage {
    private directoryPath: string = '';
    private indexPath: string = '';
    private initPromise: Promise<void> | null = null;
    private writeQueue: Promise<void> = Promise.resolve();

    constructor(
        private config: StorageProviderConfig,
        private context: StorageContext
    ) {}

    async addMessage(sessionId: string, message: InternalMessage): Promise<void> {
        await this.ensureInitialized();

        this.writeQueue = this.writeQueue.then(async () => {
            const sessionDir = path.join(this.directoryPath, sessionId);
            await fs.mkdir(sessionDir, { recursive: true });

            const messagesFile = path.join(sessionDir, 'messages.jsonl');

            // Append message to session's message file
            const messageLine =
                JSON.stringify({
                    timestamp: Date.now(),
                    message: message,
                }) + '\n';

            await fs.appendFile(messagesFile, messageLine, 'utf-8');

            // Update global index
            await this.updateIndex(sessionId);

            logger.debug(`FileHistoryStorage: Added message to session ${sessionId}`);
        });

        return this.writeQueue;
    }

    async getMessages(sessionId: string): Promise<InternalMessage[]> {
        await this.ensureInitialized();

        const messagesFile = path.join(this.directoryPath, sessionId, 'messages.jsonl');

        try {
            const content = await fs.readFile(messagesFile, 'utf-8');
            const messages = content
                .trim()
                .split('\n')
                .filter((line) => line.trim())
                .map((line, index) => {
                    try {
                        const parsed = JSON.parse(line);
                        return parsed.message;
                    } catch (parseError) {
                        logger.warn(
                            `FileHistoryStorage: Skipping corrupted message at line ${index + 1} in session ${sessionId}: ${parseError.message}`,
                            { line: line.substring(0, 100) + (line.length > 100 ? '...' : '') }
                        );
                        return null;
                    }
                })
                .filter((message): message is InternalMessage => message !== null);

            logger.debug(
                `FileHistoryStorage: Retrieved ${messages.length} messages for session ${sessionId}`
            );
            return messages;
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    async clearSession(sessionId: string): Promise<void> {
        await this.ensureInitialized();

        this.writeQueue = this.writeQueue.then(async () => {
            const sessionDir = path.join(this.directoryPath, sessionId);

            try {
                // Remove the entire session directory
                await fs.rm(sessionDir, { recursive: true, force: true });

                // Update global index to remove this session
                await this.updateIndex(sessionId, true); // true = remove from index

                logger.debug(`FileHistoryStorage: Cleared session ${sessionId}`);
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
        });

        return this.writeQueue;
    }

    async getSessions(): Promise<string[]> {
        await this.ensureInitialized();

        try {
            const sessions = await fs.readdir(this.directoryPath);
            const validSessions: string[] = [];

            for (const sessionId of sessions) {
                const sessionDir = path.join(this.directoryPath, sessionId);
                try {
                    const stat = await fs.stat(sessionDir);
                    if (stat.isDirectory()) {
                        validSessions.push(sessionId);
                    }
                } catch {
                    // Skip invalid entries
                }
            }

            return validSessions;
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    async close(): Promise<void> {
        await this.writeQueue;
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.initPromise) {
            this.initPromise = this.initialize();
        }
        await this.initPromise;
    }

    private async initialize(): Promise<void> {
        this.directoryPath = await StoragePathResolver.resolveStoragePath(this.context, 'history');
        this.indexPath = path.join(this.directoryPath, 'index.json');

        // Ensure directories exist
        await fs.mkdir(this.directoryPath, { recursive: true });
    }

    private async updateIndex(sessionId: string, remove: boolean = false): Promise<void> {
        try {
            let index: { sessions: string[]; lastUpdated: number } = {
                sessions: [],
                lastUpdated: Date.now(),
            };

            try {
                const content = await fs.readFile(this.indexPath, 'utf-8');
                index = JSON.parse(content);
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }

            if (remove) {
                index.sessions = index.sessions.filter((id) => id !== sessionId);
            } else {
                if (!index.sessions.includes(sessionId)) {
                    index.sessions.push(sessionId);
                }
            }

            index.lastUpdated = Date.now();

            await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
        } catch (error) {
            logger.warn(`Failed to update history index: ${error}`);
        }
    }
}
