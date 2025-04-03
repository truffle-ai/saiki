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
        throw new Error(`Failed to load config file: ${error}`);
    }
} 