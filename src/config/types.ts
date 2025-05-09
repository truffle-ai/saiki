/**
 * Type definitions for application configuration
 */

import { LLMRouter } from '../ai/llm/types.js';
import type { PromptGeneratorKey } from '../ai/systemPrompt/registry.js';

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
    source?: PromptGeneratorKey; // for dynamic, must be a valid key in dynamicPromptGenerators
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
