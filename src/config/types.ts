/**
 * Type definitions for application configuration
 */

import { LLMRouter } from '../ai/llm/types.js';

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
    timeout?: number; // in milliseconds
}

/**
 * Configuration for SSE-based MCP server connections
 */
export interface SSEServerConfig {
    type: 'sse';
    url: string;
    headers?: Record<string, string>;
    timeout?: number; // in milliseconds
}

/**
 * Add HTTP transport configuration
 */
export interface HttpServerConfig {
    type: 'http';
    baseUrl: string;
    headers?: Record<string, string>;
    timeout?: number; // in milliseconds
}

/**
 * Union type for MCP server configurations
 */
export type McpServerConfig = StdioServerConfig | SSEServerConfig | HttpServerConfig;

/**
 * Type for server configurations dictionary
 */
export type ServerConfigs = Record<string, McpServerConfig>;

/**
 * LLM configuration type
 */
export interface ContributorConfig {
    id: string;
    type: 'static' | 'dynamic';
    priority: number;
    enabled?: boolean;
    content?: string; // for static
    source?: string; // for dynamic
}

export interface SystemPromptConfig {
    contributors: ContributorConfig[];
}

export type LLMConfig = {
    provider: string;
    model: string;
    systemPrompt: string | SystemPromptConfig;
    apiKey?: string;
    /** Maximum number of tool-iteration steps (for in-built and Vercel providers) */
    maxIterations?: number;
    providerOptions?: Record<string, any>;
    router?: LLMRouter; // Optional router field
};

/**
 * Agent configuration type
 */
export type AgentConfig = {
    mcpServers: ServerConfigs;
    llm: LLMConfig;
    [key: string]: any; // Allow for future extensions
};

/**
 * Keys in LLMConfig that can be overridden via CLI
 */
export type LLMOverrideKey = 'provider' | 'model' | 'router' | 'apiKey';

/**
 * CLI config override type for allowed fields
 */
export type CLIConfigOverrides = Partial<Pick<LLMConfig, LLMOverrideKey>>;

/**
 * Possible sources for configuration field overrides
 */
export type Source = 'file' | 'cli' | 'default';

/**
 * Provenance for CLI-overridable LLM fields only
 */
export type LLMProvenance = Record<LLMOverrideKey, Source>;

// Agent Card interface (based on A2A specification)
export interface AgentCard {
    name: string;
    description: string;
    url: string; // URL to the agent's MCP endpoint
    provider?: {
        organization: string;
        url: string;
    };
    version: string;
    documentationUrl?: string;
    capabilities: {
        streaming?: boolean;
        pushNotifications?: boolean;
        stateTransitionHistory?: boolean;
    };
    authentication: {
        schemes: string[];
        credentials?: string;
    };
    defaultInputModes: string[];
    defaultOutputModes: string[];
    skills: {
        id: string;
        name: string;
        description: string;
        tags: string[];
        examples?: string[];
        inputModes?: string[];
        outputModes?: string[];
    }[];
}
