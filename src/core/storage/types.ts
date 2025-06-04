import type { InternalMessage } from '../ai/llm/messages/types.js';

/**
 * Storage context for path resolution
 * Used by StoragePathResolver to determine storage locations
 */
export interface StorageContext {
    isDevelopment?: boolean;
    projectRoot?: string;
    forceGlobal?: boolean;
    customRoot?: string;
    connectionString?: string;
    connectionOptions?: Record<string, any>;
}

/**
 * Re-export simplified storage types
 */
export type {
    CacheBackend,
    DatabaseBackend,
    StorageBackends,
    StorageBackendConfig,
    BackendConfig,
} from './backend/types.js';
