import { z } from 'zod';
import { Tool, ToolExecutionResult, ToolExecutionContext } from './types.js';
import { globalToolRegistry } from './tool-registry.js';

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
 * Create a tool with the clean API
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

    // Auto-register the tool in the global registry
    globalToolRegistry.register(tool);

    return tool;
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

/**
 * Validate tool definition
 */
export function validateToolDefinition(tool: Tool): boolean {
    if (!tool.id || typeof tool.id !== 'string') {
        return false;
    }

    if (!tool.description || typeof tool.description !== 'string') {
        return false;
    }

    if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
        return false;
    }

    if (!tool.execute || typeof tool.execute !== 'function') {
        return false;
    }

    return true;
}
