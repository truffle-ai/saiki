import type { IAllowedToolsProvider } from './types.js';

export class InMemoryAllowedToolsProvider implements IAllowedToolsProvider {
    private allowedTools: Set<string>;

    constructor(allowedTools?: Set<string>) {
        this.allowedTools = allowedTools ?? new Set();
    }

    async allowTool(toolName: string): Promise<void> {
        this.allowedTools.add(toolName);
    }

    async disallowTool(toolName: string): Promise<void> {
        this.allowedTools.delete(toolName);
    }

    async isToolAllowed(toolName: string): Promise<boolean> {
        return this.allowedTools.has(toolName);
    }

    async getAllowedTools(): Promise<Set<string>> {
        // Return a copy to prevent external mutation
        return new Set(this.allowedTools);
    }
}
