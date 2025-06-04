import { InMemoryAllowedToolsProvider } from './in-memory.js';
import type { IAllowedToolsProvider as IAllowedToolsProvider } from './types.js';

// TODO: Add proper storage backend for allowed tools persistence
// This will require implementing a dedicated storage interface for tool permissions

export interface AllowedToolsConfig {
    type: 'memory';
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

        default:
            throw new Error(`Unknown AllowedToolsProvider type: ${(config as any).type}`);
    }
}
