import * as p from '@clack/prompts';
import chalk from 'chalk';
import { ConfigurationManager } from '@core/config/config-manager.js';
import { formatConfigOutput } from './utils.js';

export interface ShowCommandOptions {
    format?: 'yaml' | 'json' | 'table';
    minify?: boolean;
}

/**
 * Shows a saved configuration.
 * @param id The ID of the configuration to show (interactive selection if not provided).
 * @param options Display options including format and minify settings.
 */
export async function showConfigurationCommand(
    id?: string,
    options: ShowCommandOptions = {}
): Promise<void> {
    const configManager = new ConfigurationManager();
    const { format = 'yaml', minify = false } = options;

    let selectedConfigId = id;

    // If no config ID provided, show interactive selection
    if (!selectedConfigId) {
        const configurations = await configManager.listConfigurations();

        if (configurations.length === 0) {
            p.note('No configurations found. Create one with `saiki config create`', 'Empty');
            return;
        }

        selectedConfigId = (await p.select({
            message: 'Select a configuration to show:',
            options: configurations.map((config) => ({
                value: config.id,
                label: `${config.name}`,
                hint: config.description || 'No description',
            })),
        })) as string;

        if (p.isCancel(selectedConfigId)) {
            p.cancel('Operation cancelled');
            return;
        }
    }

    // Load the full configuration
    const loadedConfig = await configManager.loadConfiguration(selectedConfigId);

    if (!loadedConfig) {
        console.error(chalk.red(`Configuration with ID '${selectedConfigId}' not found`));
        return;
    }

    try {
        const output = await formatConfigOutput(loadedConfig, { format, minify, verbose: true });
        console.log(output);
    } catch (error) {
        console.error(chalk.red(`Failed to format configuration: ${error}`));
    }
}
