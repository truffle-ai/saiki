import * as p from '@clack/prompts';
import { ConfigurationManager } from '@core/config/config-manager.js';

export interface DeleteCommandOptions {
    force?: boolean;
    all?: boolean;
}

/**
 * Deletes a saved configuration.
 * @param id The ID of the configuration to delete (interactive selection if not provided).
 * @param options Command options including force and all flags.
 */
export async function deleteConfigurationCommand(
    id?: string,
    options: DeleteCommandOptions = {}
): Promise<void> {
    const configManager = new ConfigurationManager();
    const { force = false, all = false } = options;

    // Handle --all flag
    if (all) {
        if (!force) {
            console.error(
                'Error: --all flag requires --force to confirm deletion of all configurations'
            );
            process.exit(1);
        }

        const configurations = await configManager.listConfigurations();
        if (configurations.length === 0) {
            console.log('No configurations found to delete.');
            return;
        }

        for (const config of configurations) {
            const success = await configManager.deleteConfiguration(config.id);
            if (success) {
                console.log(`Deleted configuration: ${config.name} [${config.id}]`);
            } else {
                console.error(`Failed to delete configuration: ${config.name} [${config.id}]`);
            }
        }
        console.log(`Deleted ${configurations.length} configuration(s).`);
        return;
    }

    let selectedConfigId = id;

    // If no config ID provided, show interactive selection
    if (!selectedConfigId) {
        const configurations = await configManager.listConfigurations();

        if (configurations.length === 0) {
            p.note('No saved configurations found to delete.', 'Info');
            return;
        }

        const selectedId = await p.select({
            message: 'Choose a configuration to delete',
            options: configurations.map((config) => ({
                value: config.id,
                label: config.name,
                hint:
                    config.description ||
                    `Created: ${new Date(config.createdAt).toLocaleDateString()}`,
            })),
        });

        if (p.isCancel(selectedId)) {
            p.cancel('Delete cancelled');
            return;
        }

        selectedConfigId = selectedId as string;
    }

    if (!selectedConfigId) {
        p.note('No configuration ID provided.', 'Error');
        return;
    }

    const config = await configManager.loadConfiguration(selectedConfigId);

    if (!config) {
        p.note(`Configuration with ID '${selectedConfigId}' not found.`, 'Error');
        return;
    }

    let shouldDelete = force;

    if (!force) {
        const confirm = await p.confirm({
            message: `Are you sure you want to delete the configuration '${config.name}'?`,
            initialValue: false,
        });

        if (p.isCancel(confirm)) {
            p.cancel('Deletion cancelled.');
            return;
        }

        shouldDelete = confirm;
    }

    if (shouldDelete) {
        const success = await configManager.deleteConfiguration(selectedConfigId);
        if (success) {
            if (force) {
                console.log(`Configuration '${config.name}' deleted successfully.`);
            } else {
                p.outro(`Configuration '${config.name}' deleted successfully.`);
            }
        } else {
            if (force) {
                console.error(`Failed to delete configuration '${config.name}'.`);
            } else {
                p.outro(`Failed to delete configuration '${config.name}'.`);
            }
        }
    } else {
        p.outro('Deletion cancelled.');
    }
}
