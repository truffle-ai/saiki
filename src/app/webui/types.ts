/**
 * Shared type definitions for WebUI components
 */

export interface JsonSchemaProperty {
    type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
    description?: string;
    default?: any;
    enum?: Array<string | number | boolean>;
    format?: string;
}

export interface JsonSchema {
    type?: 'object';
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
}

export interface McpServer {
    id: string;
    name: string;
    status: 'connected' | 'disconnected' | 'error' | 'unknown';
}

export interface McpTool {
    id: string;
    name: string;
    description?: string;
    inputSchema?: JsonSchema | null;
}

export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
    metadata?: {
        type: string;
        mimeType?: string;
    };
}
