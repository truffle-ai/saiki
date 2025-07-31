/**
 * Context passed to tool execution
 */
export interface ToolExecutionContext {
    /** Session ID if available */
    sessionId?: string | undefined;
}

/**
 * Simple tool interface for internal tools
 */
export interface Tool {
    /** Unique identifier for the tool */
    id: string;

    /** Human-readable description of what the tool does */
    description: string;

    /** Zod schema defining the input parameters */
    inputSchema: any; // Using any for flexibility since we don't import zod here

    /** The actual function that executes the tool */
    execute: (input: any, context?: ToolExecutionContext) => Promise<any> | any;
}

/**
 * Tool parameters interface for normalized tool definitions
 */
export interface ToolParameters {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown; // Allow additional JSON Schema properties
}

/**
 * Raw tool definition interface (before normalization)
 */
export interface RawToolDefinition {
    description?: string;
    parameters?: {
        type?: string;
        properties?: Record<string, unknown>;
        required?: string[];
    };
}

/**
 * Tool manager's unified tool set (for compatibility with MCP tools and ai/types.ts)
 */
export interface ToolManagerToolSet {
    [toolName: string]: {
        name?: string;
        description: string;
        parameters?: ToolParameters;
    };
}
