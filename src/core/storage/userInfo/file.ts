import * as path from 'path';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import type { UserInfoStorage, StorageContext, StorageProviderConfig } from '../types.js';
import { logger } from '../../logger/index.js';
import { StoragePathResolver } from '../path-resolver.js';

/**
 * File-based user info storage.
 * User information is stored as a single JSON file.
 *
 * File structure:
 * .saiki/userInfo/data.json
 */
export class FileUserInfoStorage implements UserInfoStorage {
    private filePath: string = '';
    private initPromise: Promise<void> | null = null;
    private writeQueue: Promise<void> = Promise.resolve();
    private cache: Map<string, any> = new Map();
    private loaded = false;

    constructor(
        private config: StorageProviderConfig,
        private context: StorageContext
    ) {}

    async get(key: string): Promise<any> {
        await this.ensureLoaded();
        const value = this.cache.get(key);
        logger.debug(
            `FileUserInfoStorage: Retrieved key '${key}' (exists: ${value !== undefined})`
        );
        return value;
    }

    async set(key: string, value: any): Promise<void> {
        await this.ensureLoaded();

        this.cache.set(key, value);

        this.writeQueue = this.writeQueue.then(async () => {
            await this.saveToFile();
            logger.debug(`FileUserInfoStorage: Set key '${key}'`);
        });

        return this.writeQueue;
    }

    async delete(key: string): Promise<void> {
        await this.ensureLoaded();

        const existed = this.cache.delete(key);

        this.writeQueue = this.writeQueue.then(async () => {
            await this.saveToFile();
            logger.debug(`FileUserInfoStorage: Deleted key '${key}' (existed: ${existed})`);
        });

        return this.writeQueue;
    }

    async has(key: string): Promise<boolean> {
        await this.ensureLoaded();
        const exists = this.cache.has(key);
        logger.debug(`FileUserInfoStorage: Checked key '${key}' (exists: ${exists})`);
        return exists;
    }

    async keys(): Promise<string[]> {
        await this.ensureLoaded();
        const keyList = Array.from(this.cache.keys());
        logger.debug(`FileUserInfoStorage: Retrieved ${keyList.length} keys`);
        return keyList;
    }

    async clear(): Promise<void> {
        await this.ensureLoaded();

        const count = this.cache.size;
        this.cache.clear();

        this.writeQueue = this.writeQueue.then(async () => {
            await this.saveToFile();
            logger.debug(`FileUserInfoStorage: Cleared ${count} keys`);
        });

        return this.writeQueue;
    }

    async close(): Promise<void> {
        await this.writeQueue;
    }

    private async ensureLoaded(): Promise<void> {
        if (!this.initPromise) {
            this.initPromise = this.initialize();
        }
        await this.initPromise;

        if (!this.loaded) {
            await this.loadFromFile();
            this.loaded = true;
        }
    }

    private async initialize(): Promise<void> {
        const directoryPath = await StoragePathResolver.resolveStoragePath(
            this.context,
            'userInfo'
        );
        this.filePath = path.join(directoryPath, 'data.json');

        // Ensure directory exists
        await fs.mkdir(directoryPath, { recursive: true });
    }

    private async loadFromFile(): Promise<void> {
        try {
            const content = await fs.readFile(this.filePath, 'utf-8');
            const data = JSON.parse(content);

            this.cache.clear();
            for (const [key, value] of Object.entries(data)) {
                this.cache.set(key, value);
            }

            logger.debug(`FileUserInfoStorage: Loaded ${this.cache.size} keys from file`);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                // File doesn't exist yet, start with empty cache
                this.cache.clear();
                logger.debug('FileUserInfoStorage: Starting with empty data (file not found)');
            } else {
                throw error;
            }
        }
    }

    private async saveToFile(): Promise<void> {
        const data: Record<string, any> = {};
        for (const [key, value] of Array.from(this.cache.entries())) {
            data[key] = value;
        }

        const content = JSON.stringify(data, null, 2);
        await fs.writeFile(this.filePath, content, 'utf-8');
    }
}
