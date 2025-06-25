import type { StorageManager } from '@core/storage/storage-manager.js';
import type { IAllowedToolsProvider } from './types.js';

/**
 * Storage-backed implementation that persists allowed tools in the Saiki
 * StorageManager cache backend. The key scheme is:
 *   allowedTools:<sessionId>          – approvals scoped to a session
 *   allowedTools:global               – global approvals (sessionId undefined)
 *
 * Using the cache layer allows TTLs if the underlying backend supports it.
 */
export class StorageAllowedToolsProvider implements IAllowedToolsProvider {
    constructor(private storageManager: StorageManager) {}

    private buildKey(sessionId?: string) {
        return sessionId ? `allowedTools:${sessionId}` : 'allowedTools:global';
    }

    async allowTool(toolName: string, sessionId?: string): Promise<void> {
        const key = this.buildKey(sessionId);
        const set = (await this.storageManager.cache.get<Set<string>>(key)) ?? new Set<string>();
        set.add(toolName);
        await this.storageManager.cache.set(key, set);
    }

    async disallowTool(toolName: string, sessionId?: string): Promise<void> {
        const key = this.buildKey(sessionId);
        const set = (await this.storageManager.cache.get<Set<string>>(key)) ?? new Set<string>();
        set.delete(toolName);
        await this.storageManager.cache.set(key, set);
    }

    async isToolAllowed(toolName: string, sessionId?: string): Promise<boolean> {
        const sessionSet = await this.storageManager.cache.get<Set<string>>(
            this.buildKey(sessionId)
        );
        if (sessionSet?.has(toolName)) return true;
        // Fallback to global approvals
        const globalSet = await this.storageManager.cache.get<Set<string>>(
            this.buildKey(undefined)
        );
        return globalSet?.has(toolName) ?? false;
    }

    async getAllowedTools(sessionId?: string): Promise<Set<string>> {
        return (
            (await this.storageManager.cache.get<Set<string>>(this.buildKey(sessionId))) ??
            new Set<string>()
        );
    }
}
