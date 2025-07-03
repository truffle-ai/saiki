import * as p from '@clack/prompts';
import { ConfigurationManager } from '@core/config/config-manager.js';

/**
 * Deletes a saved configuration.
 * @param id The ID of the configuration to delete (interactive selection if not provided).
 */
export async function deleteConfigurationCommand(id?: string): Promise<void> {
    const configManager = new ConfigurationManager();

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

    const confirm = await p.confirm({
        message: `Are you sure you want to delete the configuration '${config.name}'?`,
        initialValue: false,
    });

    if (p.isCancel(confirm)) {
        p.cancel('Deletion cancelled.');
        return;
    }

    if (confirm) {
        const success = await configManager.deleteConfiguration(selectedConfigId);
        if (success) {
            p.outro(`Configuration '${config.name}' deleted successfully.`);
        } else {
            p.outro(`Failed to delete configuration '${config.name}'.`);
        }
    } else {
        p.outro('Deletion cancelled.');
    }
}
