import type { UserInfoStorage, StorageProviderConfig, StorageContext } from '../types.js';
import { MemoryUserInfoStorage } from './memory.js';
import { FileUserInfoStorage } from './file.js';

/**
 * Create a user info storage instance based on configuration
 */
export function createUserInfoStorage(
    config: StorageProviderConfig,
    context: StorageContext
): UserInfoStorage {
    switch (config.type) {
        case 'memory':
            return new MemoryUserInfoStorage();

        case 'file':
            return new FileUserInfoStorage(config, context);

        case 'sqlite':
            throw new Error('SQLite user info storage not yet implemented');

        case 'database':
            throw new Error('Database user info storage not yet implemented');

        case 'redis':
            throw new Error('Redis user info storage not yet implemented');

        case 's3':
            throw new Error('S3 user info storage not yet implemented');

        default:
            throw new Error(`Unknown user info storage type: ${(config as any).type}`);
    }
}
