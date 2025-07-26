import { Tool } from './types.js';
import { logger } from '../logger/index.js';

/**
 * Centralized registry for tool management
 *
 * Follows single responsibility principle - only handles tool storage and retrieval
 */
export class ToolRegistry {
    private tools: Map<string, Tool> = new Map();

    /**
     * Register a tool in the registry
     */
    register(tool: Tool): void {
        if (this.tools.has(tool.id)) {
            logger.warn(`Tool '${tool.id}' is already registered, overwriting`);
        }

        this.tools.set(tool.id, tool);
        logger.debug(`Registered tool: ${tool.id}`);
    }

    /**
     * Get a specific tool by ID
     */
    get(id: string): Tool | undefined {
        return this.tools.get(id);
    }

    /**
     * Get all registered tools
     */
    getAll(): Tool[] {
        return Array.from(this.tools.values());
    }

    /**
     * Get all tool IDs
     */
    getToolIds(): string[] {
        return Array.from(this.tools.keys());
    }

    /**
     * Check if a tool is registered
     */
    has(id: string): boolean {
        return this.tools.has(id);
    }

    /**
     * Remove a tool from the registry
     */
    unregister(id: string): boolean {
        const removed = this.tools.delete(id);
        if (removed) {
            logger.debug(`Unregistered tool: ${id}`);
        }
        return removed;
    }

    /**
     * Get tools by category
     */
    getByCategory(category: string): Tool[] {
        return this.getAll().filter((tool) => tool.metadata?.category === category);
    }

    /**
     * Get tools by tags
     */
    getByTags(tags: string[]): Tool[] {
        return this.getAll().filter((tool) =>
            tool.metadata?.tags?.some((tag) => tags.includes(tag))
        );
    }

    /**
     * Clear all tools
     */
    clear(): void {
        const count = this.tools.size;
        this.tools.clear();
        logger.debug(`Cleared ${count} tools from registry`);
    }

    /**
     * Get registry statistics
     */
    getStats(): {
        totalTools: number;
        categories: Record<string, number>;
        tags: Record<string, number>;
    } {
        const tools = this.getAll();
        const categories: Record<string, number> = {};
        const tags: Record<string, number> = {};

        for (const tool of tools) {
            // Count categories
            const category = tool.metadata?.category || 'uncategorized';
            categories[category] = (categories[category] || 0) + 1;

            // Count tags
            if (tool.metadata?.tags) {
                for (const tag of tool.metadata.tags) {
                    tags[tag] = (tags[tag] || 0) + 1;
                }
            }
        }

        return {
            totalTools: tools.length,
            categories,
            tags,
        };
    }
}

// Global registry instance for decorator-style registration
export const globalToolRegistry = new ToolRegistry();
