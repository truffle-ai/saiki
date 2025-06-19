export interface Tool {
    name?: string;
    description?: string;
    parameters?: ToolParameters;
}

export interface ToolParameters {
    type?: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array';
    properties?: Record<string, any>;
    required?: string[];
    description?: string;
    default?: any;
    [key: string]: any; // Allow additional JSON Schema properties
}

export interface ToolSet {
    [key: string]: Tool;
}
