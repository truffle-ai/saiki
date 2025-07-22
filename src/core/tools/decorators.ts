import { z } from 'zod';
import { Tool, ToolExecutionResult, ToolExecutionContext } from './types.js';

/**
 * Global registry for tools defined via decorators
 */
class ToolRegistry {
    private tools: Map<string, Tool> = new Map();

    register(tool: Tool): void {
        if (this.tools.has(tool.id)) {
            console.warn(`Tool '${tool.id}' is already registered. Overwriting...`);
        }
        this.tools.set(tool.id, tool);
    }

    get(id: string): Tool | undefined {
        return this.tools.get(id);
    }

    getAll(): Tool[] {
        return Array.from(this.tools.values());
    }

    clear(): void {
        this.tools.clear();
    }

    has(id: string): boolean {
        return this.tools.has(id);
    }
}

// Global registry instance
const registry = new ToolRegistry();

/**
 * Tool creation options - clean and simple
 */
export interface CreateToolOptions {
    /** Unique identifier for the tool */
    id: string;
    /** Human-readable description */
    description: string;
    /** Zod schema for input validation */
    inputSchema: z.ZodSchema;
    /** The execution function */
    execute: (input: any, context?: ToolExecutionContext) => Promise<any> | any;
    /** Optional discovery metadata */
    metadata?: {
        category?: string;
        tags?: string[];
        version?: string;
        author?: string;
    };
    /** Optional execution settings */
    settings?: {
        requiresConfirmation?: boolean;
        timeout?: number;
        enableCaching?: boolean;
    };
}

/**
 * Create a tool with the new clean API
 *
 * @example
 * ```typescript
 * export const weatherTool = createTool({
 *   id: "get_weather",
 *   description: "Get weather information for a city",
 *   inputSchema: z.object({
 *     city: z.string(),
 *     units: z.enum(['celsius', 'fahrenheit']).default('celsius')
 *   }),
 *   execute: async ({ city, units }) => {
 *     // Your tool logic here
 *     return { temperature: 20, conditions: "Sunny", units };
 *   },
 *   metadata: {
 *     category: 'weather',
 *     tags: ['api', 'external']
 *   }
 * });
 * ```
 */
export function createTool(options: CreateToolOptions): Tool {
    const tool: Tool = {
        id: options.id,
        description: options.description,
        inputSchema: options.inputSchema,
        execute: options.execute,
        ...(options.metadata && { metadata: options.metadata }),
        ...(options.settings && { settings: options.settings }),
    };

    // Auto-register the tool
    registry.register(tool);

    return tool;
}

/**
 * Decorator for marking functions as tools (legacy support)
 *
 * @param id - Tool identifier
 * @param description - Tool description
 * @param inputSchema - Zod schema for validation
 * @param options - Additional options
 */
export function tool(
    id: string,
    description: string,
    inputSchema: z.ZodSchema,
    options?: {
        metadata?: CreateToolOptions['metadata'];
        settings?: CreateToolOptions['settings'];
    }
) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        const toolDef: Tool = {
            id,
            description,
            inputSchema,
            execute: originalMethod,
            ...(options?.metadata && { metadata: options.metadata }),
            ...(options?.settings && { settings: options.settings }),
        };

        registry.register(toolDef);
        return descriptor;
    };
}

/**
 * Get all registered tools
 */
export function getRegisteredTools(): Tool[] {
    return registry.getAll();
}

/**
 * Get a specific registered tool
 */
export function getRegisteredTool(id: string): Tool | undefined {
    return registry.get(id);
}

/**
 * Clear all registered tools
 */
export function clearRegisteredTools(): void {
    registry.clear();
}

/**
 * Check if a tool is registered
 */
export function isToolRegistered(id: string): boolean {
    return registry.has(id);
}

/**
 * Validate tool execution result
 */
export function validateToolResult(result: any): ToolExecutionResult {
    // If it's already a proper result, return it
    if (result && typeof result === 'object' && 'success' in result) {
        return result as ToolExecutionResult;
    }

    // Otherwise, wrap it in a success result
    return {
        success: true,
        data: result,
    };
}

// Legacy exports for backward compatibility
export { createTool as createParameter }; // Deprecated
export type ToolOptions = CreateToolOptions; // Deprecated
export type ParameterOptions = any; // Deprecated
