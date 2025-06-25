import { InMemoryAllowedToolsProvider } from './in-memory.js';
import { StorageAllowedToolsProvider } from './storage.js';
import type { IAllowedToolsProvider } from './types.js';
import type { StorageManager } from '@core/storage/storage-manager.js';

// TODO: Add proper storage backend for allowed tools persistence
// This will require implementing a dedicated storage interface for tool permissions

export interface AllowedToolsConfig {
    type: 'memory' | 'storage';
    storageManager?: StorageManager;
}

/**
 * Create an AllowedToolsProvider based on configuration.
 *
 * Currently only memory-based provider is available.
 * TODO: Add storage-based provider for persistence across sessions.
 */
export function createAllowedToolsProvider(config: AllowedToolsConfig): IAllowedToolsProvider {
    switch (config.type) {
        case 'memory':
            return new InMemoryAllowedToolsProvider();

        case 'storage':
            if (!config.storageManager) {
                throw new Error(
                    'storageManager is required for storage-based AllowedToolsProvider'
                );
            }
            return new StorageAllowedToolsProvider(config.storageManager);

        default:
            throw new Error(`Unknown AllowedToolsProvider type: ${(config as any).type}`);
    }
}
