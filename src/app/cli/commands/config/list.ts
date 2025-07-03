import chalk from 'chalk';
import * as p from '@clack/prompts';
import { ConfigurationManager } from '@core/config/config-manager.js';

/**
 * Lists all saved configurations.
 */
export async function listConfigurationsCommand(): Promise<void> {
    const configManager = new ConfigurationManager();
    p.intro(chalk.inverse(' Saved Configurations '));

    const configurations = await configManager.listConfigurations();

    if (configurations.length === 0) {
        p.note('No saved configurations found.', 'Info');
        return;
    }

    console.log('\n');
    for (const config of configurations) {
        const createdDate = new Date(config.createdAt).toLocaleDateString();
        const tags = config.tags.length > 0 ? ` (${config.tags.join(', ')})` : '';

        console.log(chalk.bold.cyan(`${config.name}`) + chalk.gray(` [${config.id}]`));
        console.log(chalk.dim(`  ${config.description}`));
        console.log(chalk.dim(`  Created: ${createdDate}${tags}`));
        console.log('');
    }

    p.outro(
        'Use `saiki config create --load <id>` to load or `saiki config delete <id>` to remove one.'
    );
}
