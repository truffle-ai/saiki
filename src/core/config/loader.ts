import { promises as fs } from 'fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { AgentConfig } from './schemas.js';
import { logger } from '../logger/index.js';
import { resolveConfigPath } from '../utils/path.js';
import { ConfigurationError } from '@core/error/index.js';
/**
 * Load the complete agent configuration
 * @param configPath Path to the configuration file
 * @returns Complete agent configuration
 */

// Expand $VAR and ${VAR} in all string values recursively
function expandEnvVars(config: any): any {
    if (typeof config === 'string') {
        const expanded = config.replace(
            /\$([A-Z_][A-Z0-9_]*)|\${([A-Z_][A-Z0-9_]*)}/gi,
            (_, v1, v2) => {
                return process.env[v1 || v2] || '';
            }
        );

        // Try to convert numeric strings to numbers
        if (expanded !== config && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(expanded.trim())) {
            return Number(expanded); // handles int, float, sci-notation
        }

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

export async function loadAgentConfig(configPath?: string): Promise<AgentConfig> {
    try {
        // Resolve config path using new logic
        const absolutePath = resolveConfigPath(configPath);

        logger.debug(`Loading saiki config from: ${absolutePath}`);

        // Read and parse the config file
        const fileContent = await fs.readFile(absolutePath, 'utf-8');

        try {
            // Parse YAML content
            const config = parseYaml(fileContent);
            // Expand env vars everywhere
            const expandedConfig = expandEnvVars(config);
            return expandedConfig;
        } catch (parseError) {
            throw new ConfigurationError(
                `Failed to parse YAML: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                absolutePath
            );
        }
    } catch (error: any) {
        // Include path & cause for better diagnostics
        throw new ConfigurationError(
            `Failed to load config file at ${error.path || configPath}: ${error.message}`
        );
    }
}

export async function writeConfigFile(configPath: string | undefined, config: AgentConfig) {
    const absolutePath = resolveConfigPath(configPath);
    try {
        const yamlContent = stringifyYaml(config);
        await fs.writeFile(absolutePath, yamlContent, 'utf-8');
        logger.debug(`Wrote saiki config to: ${absolutePath}`);
    } catch (error: any) {
        throw new ConfigurationError(
            `Failed to write config file at ${error.path || configPath}: ${error.message}`
        );
    }
}
