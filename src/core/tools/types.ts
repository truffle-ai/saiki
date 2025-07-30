import { z } from 'zod';
import type { AgentEventBus } from '../events/index.js';
import type { StorageManager } from '../storage/storage-manager.js';

/**
 * Core tool definition - clean and simple
 */
export interface Tool {
    /** Unique identifier for the tool */
    id: string;

    /** Human-readable description of what the tool does */
    description: string;

    /** Zod schema defining the input parameters */
    inputSchema: z.ZodSchema;

    /** The actual function that executes the tool */
    execute: (input: any, context?: ToolExecutionContext) => Promise<any> | any;

    /** Optional discovery metadata */
    metadata?: ToolDiscoveryMetadata;

    /** Optional execution settings */
    settings?: ToolExecutionSettings;
}

/**
 * Context passed to tool execution
 */
export interface ToolExecutionContext {
    /** Session ID if available */
    sessionId?: string | undefined;
    /** Event bus for emitting events */
    eventBus?: AgentEventBus;
    /** Storage access */
    storage?: StorageManager;
}

/**
 * Optional metadata for tool discovery and organization
 */
export interface ToolDiscoveryMetadata {
    /** Category for organizing tools */
    category?: string | undefined;
    /** Tags for searching */
    tags?: string[] | undefined;
    /** Tool version */
    version?: string | undefined;
    /** Author information */
    author?: string | undefined;
}

/**
 * Optional settings for tool execution behavior
 */
export interface ToolExecutionSettings {
    /** Whether this tool requires user confirmation */
    requiresConfirmation?: boolean | undefined;
    /** Execution timeout in milliseconds */
    timeout?: number | undefined;
}

/**
 * Result returned by tool execution
 */
export interface ToolExecutionResult {
    /** Whether the execution was successful */
    success: boolean;
    /** The actual result data */
    data?: any;
    /** Optional metadata about the execution */
    metadata?: Record<string, any> | undefined;
    /** Error information if failed */
    error?: string | undefined;
}

/**
 * Tool discovery results
 */
export interface ToolDiscoveryResult {
    /** Successfully loaded tools */
    tools: Tool[];
    /** Errors encountered during discovery */
    errors: Array<{
        filePath: string;
        error: string;
    }>;
    /** Warnings encountered */
    warnings: string[];
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

/**
 * Custom tool execution errors
 */
export class ToolExecutionError extends Error {
    constructor(
        public toolId: string,
        message: string,
        public override cause?: Error
    ) {
        super(`Tool '${toolId}': ${message}`);
        this.name = 'ToolExecutionError';
    }
}

/**
 * Tool registration errors
 */
export class ToolRegistrationError extends Error {
    constructor(
        public filePath: string,
        message: string
    ) {
        super(`Tool registration failed for '${filePath}': ${message}`);
        this.name = 'ToolRegistrationError';
    }
}
