import { promises as fs } from 'fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { AgentConfig } from './schemas.js';
import { logger } from '../logger/index.js';
import { resolveConfigPath } from '../utils/path.js';
import {
    ConfigEnvVarError,
    ConfigFileNotFoundError,
    ConfigFileReadError,
    ConfigFileWriteError,
    ConfigParseError,
} from '@core/error/index.js';

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
                const varName = v1 || v2;
                const value = process.env[varName];

                if (value === undefined || value === '') {
                    throw new ConfigEnvVarError(config, varName, 'not defined');
                }
                logger.info(varName, value);

                return value;
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

/**
 * Asynchronously loads and processes an agent configuration file.
 * This function orchestrates the steps of resolving the file path, checking its existence,
 * reading its content, parsing it as YAML, and expanding any environment variables within it.
 * Each step is wrapped in a try-catch block to gracefully handle errors and throw specific,
 * custom error types for better error identification and handling by the caller.
 *
 * @param configPath - An optional string representing the path to the configuration file.
 * If not provided, a default path will be resolved internally.
 * @returns A Promise that resolves to the fully loaded and processed `AgentConfig` object.
 * @throws {ConfigFileNotFoundError} If the configuration file does not exist at the resolved path.
 * @throws {ConfigFileReadError} If an error occurs while attempting to read the configuration file (e.g., permissions issues).
 * @throws {ConfigParseError} If the content of the configuration file is not valid YAML.
 * @throws {ConfigEnvVarError} If there's a problem expanding environment variables within the parsed configuration.
 */
export async function loadAgentConfig(configPath?: string): Promise<AgentConfig> {
    // Resolve the absolute path of the configuration file.
    // This utility function should handle cases where `configPath` is undefined,
    // determining a default or conventional location for the config.
    const absolutePath = resolveConfigPath(configPath);

    // --- Step 1: Verify the configuration file exists and is accessible ---
    try {
        // Attempt to access the file. If it doesn't exist or permissions are insufficient,
        // `fs.access` will throw an error, which we catch.
        await fs.access(absolutePath);
    } catch (_error) {
        // Throw a specific error indicating that the configuration file was not found.
        throw new ConfigFileNotFoundError(absolutePath);
    }

    let fileContent: string;
    // --- Step 2: Read the content of the configuration file ---
    try {
        // Read the file content as a UTF-8 encoded string.
        fileContent = await fs.readFile(absolutePath, 'utf-8');
    } catch (error) {
        // If an error occurs during file reading (e.g., I/O error, corrupted file),
        // throw a `ConfigFileReadError` with the absolute path and the underlying cause.
        throw new ConfigFileReadError(
            absolutePath,
            error instanceof Error ? error.message : String(error)
        );
    }

    let config: any;
    // --- Step 3: Parse the file content as YAML ---
    try {
        // Attempt to parse the string content into a JavaScript object using a YAML parser.
        config = parseYaml(fileContent);
    } catch (error) {
        // If the content is not valid YAML, `parseYaml` will throw an error.
        // Catch it and throw a `ConfigParseError` with details.
        throw new ConfigParseError(
            absolutePath,
            error instanceof Error ? error.message : String(error)
        );
    }

    // --- Step 4: Expand environment variables within the parsed configuration ---
    try {
        // Process the parsed configuration object to replace any placeholders
        // with their corresponding environment variable values.
        return expandEnvVars(config);
    } catch (error) {
        // If an environment variable is missing or its expansion fails,
        // throw a `ConfigEnvVarError`. The 'unknown' placeholder suggests
        // that the `expandEnvVars` utility might not directly return the
        // problematic variable's name, but it's good to indicate it could be
        // extracted if available.
        throw new ConfigEnvVarError(
            absolutePath,
            'unknown', // Ideally, `expandEnvVars` would pass the problematic env var name
            error instanceof Error ? error.message : String(error)
        );
    }
}

/**
 * Asynchronously writes the given agent configuration object to a YAML file.
 * This function handles the serialization of the config object to YAML format
 * and then writes it to the specified file path, logging the action.
 * It uses custom error classes for robust error handling.
 *
 * @param configPath - Optional. The path where the configuration file should be written.
 * If undefined, `resolveConfigPath` will determine the default path.
 * @param config - The `AgentConfig` object to be written to the file.
 * @returns A Promise that resolves when the file has been successfully written.
 * @throws {ConfigFileWriteError} If an error occurs during the YAML stringification or file writing process.
 */
export async function writeConfigFile(
    configPath: string | undefined,
    config: AgentConfig
): Promise<void> {
    // Resolve the absolute path where the configuration file will be written.
    const absolutePath = resolveConfigPath(configPath);

    try {
        // Convert the AgentConfig object into a YAML string.
        const yamlContent = stringifyYaml(config);

        // Write the YAML content to the specified file.
        // The 'utf-8' encoding ensures proper character handling.
        await fs.writeFile(absolutePath, yamlContent, 'utf-8');

        // Log a debug message indicating successful file write.
        logger.debug(`Wrote saiki config to: ${absolutePath}`);
    } catch (error: any) {
        // Catch any errors that occur during YAML stringification or file writing.
        // Throw a specific `ConfigFileWriteError` for better error categorization.
        throw new ConfigFileWriteError(
            absolutePath, // Pass the absolute path for context
            error instanceof Error ? error.message : String(error) // Provide the underlying cause message
        );
    }
}
