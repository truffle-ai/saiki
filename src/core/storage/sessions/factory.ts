import type { SessionStorage, StorageProviderConfig, StorageContext } from '../types.js';
import { MemorySessionStorage } from './memory.js';
import { FileSessionStorage } from './file.js';

/**
 * Create a session storage instance based on configuration
 */
export function createSessionStorage(
    config: StorageProviderConfig,
    context: StorageContext
): SessionStorage {
    switch (config.type) {
        case 'memory':
            return new MemorySessionStorage();

        case 'file':
            return new FileSessionStorage(config, context);

        case 'sqlite':
            throw new Error('SQLite session storage not yet implemented');

        case 'database':
            throw new Error('Database session storage not yet implemented');

        case 'redis':
            throw new Error('Redis session storage not yet implemented');

        case 's3':
            throw new Error('S3 session storage not yet implemented');

        default:
            throw new Error(`Unknown session storage type: ${(config as any).type}`);
    }
}
