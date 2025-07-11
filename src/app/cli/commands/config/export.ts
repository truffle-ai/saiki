import * as p from '@clack/prompts';
import fs from 'fs/promises';
import path from 'path';
import { ConfigurationManager } from '@core/config/config-manager.js';
import { formatAgentConfigOutput, AGENTS_DIR } from './utils.js';

export interface ExportCommandOptions {
    output?: string;
    format?: 'yaml' | 'json';
    minify?: boolean;
}

/**
 * Generates a sanitized, URL-friendly filename for an agent configuration.
 */
function generateAgentFilename(name: string, format: 'yaml' | 'json' = 'yaml'): string {
    const extension = format === 'json' ? 'json' : 'yml';
    return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${extension}`;
}

/**
 * Resolves the final output path for the configuration file.
 * Creates the 'agents' directory if it doesn't exist.
 */
async function resolveOutputPath(
    outputPath: string | undefined,
    configName: string,
    format: 'yaml' | 'json' = 'yaml'
): Promise<string> {
    if (outputPath) {
        return path.resolve(outputPath);
    }

    const agentsDir = path.resolve(AGENTS_DIR);
    await fs.mkdir(agentsDir, { recursive: true }).catch(() => {}); // Ignore if exists

    return path.join(agentsDir, generateAgentFilename(configName, format));
}

/**
 * Exports a saved configuration to a file.
 * @param id The ID of the configuration to export (interactive selection if not provided).
 * @param options Export options including output path, format, and minify settings.
 */
export async function exportConfigurationCommand(
    id?: string,
    options: ExportCommandOptions = {}
): Promise<void> {
    const configManager = new ConfigurationManager();
    const { output: outputPath, format = 'yaml', minify = false } = options;

    let selectedConfigId = id;

    // If no config ID provided, show interactive selection
    if (!selectedConfigId) {
        const configurations = await configManager.listConfigurations();

        if (configurations.length === 0) {
            p.note('No saved configurations found to export.', 'Info');
            return;
        }

        const selectedId = await p.select({
            message: 'Choose a configuration to export',
            options: configurations.map((config) => ({
                value: config.id,
                label: config.name,
                hint:
                    config.description ||
                    `Created: ${new Date(config.createdAt).toLocaleDateString()}`,
            })),
        });

        if (p.isCancel(selectedId)) {
            p.cancel('Export cancelled');
            return;
        }

        selectedConfigId = selectedId as string;
    }

    if (!selectedConfigId) {
        p.note('No configuration ID provided.', 'Error');
        return;
    }

    const loadedConfig = await configManager.loadConfiguration(selectedConfigId);

    if (!loadedConfig) {
        p.note(`Configuration with ID '${selectedConfigId}' not found.`, 'Error');
        return;
    }

    const targetPath = await resolveOutputPath(outputPath, loadedConfig.name, format);

    // Use the consolidated formatting utility
    const content = await formatAgentConfigOutput(loadedConfig.config, { format, minify });

    try {
        await fs.writeFile(targetPath, content);
        p.outro(`Configuration '${loadedConfig.name}' exported successfully to: ${targetPath}`);
    } catch (error) {
        p.outro(
            `Failed to export configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}
