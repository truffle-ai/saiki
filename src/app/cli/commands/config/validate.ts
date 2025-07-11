import fs from 'fs/promises';
import path from 'path';
import * as YAML from 'yaml';
import chalk from 'chalk';
import { AgentConfigSchema } from '@core/config/schemas.js';
import { logger } from '@core/index.js';

export interface ValidateCommandOptions {
    format?: 'auto' | 'yaml' | 'json';
    strict?: boolean;
}

/**
 * Validates a configuration file.
 * @param filePath Path to the configuration file to validate.
 * @param options Validation options including format and strict mode.
 */
export async function validateConfigurationCommand(
    filePath: string,
    options: ValidateCommandOptions = {}
): Promise<void> {
    const { format = 'auto', strict = false } = options;

    try {
        // Check if file exists
        const resolvedPath = path.resolve(filePath);
        await fs.access(resolvedPath);

        // Read file content
        const content = await fs.readFile(resolvedPath, 'utf-8');

        // Determine format
        let detectedFormat = format;
        if (format === 'auto') {
            const ext = path.extname(filePath).toLowerCase();
            if (ext === '.json') {
                detectedFormat = 'json';
            } else if (ext === '.yml' || ext === '.yaml') {
                detectedFormat = 'yaml';
            } else {
                // Try to parse as JSON first, then YAML
                try {
                    JSON.parse(content);
                    detectedFormat = 'json';
                } catch {
                    detectedFormat = 'yaml';
                }
            }
        }

        // Parse configuration
        let config: any;
        try {
            if (detectedFormat === 'json') {
                config = JSON.parse(content);
            } else {
                config = YAML.parse(content);
            }
        } catch (error) {
            console.error(
                chalk.red(
                    `✗ Failed to parse ${detectedFormat.toUpperCase()} file: ${error instanceof Error ? error.message : 'Unknown parsing error'}`
                )
            );
            process.exit(1);
        }

        // Validate against schema
        const result = AgentConfigSchema.safeParse(config);

        if (result.success) {
            console.log(chalk.green(`✓ Configuration file is valid`));
            console.log(chalk.dim(`  File: ${resolvedPath}`));
            console.log(chalk.dim(`  Format: ${detectedFormat.toUpperCase()}`));

            if (!strict) {
                // Show some basic info about the config
                const validConfig = result.data;
                console.log(chalk.dim(`  Provider: ${validConfig.llm.provider}`));
                console.log(chalk.dim(`  Model: ${validConfig.llm.model}`));
                console.log(
                    chalk.dim(`  MCP Servers: ${Object.keys(validConfig.mcpServers || {}).length}`)
                );
            }
        } else {
            console.error(chalk.red(`✗ Configuration validation failed:`));
            console.error(chalk.dim(`  File: ${resolvedPath}`));
            console.error(chalk.dim(`  Format: ${detectedFormat.toUpperCase()}`));
            console.error('');

            // Group errors by path for better readability
            const errorsByPath = new Map<string, string[]>();

            for (const error of result.error.errors) {
                const pathStr = error.path.length > 0 ? error.path.join('.') : 'root';
                if (!errorsByPath.has(pathStr)) {
                    errorsByPath.set(pathStr, []);
                }
                errorsByPath.get(pathStr)!.push(error.message);
            }

            for (const [pathStr, messages] of errorsByPath) {
                console.error(chalk.yellow(`  ${pathStr}:`));
                for (const message of messages) {
                    console.error(chalk.red(`    • ${message}`));
                }
            }

            process.exit(1);
        }
    } catch (error) {
        if ((error as any)?.code === 'ENOENT') {
            console.error(chalk.red(`✗ File not found: ${filePath}`));
        } else {
            logger.error(`Validation failed: ${error}`);
            console.error(
                chalk.red(
                    `✗ Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                )
            );
        }
        process.exit(1);
    }
}
