export interface Tool {
    name?: string;
    description?: string;
    parameters?: ToolParameters;
}

export interface ToolParameters {
    type?: string;
    description?: string;
    default?: any;
}

export interface ToolSet {
    [key: string]: Tool;
}
