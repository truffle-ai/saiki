import type { HistoryStorage, StorageProviderConfig, StorageContext } from '../types.js';
import { MemoryHistoryStorage } from './memory.js';
import { FileHistoryStorage } from './file.js';

/**
 * Create a history storage instance based on configuration
 */
export function createHistoryStorage(
    config: StorageProviderConfig,
    context: StorageContext
): HistoryStorage {
    switch (config.type) {
        case 'memory':
            return new MemoryHistoryStorage();

        case 'file':
            return new FileHistoryStorage(config, context);

        case 'sqlite':
            throw new Error('SQLite history storage not yet implemented');

        case 'database':
            throw new Error('Database history storage not yet implemented');

        case 'redis':
            throw new Error('Redis history storage not yet implemented');

        case 's3':
            throw new Error('S3 history storage not yet implemented');

        default:
            throw new Error(`Unknown history storage type: ${(config as any).type}`);
    }
}
