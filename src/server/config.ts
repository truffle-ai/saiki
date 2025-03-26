import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Configuration for an MCP server
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

/**
 * Load and validate multiple server configurations from a file
 * @param configPath Path to the config file with server definitions
 * @returns Dictionary of server configurations
 */
export async function getMultiServerConfig(configPath: string): Promise<ServerConfigs> {
  try {
    // If the path doesn't exist, throw an error
    if (!await configExists(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }
    
    // Load configurations from the file
    const configs = await loadServerConfigs(configPath);
    
    // Validate that we have at least one valid server configuration
    if (!configs || Object.keys(configs).length === 0) {
      throw new Error('No server configurations found in the config file');
    }
    
    // Validate each server configuration
    for (const [alias, config] of Object.entries(configs)) {
      if (!config.command) {
        throw new Error(`Server "${alias}" is missing a command`);
      }
      
      if (!Array.isArray(config.args)) {
        configs[alias].args = []; // Initialize to empty array if missing
      }
    }
    
    return configs;
  } catch (error) {
    logger.error(`Error loading multi-server configuration: ${error.message}`);
    throw error;
  }
}
