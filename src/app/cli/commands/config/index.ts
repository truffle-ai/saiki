import { Command } from 'commander';
import { logger } from '@core/index.js';

export function createConfigCommand(): Command {
    const configCmd = new Command('config')
        .description('Manage agent configurations')
        .configureHelp({
            subcommandTerm: (cmd) => cmd.name() + ' ' + cmd.usage(),
        });

    // config create - Interactive agent configuration builder
    configCmd
        .command('create')
        .description('Create a new agent configuration interactively')
        .option('--save', 'Save the configuration for later use', true)
        .option('--no-save', 'Do not save the configuration')
        .option('-o, --output <path>', 'Output configuration file path')
        .option('--quick', 'Quick configuration mode with sensible defaults')
        .action(async (options) => {
            try {
                const { createCommand } = await import('./create.js');
                await createCommand(options);
            } catch (err) {
                logger.error(`Config create failed: ${err}`);
                process.exit(1);
            }
        });

    // config update - Update existing configurations
    configCmd
        .command('update [id]')
        .description('Update an existing configuration (interactive selection if no ID provided)')
        .option('--save', 'Save the updated configuration', true)
        .option('--no-save', 'Do not save the updated configuration')
        .option('-o, --output <path>', 'Output configuration file path')
        .action(async (id: string | undefined, options) => {
            try {
                const { updateCommand } = await import('./update.js');
                await updateCommand(id, options);
            } catch (err) {
                logger.error(`Config update failed: ${err}`);
                process.exit(1);
            }
        });

    // config list - List saved configurations
    configCmd
        .command('list')
        .description('List all saved configurations')
        .action(async () => {
            try {
                const { listConfigurationsCommand } = await import('./list.js');
                await listConfigurationsCommand();
            } catch (err) {
                logger.error(`Config list failed: ${err}`);
                process.exit(1);
            }
        });

    // config delete - Delete a saved configuration
    configCmd
        .command('delete [id]')
        .description('Delete a saved configuration (interactive selection if no ID provided)')
        .action(async (id?: string) => {
            try {
                const { deleteConfigurationCommand } = await import('./delete.js');
                await deleteConfigurationCommand(id);
            } catch (err) {
                logger.error(`Config delete failed: ${err}`);
                process.exit(1);
            }
        });

    // config export - Export a saved configuration
    configCmd
        .command('export [id]')
        .description(
            'Export a saved configuration to a YAML file (interactive selection if no ID provided)'
        )
        .option('-o, --output <path>', 'Output file path (defaults to agents/<name>.yml)')
        .action(async (id: string | undefined, options) => {
            try {
                const { exportConfigurationCommand } = await import('./export.js');
                await exportConfigurationCommand(id, options.output);
            } catch (err) {
                logger.error(`Config export failed: ${err}`);
                process.exit(1);
            }
        });

    return configCmd;
}
