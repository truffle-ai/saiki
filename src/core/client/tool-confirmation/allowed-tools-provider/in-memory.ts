import type { IAllowedToolsProvider } from './types.js';
import { getUserId } from '../../../utils/user-info.js';

export class InMemoryAllowedToolsProvider implements IAllowedToolsProvider {
    private allowedToolsPerUser: Map<string, Set<string>>;

    constructor(allowedToolsMap?: Map<string, Set<string>>) {
        this.allowedToolsPerUser = allowedToolsMap ?? new Map();
    }

    // if userId is not provided, use getUserId() as the default
    private getAllowedSet(userId: string): Set<string> {
        const effectiveUserId = userId ?? getUserId();
        if (!this.allowedToolsPerUser.has(effectiveUserId)) {
            this.allowedToolsPerUser.set(effectiveUserId, new Set());
        }
        return this.allowedToolsPerUser.get(effectiveUserId)!;
    }

    // If userId is omitted, use getUserId() as the default
    async allowTool(toolName: string, userId?: string): Promise<void> {
        const effectiveUserId = userId ?? getUserId();
        this.getAllowedSet(effectiveUserId).add(toolName);
    }

    // If userId is omitted, use getUserId() as the default
    async disallowTool(toolName: string, userId?: string): Promise<void> {
        const effectiveUserId = userId ?? getUserId();
        this.getAllowedSet(effectiveUserId).delete(toolName);
    }

    // If userId is omitted, use getUserId() as the default
    async isToolAllowed(toolName: string, userId?: string): Promise<boolean> {
        const effectiveUserId = userId ?? getUserId();
        return this.getAllowedSet(effectiveUserId).has(toolName);
    }

    // If userId is omitted, use getUserId() as the default
    async getAllowedTools(userId?: string): Promise<Set<string>> {
        const effectiveUserId = userId ?? getUserId();
        // Return a copy to prevent external mutation
        return new Set(this.getAllowedSet(effectiveUserId));
    }
}
