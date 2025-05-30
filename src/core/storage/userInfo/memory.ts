import type { UserInfoStorage } from '../types.js';
import { logger } from '../../logger/index.js';

/**
 * Memory-based user info storage.
 * User information is stored in memory and lost when the process ends.
 */
export class MemoryUserInfoStorage implements UserInfoStorage {
    private data = new Map<string, any>();

    async get(key: string): Promise<any> {
        const value = this.data.get(key);
        logger.debug(
            `MemoryUserInfoStorage: Retrieved key '${key}' (exists: ${value !== undefined})`
        );
        return value;
    }

    async set(key: string, value: any): Promise<void> {
        this.data.set(key, value);
        logger.debug(`MemoryUserInfoStorage: Set key '${key}'`);
    }

    async delete(key: string): Promise<void> {
        const existed = this.data.delete(key);
        logger.debug(`MemoryUserInfoStorage: Deleted key '${key}' (existed: ${existed})`);
    }

    async has(key: string): Promise<boolean> {
        const exists = this.data.has(key);
        logger.debug(`MemoryUserInfoStorage: Checked key '${key}' (exists: ${exists})`);
        return exists;
    }

    async keys(): Promise<string[]> {
        const keyList = Array.from(this.data.keys());
        logger.debug(`MemoryUserInfoStorage: Retrieved ${keyList.length} keys`);
        return keyList;
    }

    async clear(): Promise<void> {
        const count = this.data.size;
        this.data.clear();
        logger.debug(`MemoryUserInfoStorage: Cleared ${count} keys`);
    }

    async close(): Promise<void> {
        this.data.clear();
    }
}
