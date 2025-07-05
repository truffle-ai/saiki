import { Command } from 'commander';
import { logger } from '@core/index.js';
import {
    addLlmOptions,
    addMcpOptions,
    addPromptOptions,
    addMetadataOptions,
    addUpdateMcpOptions,
    addFormatOptions,
    parseAndValidateOptions,
} from './utils.js';

export function createConfigCommand(): Command {
    const configCmd = new Command('config')
        .description('Manage agent configurations')
        .configureHelp({
            subcommandTerm: (cmd) => cmd.name() + ' ' + cmd.usage(),
        });

    // config create - Create agent configuration
    const createCmd = configCmd
        .command('create')
        .description('Create a new agent configuration')
        .option('--save', 'Save the configuration for later use', true)
        .option('--no-save', 'Do not save the configuration')
        .option('-o, --output <path>', 'Output configuration file path');

    // Add flag groups to create command
    addLlmOptions(createCmd);
    addMcpOptions(createCmd);
    addPromptOptions(createCmd);
    addMetadataOptions(createCmd);

    createCmd.action(async (options) => {
        try {
            const validatedOptions = parseAndValidateOptions(options);
            const { createCommand } = await import('./create.js');
            await createCommand(validatedOptions);
        } catch (err) {
            logger.error(`Config create failed: ${err}`);
            process.exit(1);
        }
    });

    // config update - Update existing configuration
    const updateCmd = configCmd
        .command('update [id]')
        .description('Update an existing configuration (interactive selection if no ID provided)')
        .option('--save', 'Save the updated configuration', true)
        .option('--no-save', 'Do not save the updated configuration')
        .option('-o, --output <path>', 'Output configuration file path');

    // Add flag groups to update command
    addLlmOptions(updateCmd);
    addMcpOptions(updateCmd);
    addUpdateMcpOptions(updateCmd);
    addPromptOptions(updateCmd);
    addMetadataOptions(updateCmd);

    updateCmd.action(async (id: string | undefined, options) => {
        try {
            const validatedOptions = parseAndValidateOptions(options);
            const { updateCommand } = await import('./update.js');
            await updateCommand(id, validatedOptions);
        } catch (err) {
            logger.error(`Config update failed: ${err}`);
            process.exit(1);
        }
    });

    // config list - List saved configurations
    const listCmd = configCmd.command('list').description('List all saved configurations');

    addFormatOptions(listCmd, 'table', ['table', 'json', 'yaml']);

    listCmd.action(async (options) => {
        try {
            const { listConfigurationsCommand } = await import('./list.js');
            await listConfigurationsCommand(options);
        } catch (err) {
            logger.error(`Config list failed: ${err}`);
            process.exit(1);
        }
    });

    // config delete - Delete a saved configuration
    configCmd
        .command('delete [id]')
        .description('Delete a saved configuration (interactive selection if no ID provided)')
        .option('--force', 'Skip confirmation prompt')
        .option('--all', 'Delete all configurations (requires --force)')
        .action(async (id?: string, options = {}) => {
            try {
                const validatedOptions = parseAndValidateOptions(options);
                const { deleteConfigurationCommand } = await import('./delete.js');
                await deleteConfigurationCommand(id, validatedOptions);
            } catch (err) {
                logger.error(`Config delete failed: ${err}`);
                process.exit(1);
            }
        });

    // config export - Export a saved configuration
    configCmd
        .command('export [id]')
        .description(
            'Export a saved configuration to a file (interactive selection if no ID provided)'
        )
        .option('-o, --output <path>', 'Output file path (defaults to agents/<name>.yml)')
        .option('--format <format>', 'Export format (yaml, json)', 'yaml')
        .option('--minify', 'Minify the output (for JSON format)')
        .action(async (id: string | undefined, options) => {
            try {
                const { exportConfigurationCommand } = await import('./export.js');
                await exportConfigurationCommand(id, options);
            } catch (err) {
                logger.error(`Config export failed: ${err}`);
                process.exit(1);
            }
        });

    // config validate - Validate a configuration file
    configCmd
        .command('validate <file>')
        .description('Validate a configuration file')
        .option('--format <format>', 'Input file format (auto, yaml, json)', 'auto')
        .option('--strict', 'Enable strict validation mode')
        .action(async (file: string, options) => {
            try {
                const { validateConfigurationCommand } = await import('./validate.js');
                await validateConfigurationCommand(file, options);
            } catch (err) {
                logger.error(`Config validate failed: ${err}`);
                process.exit(1);
            }
        });

    // config show - Show a saved configuration
    const showCmd = configCmd
        .command('show [id]')
        .description('Show a saved configuration (interactive selection if no ID provided)');

    addFormatOptions(showCmd, 'yaml', ['yaml', 'json', 'table']);

    showCmd.action(async (id: string | undefined, options) => {
        try {
            const { showConfigurationCommand } = await import('./show.js');
            await showConfigurationCommand(id, options);
        } catch (err) {
            logger.error(`Config show failed: ${err}`);
            process.exit(1);
        }
    });

    return configCmd;
}
