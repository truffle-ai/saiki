/**
 * Saiki Storage Layer
 *
 * A storage system with two backend types:
 * - CacheBackend: Fast, ephemeral storage (Redis, Memory) with TTL support
 * - DatabaseBackend: Persistent, reliable storage (PostgreSQL, SQLite, Memory) with list operations
 *
 * Usage:
 *
 * ```typescript
 * // Initialize storage with configuration
 * const storage = await initializeStorage({
 *   cache: { type: 'memory' },
 *   database: { type: 'memory' }
 * });
 *
 * // Use cache for temporary data
 * await storage.cache.set('session:123', sessionData, 3600); // 1 hour TTL
 * const sessionData = await storage.cache.get('session:123');
 *
 * // Use database for persistent data
 * await storage.database.set('user:456', userData);
 * await storage.database.append('messages:789', message);
 * const messages = await storage.database.getRange('messages:789', 0, 50);
 * ```
 */

// Main storage manager and utilities
export {
    StorageManager,
    initializeStorage,
    getStorage,
    shutdownStorage,
    getStorageInfo,
    checkStorageHealth,
} from './storage-manager.js';

// Backend interfaces
export type {
    CacheBackend,
    DatabaseBackend,
    StorageBackends,
    BackendConfig,
    StorageConfig,
} from './backend/types.js';

// Backend implementations - always available
export { MemoryBackend } from './backend/memory-backend.js';

// Note: Backend configuration types (RedisBackendConfig, PostgresBackendConfig, etc.)
// are exported from './config/schemas.js' to maintain single source of truth
// Note: Actual backend classes are lazy-loaded by StorageManager to handle optional dependencies
