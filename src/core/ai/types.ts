export interface Tool {
    name?: string;
    description?: string;
    parameters?: ToolParameters;
}

export interface ToolParameters {
    type?: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array';
    properties?: Record<string, unknown>;
    required?: string[];
    description?: string;
    default?: unknown;
    [key: string]: unknown; // Allow additional JSON Schema properties
}

export interface ToolSet {
    [key: string]: Tool;
}
