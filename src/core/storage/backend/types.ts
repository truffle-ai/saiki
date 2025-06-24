import type { CacheBackend } from './cache-backend.js';
import type { DatabaseBackend } from './database-backend.js';

// Re-export interfaces
export type { CacheBackend, DatabaseBackend };

// Re-export schema types for convenience
export type {
    BackendConfig,
    StorageConfig,
    InMemoryBackendConfig,
    RedisBackendConfig,
    SqliteBackendConfig,
    PostgresBackendConfig,
} from '../../config/schemas.js';

/**
 * Collection of storage backends for different use cases
 */
export interface StorageBackends {
    cache: CacheBackend; // Fast, ephemeral (Redis, Memory)
    database: DatabaseBackend; // Persistent, reliable (PostgreSQL, SQLite, Memory)
}

/**
 * Error types for storage operations
 */
export class StorageError extends Error {
    constructor(
        override message: string,
        public readonly operation: string,
        public readonly cause?: Error
    ) {
        super(message);
        this.name = 'StorageError';
    }
}

export class StorageConnectionError extends StorageError {
    constructor(message: string, cause?: Error) {
        super(message, 'CONNECTION_ERROR', cause);
        this.name = 'StorageConnectionError';
    }
}

export class StorageNotFoundError extends StorageError {
    constructor(key: string) {
        super(`Key not found: ${key}`, 'NOT_FOUND');
        this.name = 'StorageNotFoundError';
    }
}
