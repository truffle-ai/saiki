import type { CacheBackend } from './cache-backend.js';
import type { DatabaseBackend } from './database-backend.js';

// Re-export interfaces
export type { CacheBackend, DatabaseBackend };

/**
 * Collection of storage backends for different use cases
 */
export interface StorageBackends {
    cache: CacheBackend; // Fast, ephemeral (Redis, Memory)
    database: DatabaseBackend; // Persistent, reliable (PostgreSQL, SQLite, Memory)
}

/**
 * Configuration for storage backends
 */
export interface BackendConfig {
    type: 'memory' | 'redis' | 'sqlite' | 'postgres';
    url?: string;
    path?: string;
    connectionString?: string;
    host?: string;
    port?: number;
    password?: string;
    database?: number;
    maxConnections?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    options?: Record<string, any>;
}

/**
 * Storage configuration
 */
export interface StorageBackendConfig {
    cache: BackendConfig;
    database: BackendConfig;
}

/**
 * Error types for storage operations
 */
export class StorageError extends Error {
    constructor(
        message: string,
        public readonly operation: string,
        public override readonly cause?: Error
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
