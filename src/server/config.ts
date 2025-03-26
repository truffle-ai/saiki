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
 * Get server configuration by alias
 * @param alias Server alias
 * @param configPath Optional custom path to config file
 * @returns Server configuration or null if not found
 */
export async function getServerConfig(
  alias: string,
  configPath?: string
): Promise<McpServerConfig | null> {
  const configs = await loadServerConfigs(configPath);
  return configs[alias] || null;
}

/**
 * Get the path to the config file
 * @returns Path to the config file
 */
export function getConfigPath(): string {
  return CONFIG_PATH;
}

/**
 * Ensure the config directory exists
 */
export async function ensureConfigDirExists(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch {
    // Directory might already exist, ignore error
  }
}

/**
 * Get default configurations
 * @returns Default server configurations
 */
export function getDefaultConfig(): ServerConfigs {
  return {
    desktopCommander: {
      command: 'npx',
      args: ['-y', '@wonderwhy-er/desktop-commander'],
    },
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
    },
    local: {
      command: 'node',
      args: ['dist/host.js', 'stdio'],
    },
  };
}

/**
 * Create default configuration file
 * @returns Path to created config file
 */
export async function createDefaultConfig(): Promise<string> {
  try {
    // Create directory if it doesn't exist
    await ensureConfigDirExists();

    // Write default config
    const config = getDefaultConfig();
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');

    logger.info(`Created default configuration at ${CONFIG_PATH}`);
    return CONFIG_PATH;
  } catch (error) {
    logger.error('Failed to create default configuration:', error);
    throw error;
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
