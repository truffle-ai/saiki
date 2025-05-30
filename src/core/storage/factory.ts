import type { StorageContext, StorageInstances } from './types.js';
import type { StorageConfig } from '../config/schemas.js';
import { createHistoryStorage } from './history/factory.js';
import { createSessionStorage } from './sessions/factory.js';
import { createUserInfoStorage } from './userInfo/factory.js';
import { StoragePathResolver } from './path-resolver.js';

/**
 * Create all storage instances based on configuration
 */
export function createStorageInstances(
    config: StorageConfig,
    context: StorageContext
): StorageInstances {
    return {
        history: createHistoryStorage(config.history, context),
        sessions: createSessionStorage(config.sessions, context),
        userInfo: createUserInfoStorage(config.userInfo, context),
    };
}

/**
 * Create a storage context for local file-based storage
 */
export async function createLocalStorageContext(
    options: {
        isDevelopment?: boolean;
        projectRoot?: string;
        forceGlobal?: boolean;
        customRoot?: string;
    } = {}
): Promise<StorageContext> {
    return StoragePathResolver.createLocalContext(options);
}

/**
 * Create a storage context for local file-based storage with automatic global detection
 */
export async function createLocalStorageContextWithAutoDetection(
    options: {
        isDevelopment?: boolean;
        projectRoot?: string;
        customRoot?: string;
    } = {}
): Promise<StorageContext> {
    return StoragePathResolver.createLocalContextWithAutoDetection(options);
}

/**
 * Create a storage context for remote storage
 */
export function createRemoteStorageContext(
    connectionString: string,
    options: {
        isDevelopment?: boolean;
        projectRoot?: string;
        connectionOptions?: Record<string, any>;
    } = {}
): StorageContext {
    return StoragePathResolver.createRemoteContext(connectionString, options);
}
