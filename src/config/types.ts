/**
 * Type definitions for application configuration
 */

/**
 * Configuration for an MCP server (tool provider)
 */
export interface McpServerConfig {
    command: string;
    args: string[];
    env?: Record<string, string>;
}

/**
 * Type for server configurations dictionary
 */
export type ServerConfigs = Record<string, McpServerConfig>;

/**
 * Server configuration types for HTTP servers
 */
export type ServerConfig = {
    url: string;
    auth?: {
        username?: string;
        password?: string;
        token?: string;
    };
};

/**
 * LLM configuration type
 */
export type LLMConfig = {
    provider: string;
    model: string;
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