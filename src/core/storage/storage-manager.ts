import type {
    CacheBackend,
    DatabaseBackend,
    StorageBackends,
    StorageBackendConfig,
} from './backend/types.js';
import { MemoryBackend } from './backend/memory-backend.js';

// Lazy imports for optional dependencies
let SQLiteBackend: any;
let RedisBackend: any;
let PostgresBackend: any;

/**
 * Storage manager that initializes and manages storage backends.
 * Handles both cache and database backends with automatic fallbacks.
 */
export class StorageManager {
    private config: StorageBackendConfig;
    private cache?: CacheBackend;
    private database?: DatabaseBackend;
    private connected = false;

    constructor(config: StorageBackendConfig) {
        this.config = config;
    }

    async connect(): Promise<StorageBackends> {
        if (this.connected) {
            return {
                cache: this.cache!,
                database: this.database!,
            };
        }

        // Initialize cache backend
        this.cache = await this.createCacheBackend();
        await this.cache.connect();

        // Initialize database backend
        this.database = await this.createDatabaseBackend();
        await this.database.connect();

        this.connected = true;

        return {
            cache: this.cache,
            database: this.database,
        };
    }

    async disconnect(): Promise<void> {
        if (this.cache) {
            await this.cache.disconnect();
            this.cache = undefined as any;
        }

        if (this.database) {
            await this.database.disconnect();
            this.database = undefined as any;
        }

        this.connected = false;
    }

    isConnected(): boolean {
        return (
            this.connected &&
            this.cache?.isConnected() === true &&
            this.database?.isConnected() === true
        );
    }

    getBackends(): StorageBackends | null {
        if (!this.connected) return null;

        return {
            cache: this.cache!,
            database: this.database!,
        };
    }

    private async createCacheBackend(): Promise<CacheBackend> {
        const cacheConfig = this.config.cache;

        switch (cacheConfig.type) {
            case 'redis':
                return this.createRedisBackend(cacheConfig);

            case 'memory':
            default:
                console.log('Using memory cache backend');
                return new MemoryBackend();
        }
    }

    private async createDatabaseBackend(): Promise<DatabaseBackend> {
        const dbConfig = this.config.database;

        switch (dbConfig.type) {
            case 'postgres':
                return this.createPostgresBackend(dbConfig);

            case 'sqlite':
                return this.createSQLiteBackend(dbConfig);

            case 'memory':
            default:
                console.log('Using memory database backend');
                return new MemoryBackend();
        }
    }

    private async createRedisBackend(config: any): Promise<CacheBackend> {
        try {
            if (!RedisBackend) {
                const module = await import('./backend/redis-backend.js');
                RedisBackend = module.RedisBackend;
            }
            console.log(`Connecting to Redis at ${config.host}:${config.port}`);
            return new RedisBackend(config);
        } catch (error) {
            console.warn('Redis not available, falling back to memory cache:', error);
            return new MemoryBackend();
        }
    }

    private async createPostgresBackend(config: any): Promise<DatabaseBackend> {
        try {
            if (!PostgresBackend) {
                const module = await import('./backend/postgres-backend.js');
                PostgresBackend = module.PostgresBackend;
            }
            console.log('Connecting to PostgreSQL database');
            return new PostgresBackend(config);
        } catch (error) {
            console.warn('PostgreSQL not available, falling back to memory database:', error);
            return new MemoryBackend();
        }
    }

    private async createSQLiteBackend(config: any): Promise<DatabaseBackend> {
        try {
            if (!SQLiteBackend) {
                const module = await import('./backend/sqlite-backend.js');
                SQLiteBackend = module.SQLiteBackend;
            }
            console.log(`Using SQLite database at ${config.path}`);
            return new SQLiteBackend(config);
        } catch (error) {
            console.warn('SQLite not available, falling back to memory database:', error);
            return new MemoryBackend();
        }
    }

    // Utility methods
    async getInfo(): Promise<{
        cache: { type: string; connected: boolean };
        database: { type: string; connected: boolean };
        connected: boolean;
    }> {
        return {
            cache: {
                type: this.cache?.getBackendType() || 'none',
                connected: this.cache?.isConnected() || false,
            },
            database: {
                type: this.database?.getBackendType() || 'none',
                connected: this.database?.isConnected() || false,
            },
            connected: this.connected,
        };
    }

    // Health check
    async healthCheck(): Promise<{
        cache: boolean;
        database: boolean;
        overall: boolean;
    }> {
        let cacheHealthy = false;
        let databaseHealthy = false;

        try {
            if (this.cache?.isConnected()) {
                await this.cache.set('health_check', 'ok', 10);
                const result = await this.cache.get('health_check');
                cacheHealthy = result === 'ok';
                await this.cache.delete('health_check');
            }
        } catch (error) {
            console.warn('Cache health check failed:', error);
        }

        try {
            if (this.database?.isConnected()) {
                await this.database.set('health_check', 'ok');
                const result = await this.database.get('health_check');
                databaseHealthy = result === 'ok';
                await this.database.delete('health_check');
            }
        } catch (error) {
            console.warn('Database health check failed:', error);
        }

        return {
            cache: cacheHealthy,
            database: databaseHealthy,
            overall: cacheHealthy && databaseHealthy,
        };
    }
}

// Default storage manager instance
let defaultStorageManager: StorageManager | null = null;

/**
 * Initialize the default storage manager with configuration
 */
export async function initializeStorage(config: StorageBackendConfig): Promise<StorageBackends> {
    if (defaultStorageManager) {
        await defaultStorageManager.disconnect();
    }

    defaultStorageManager = new StorageManager(config);
    return await defaultStorageManager.connect();
}

/**
 * Get the current storage backends (cache and database)
 */
export function getStorage(): StorageBackends | null {
    return defaultStorageManager?.getBackends() || null;
}

/**
 * Shutdown storage and cleanup connections
 */
export async function shutdownStorage(): Promise<void> {
    if (defaultStorageManager) {
        await defaultStorageManager.disconnect();
        defaultStorageManager = null;
    }
}

/**
 * Get storage manager info for debugging
 */
export async function getStorageInfo() {
    return defaultStorageManager?.getInfo() || null;
}

/**
 * Run health check on storage backends
 */
export async function checkStorageHealth() {
    return defaultStorageManager?.healthCheck() || null;
}
