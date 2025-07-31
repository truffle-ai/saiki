// ============================================================================
// CONSOLIDATED TOOL TYPES - Single source of truth for all tool-related types
// ============================================================================

/**
 * Context passed to tool execution
 */
export interface ToolExecutionContext {
    /** Session ID if available */
    sessionId?: string | undefined;
}

// ============================================================================
// CORE TOOL INTERFACES
// ============================================================================

/**
 * Internal tool interface - for tools implemented within Saiki
 */
export interface InternalTool {
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
 * External/MCP tool interface - for tools from external providers
 */
export interface ExternalTool {
    /** Tool name */
    name?: string;

    /** Human-readable description */
    description?: string;

    /** JSON Schema parameters */
    parameters?: ToolParameters;
}

// ============================================================================
// TOOL PARAMETERS AND SCHEMAS
// ============================================================================

/**
 * JSON Schema property definition
 */
export interface JsonSchemaProperty {
    type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
    description?: string;
    default?: any;
    enum?: Array<string | number | boolean>;
    format?: string;
}

/**
 * JSON Schema for tool parameters
 */
export interface JsonSchema {
    type?: 'object';
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
}

/**
 * Tool parameters interface - comprehensive JSON Schema support
 */
export interface ToolParameters {
    type?: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array';
    properties?: Record<string, unknown>;
    required?: string[];
    description?: string;
    default?: unknown;
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

// ============================================================================
// TOOL COLLECTIONS AND SETS
// ============================================================================

/**
 * Standard tool set interface - used by AI/LLM services
 */
export interface ToolSet {
    [key: string]: ExternalTool;
}

// ============================================================================
// TOOL EXECUTION AND RESULTS
// ============================================================================

/**
 * Tool execution result
 */
export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
    metadata?: {
        type: string;
        mimeType?: string;
    };
}

/**
 * Tool call representation
 */
export interface ToolCall {
    id: string;
    toolName: string;
    input: any;
    output?: any;
    error?: string;
    duration?: number;
}

// ============================================================================
// TOOL PROVIDER INTERFACES
// ============================================================================

/**
 * Interface for any provider of tools
 */
export interface ToolProvider {
    getTools(): Promise<ToolSet>;
    callTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
}
