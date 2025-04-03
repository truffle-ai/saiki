import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import { AgentConfig, ServerConfigs } from './types.js';

// Default configuration paths
const DEFAULT_CONFIG = {
    dir: 'configuration',
    file: 'mcp.json',
};

/**
 * Configuration loader options
 */
export interface ConfigLoaderOptions {
    configDir?: string;
    configFile?: string;
}

/**
 * Get the path to a configuration file
 * @param options Optional configuration options
 * @returns Path to the configuration file
 */
export function getConfigPath(options?: ConfigLoaderOptions): string {
    const configDir = options?.configDir || DEFAULT_CONFIG.dir;
    const configFile = options?.configFile || DEFAULT_CONFIG.file;
    return path.join(configDir, configFile);
}

/**
 * Check if a configuration file exists
 * @param configPath Path to the configuration file (or use default)
 * @returns True if the file exists, false otherwise
 */
export async function configExists(configPath?: string): Promise<boolean> {
    try {
        await fs.access(configPath || getConfigPath());
        return true;
    } catch {
        return false;
    }
}

/**
 * Load server configurations from a file
 * @param configPath Path to the configuration file (defaults to configuration/mcp.json)
 * @returns Loaded server configurations
 */
export async function loadServerConfigs(configPath?: string): Promise<ServerConfigs> {
    const fullPath = configPath || getConfigPath();
    
    try {
        const data = await fs.readFile(fullPath, 'utf-8');
        const config = JSON.parse(data);
        
        // If the file contains a full agent config, extract just the server configs
        if (config.mcpServers) {
            return config.mcpServers as ServerConfigs;
        }
        
        // Otherwise assume it's a direct server config object
        return config as ServerConfigs;
    } catch (error) {
        logger.error(`Configuration file not found at ${fullPath}`);
        throw new Error(`Failed to load config file: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Load the complete agent configuration
 * @param configPath Path to the configuration file
 * @returns Complete agent configuration
 */
export async function loadConfigFile(configPath: string): Promise<AgentConfig> {
    try {
        // Make path absolute if it's relative
        const absolutePath = path.isAbsolute(configPath)
            ? configPath
            : path.resolve(process.cwd(), configPath);

        // Read and parse the config file
        const fileContent = await fs.readFile(absolutePath, 'utf-8');
        const config = JSON.parse(fileContent);

        return config;
    } catch (error) {
        throw new Error(`Failed to load config file: ${error instanceof Error ? error.message : String(error)}`);
    }
} 