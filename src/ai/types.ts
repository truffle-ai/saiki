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
  /** LLM provider to use (default: 'openai') */
  provider?: 'openai' | 'anthropic';
  
  /** Model name to use for the selected provider */
  model?: string;
  
  /** Additional provider-specific options */
  providerOptions?: Record<string, any>;
  
  /** Path to the config file */
  configFile?: string;
  
  /** Connection mode for MCP clients */
  connectionMode?: 'strict' | 'lenient';
}
