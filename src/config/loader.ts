import fs from 'fs/promises';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import { AgentConfig } from './types.js';
import { logger } from '../utils/logger.js';
/**
 * Load the complete agent configuration
 * @param configPath Path to the configuration file
 * @returns Complete agent configuration
 */

// Expand $VAR and ${VAR} in all string values recursively
function expandEnvVars(config: any): any {
    if (typeof config === 'string') {
        const expanded = config.replace(/\$([A-Z_][A-Z0-9_]*)|\${([A-Z_][A-Z0-9_]*)}/gi, (_, v1, v2) => {
            return process.env[v1 || v2] || '';
        });
        return expanded;
    } else if (Array.isArray(config)) {
        return config.map(expandEnvVars);
    } else if (typeof config === 'object' && config !== null) {
        const result: any = {};
        for (const key in config) {
            result[key] = expandEnvVars(config[key]);
        }
        return result;
    }
    return config;
}

export async function loadConfigFile(configPath: string): Promise<AgentConfig> {
    try {
        // Make path absolute if it's relative
        const absolutePath = path.isAbsolute(configPath)
            ? configPath
            : path.resolve(process.cwd(), configPath);

        // Read and parse the config file
        const fileContent = await fs.readFile(absolutePath, 'utf-8');

        try {
            // Parse YAML content
            const config = parseYaml(fileContent);
            // Expand env vars everywhere
            const expandedConfig = expandEnvVars(config);
            return expandedConfig;
        } catch (parseError) {
            throw new Error(`Failed to parse YAML: ${parseError.message}`);
        }
    } catch (error) {
        throw new Error(
            `Failed to load config file: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}
