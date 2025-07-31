// ============================================================================
// SIMPLIFIED TOOL TYPES - Essential interfaces only
// ============================================================================

import type { JSONSchema7 } from 'json-schema';

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
 * Standard tool set interface - used by AI/LLM services
 * Each tool entry contains JSON Schema parameters
 */
export interface ToolSet {
    [key: string]: {
        name?: string;
        description?: string;
        parameters: JSONSchema7; // JSON Schema v7 specification
    };
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

/**
 * Interface for any provider of tools
 */
export interface ToolProvider {
    getTools(): Promise<ToolSet>;
    callTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
}
