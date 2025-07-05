import chalk from 'chalk';
import * as p from '@clack/prompts';
import { ConfigurationManager } from '@core/config/config-manager.js';
import { formatConfigListOutput } from './utils.js';

export interface ListCommandOptions {
    format?: 'table' | 'json' | 'yaml';
    verbose?: boolean;
}

/**
 * Lists all saved configurations.
 */
export async function listConfigurationsCommand(options: ListCommandOptions = {}): Promise<void> {
    const configManager = new ConfigurationManager();
    const { format = 'table', verbose = false } = options;

    if (format === 'table') {
        p.intro(chalk.inverse(' Saved Configurations '));
    }

    const configurations = await configManager.listConfigurations();
    const output = await formatConfigListOutput(configurations, { format, verbose });

    if (format === 'table') {
        if (configurations.length === 0) {
            p.note('No configurations found. Create one with `saiki config create`', 'Empty');
        } else {
            console.log(output);
        }
        p.outro(chalk.green('Configuration list complete'));
    } else {
        console.log(output);
    }
}
