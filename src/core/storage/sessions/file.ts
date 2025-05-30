import * as path from 'path';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import type {
    SessionData,
    SessionStorage,
    StorageContext,
    StorageProviderConfig,
} from '../types.js';
import { logger } from '../../logger/index.js';
import { StoragePathResolver } from '../path-resolver.js';

interface SessionFileData {
    session: SessionData;
    expiresAt?: number;
    lastUpdated: number;
}

/**
 * File-based session storage with TTL support.
 * Each session is stored as a separate JSON file.
 *
 * Directory structure:
 * .saiki/sessions/
 * ├── session-123.json
 * ├── session-456.json
 * └── index.json
 */
export class FileSessionStorage implements SessionStorage {
    private directoryPath: string = '';
    private indexPath: string = '';
    private initPromise: Promise<void> | null = null;
    private writeQueue: Promise<void> = Promise.resolve();

    constructor(
        private config: StorageProviderConfig,
        private context: StorageContext
    ) {}

    async saveSession(session: SessionData): Promise<void> {
        await this.setSessionWithTTL(session.id, session);
    }

    async getSession(sessionId: string): Promise<SessionData | undefined> {
        await this.ensureInitialized();

        const sessionFile = path.join(this.directoryPath, `${sessionId}.json`);

        try {
            const content = await fs.readFile(sessionFile, 'utf-8');
            const sessionFileData: SessionFileData = JSON.parse(content);

            // Check if session has expired
            if (sessionFileData.expiresAt && Date.now() > sessionFileData.expiresAt) {
                await this.deleteSession(sessionId);
                logger.debug(`FileSessionStorage: Session ${sessionId} expired and removed`);
                return undefined;
            }

            logger.debug(`FileSessionStorage: Retrieved session ${sessionId}`);
            return sessionFileData.session;
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return undefined;
            }
            throw error;
        }
    }

    async deleteSession(sessionId: string): Promise<void> {
        await this.ensureInitialized();

        this.writeQueue = this.writeQueue.then(async () => {
            const sessionFile = path.join(this.directoryPath, `${sessionId}.json`);

            try {
                await fs.unlink(sessionFile);

                // Update index to remove this session
                await this.updateIndex(sessionId, true); // true = remove from index

                logger.debug(`FileSessionStorage: Deleted session ${sessionId}`);
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
        });

        return this.writeQueue;
    }

    async getAllSessions(): Promise<SessionData[]> {
        await this.ensureInitialized();
        await this.cleanupExpiredSessions(); // Clean up first

        try {
            const files = await fs.readdir(this.directoryPath);
            const sessionFiles = files.filter(
                (file) => file.endsWith('.json') && file !== 'index.json'
            );

            const sessions: SessionData[] = [];

            for (const file of sessionFiles) {
                try {
                    const content = await fs.readFile(path.join(this.directoryPath, file), 'utf-8');
                    const sessionFileData: SessionFileData = JSON.parse(content);
                    sessions.push(sessionFileData.session);
                } catch (error) {
                    logger.warn(`Failed to read session file ${file}: ${error}`);
                }
            }

            logger.debug(`FileSessionStorage: Retrieved ${sessions.length} sessions`);
            return sessions;
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    async setSessionWithTTL(
        sessionId: string,
        session: SessionData,
        ttlMs?: number
    ): Promise<void> {
        await this.ensureInitialized();

        this.writeQueue = this.writeQueue.then(async () => {
            const sessionFile = path.join(this.directoryPath, `${sessionId}.json`);

            const sessionFileData: SessionFileData = {
                session: { ...session, id: sessionId },
                expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
                lastUpdated: Date.now(),
            };

            await fs.writeFile(sessionFile, JSON.stringify(sessionFileData, null, 2), 'utf-8');

            // Update index
            await this.updateIndex(sessionId);

            logger.debug(`FileSessionStorage: Saved session ${sessionId} with TTL ${ttlMs}ms`);
        });

        return this.writeQueue;
    }

    async getActiveSessions(): Promise<string[]> {
        await this.ensureInitialized();
        await this.cleanupExpiredSessions(); // Clean up first

        try {
            const files = await fs.readdir(this.directoryPath);
            const sessionFiles = files.filter(
                (file) => file.endsWith('.json') && file !== 'index.json'
            );

            return sessionFiles.map((file) => path.basename(file, '.json'));
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    async cleanupExpiredSessions(): Promise<number> {
        await this.ensureInitialized();

        // Wrap the entire cleanup operation in the write queue to prevent race conditions
        const cleanupPromise = this.writeQueue.then(async () => {
            try {
                const files = await fs.readdir(this.directoryPath);
                const sessionFiles = files.filter(
                    (file) => file.endsWith('.json') && file !== 'index.json'
                );

                let cleanedCount = 0;
                const now = Date.now();

                for (const file of sessionFiles) {
                    try {
                        const content = await fs.readFile(
                            path.join(this.directoryPath, file),
                            'utf-8'
                        );
                        const sessionFileData: SessionFileData = JSON.parse(content);

                        if (sessionFileData.expiresAt && now > sessionFileData.expiresAt) {
                            const sessionId = path.basename(file, '.json');
                            const sessionFile = path.join(this.directoryPath, `${sessionId}.json`);

                            try {
                                await fs.unlink(sessionFile);
                                // Update index to remove this session
                                await this.updateIndex(sessionId, true); // true = remove from index
                                logger.debug(
                                    `FileSessionStorage: Deleted expired session ${sessionId}`
                                );
                                cleanedCount++;
                            } catch (error: any) {
                                if (error.code !== 'ENOENT') {
                                    logger.warn(
                                        `Failed to delete expired session ${sessionId}: ${error}`
                                    );
                                }
                            }
                        }
                    } catch (error) {
                        logger.warn(
                            `Failed to check expiration for session file ${file}: ${error}`
                        );
                    }
                }

                if (cleanedCount > 0) {
                    logger.debug(`FileSessionStorage: Cleaned up ${cleanedCount} expired sessions`);
                }

                return cleanedCount;
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    return 0;
                }
                throw error;
            }
        });

        // Update the write queue to maintain proper serialization (void return)
        this.writeQueue = cleanupPromise.then(() => {});

        return cleanupPromise;
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
        this.directoryPath = await StoragePathResolver.resolveStoragePath(this.context, 'sessions');
        this.indexPath = path.join(this.directoryPath, 'index.json');

        // Ensure directory exists
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
            logger.warn(`Failed to update sessions index: ${error}`);
        }
    }
}
