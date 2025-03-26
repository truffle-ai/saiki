/**
 * MCP Tool Parameter
 */
export interface McpToolParameter {
  type?: string;
  description?: string;
  default?: any;
}

/**
 * MCP Tool
 */
export interface McpTool {
  name: string;
  description?: string;
  parameters?: Record<string, McpToolParameter>;
}

/**
 * AI CLI Options
 */
export interface AiCliOptions {
  model: string;
  verbose: boolean;
}
