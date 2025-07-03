import * as p from '@clack/prompts';
import fs from 'fs/promises';
import path from 'path';
import * as YAML from 'yaml';
import { ConfigurationManager } from '@core/config/config-manager.js';
import type { AgentConfig } from '@core/config/schemas.js';

const AGENTS_DIR = 'agents';

/**
 * Generates a sanitized, URL-friendly filename for an agent configuration.
 */
function generateAgentFilename(name: string): string {
    return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.yml`;
}

/**
 * Resolves the final output path for the configuration file.
 * Creates the 'agents' directory if it doesn't exist.
 */
async function resolveOutputPath(
    outputPath: string | undefined,
    configName: string
): Promise<string> {
    if (outputPath) {
        return path.resolve(outputPath);
    }

    const agentsDir = path.resolve(AGENTS_DIR);
    await fs.mkdir(agentsDir, { recursive: true }).catch(() => {}); // Ignore if exists

    return path.join(agentsDir, generateAgentFilename(configName));
}

/**
 * Format configuration as YAML
 */
function formatConfigAsYaml(config: AgentConfig): string {
    const yamlContent = YAML.stringify(config, { lineWidth: -1 });
    const header =
        '# Saiki Agent Configuration\n# Generated on ' + new Date().toISOString() + '\n\n';
    return header + yamlContent;
}

/**
 * Exports a saved configuration to a YAML file.
 * @param id The ID of the configuration to export (interactive selection if not provided).
 * @param outputPath Optional path to save the file to.
 */
export async function exportConfigurationCommand(id?: string, outputPath?: string): Promise<void> {
    const configManager = new ConfigurationManager();

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

    const targetPath = await resolveOutputPath(outputPath, loadedConfig.name);
    const yamlContent = formatConfigAsYaml(loadedConfig.config);

    try {
        await fs.writeFile(targetPath, yamlContent);
        p.outro(`Configuration '${loadedConfig.name}' exported successfully to: ${targetPath}`);
    } catch (error) {
        p.outro(
            `Failed to export configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}
