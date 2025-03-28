import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Configuration for stdio-based MCP server connections
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

// Config paths relative to project root
const CONFIG_DIR = 'configuration';
const CONFIG_FILE = 'mcp.json';
const CONFIG_PATH = path.join(CONFIG_DIR, CONFIG_FILE);

/**
 * Load server configurations from file
 * @param configPath Path to the config file (defaults to configuration/mcp.json)
 * @returns Loaded configuration
 */
export async function loadServerConfigs(configPath: string = CONFIG_PATH): Promise<ServerConfigs> {
    try {
        const data = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(data) as ServerConfigs;
    } catch (error) {
        logger.error(`Configuration file not found at ${configPath}`);
        throw new Error(`Failed to load config file: ${error}`);
    }
}

/**
 * Check if config file exists
 * @param configPath Optional custom path to config file
 * @returns True if config file exists
 */
export async function configExists(configPath?: string): Promise<boolean> {
    try {
        await fs.access(configPath || CONFIG_PATH);
        return true;
    } catch {
        return false;
    }
}


// LLM configuration type
export type LLMConfig = {
    provider: string;
    model: string;
    apiKey?: string;
    providerOptions?: Record<string, any>;
};

// Agent configuration type
export type AgentConfig = {
    mcpServers: ServerConfigs;
    llm: LLMConfig;
    [key: string]: any; // Allow for future extensions
};

// Update the function to load the entire config
export async function loadConfigFile(configPath: string): Promise<AgentConfig> {
    try {
        // Convert to absolute path if it's relative
        const fs = await import('fs/promises');
        const path = await import('path');

        // Make path absolute if it's relative
        const absolutePath = path.isAbsolute(configPath)
            ? configPath
            : path.resolve(process.cwd(), configPath);

        // Read and parse the config file
        const fileContent = await fs.readFile(absolutePath, 'utf-8');
        const config = JSON.parse(fileContent);

        return config;
    } catch (error) {
        throw new Error(`Failed to load config file: ${error.message}`);
    }
}
