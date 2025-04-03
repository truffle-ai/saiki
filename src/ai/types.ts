
/**
 * Tool
 */
export interface Tool {
    name?: string;
    description?: string;
    parameters?: any
}

/**
 * MCP Tool Set
 */
export interface ToolSet {
    [key: string]: Tool;
}
