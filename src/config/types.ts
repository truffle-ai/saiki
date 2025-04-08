/**
 * Type definitions for application configuration
 */

/**
 * Configuration for stdio-based MCP server connections
 * - type: Must be 'stdio'
 * - command: The shell command to launch the server (e.g., 'node')
 * - args: Array of arguments for the command (e.g., ['script.js'])
 * - env: Optional environment variables for the server process
 */
export interface StdioServerConfig {
    type: 'stdio';
    command: string;
    args: string[];
    env?: Record<string, string>;
}

/**
 * Configuration for SSE-based MCP server connections
 */
export interface SSEServerConfig {
    type: 'sse';
    url: string;
    headers?: Record<string, string>;
}

/**
 * Union type for MCP server configurations
 */
export type McpServerConfig = StdioServerConfig | SSEServerConfig;

/**
 * Type for server configurations dictionary
 */
export type ServerConfigs = Record<string, McpServerConfig>;

/**
 * LLM configuration type
 */
export type LLMConfig = {
    provider: string;
    model: string;
    systemPrompt: string;
    apiKey?: string;
    providerOptions?: Record<string, any>;
};

/**
 * Agent configuration type
 */
export type AgentConfig = {
    mcpServers: ServerConfigs;
    llm: LLMConfig;
    [key: string]: any; // Allow for future extensions
};
