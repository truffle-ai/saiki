import * as p from '@clack/prompts';
import chalk from 'chalk';
import type { McpServerRegistryEntry } from '@core/config/mcp-registry.js';
import {
    loadLocalMcpRegistry,
    saveLocalMcpServer,
    removeLocalMcpServer,
} from '@core/config/mcp-registry.js';

export async function mcpRegistryCommand(
    action: 'add' | 'list' | 'remove',
    id?: string
): Promise<void> {
    const registry = await loadLocalMcpRegistry();

    switch (action) {
        case 'list': {
            const entries = Object.values(registry);
            if (entries.length === 0) {
                p.note('No local MCP servers registered', 'Info');
                return;
            }
            p.note(entries.map((e) => `${e.id} - ${e.name}`).join('\n'), 'Local MCP Servers');
            return;
        }

        case 'remove': {
            if (!id) {
                p.note('Please specify the server ID to remove', 'Error');
                return;
            }
            if (!registry[id]) {
                p.note(`Server '${id}' not found in local registry`, 'Error');
                return;
            }
            const removed = await removeLocalMcpServer(id);
            if (removed) {
                p.outro(chalk.green(`Removed '${id}' from local registry`));
            } else {
                p.note(`Failed to remove '${id}' from local registry`, 'Error');
            }
            return;
        }

        case 'add': {
            // Collect details interactively
            const entry = await p.group(
                {
                    id: () => p.text({ message: 'Unique server ID (e.g., my_server)' }),
                    name: () => p.text({ message: 'Display name', placeholder: 'My Server' }),
                    description: () => p.text({ message: 'Short description' }),
                    category: () => p.text({ message: 'Category', placeholder: 'Custom' }),
                    command: () =>
                        p.text({ message: 'Executable command', placeholder: 'npx my-server' }),
                    args: () =>
                        p.text({
                            message: 'Command arguments (comma-separated)',
                            placeholder: '--port,8080',
                        }),
                },
                {
                    onCancel() {
                        throw new Error('CANCEL_PROMPT');
                    },
                }
            );

            // Validate prompt values before proceeding
            if (!entry.id || typeof entry.id !== 'string' || entry.id.trim() === '') {
                p.note('Server ID is required and cannot be empty', 'Error');
                return;
            }

            if (!entry.name || typeof entry.name !== 'string' || entry.name.trim() === '') {
                p.note('Display name is required and cannot be empty', 'Error');
                return;
            }

            if (!entry.description || typeof entry.description !== 'string') {
                p.note('Description is required', 'Error');
                return;
            }

            if (
                !entry.category ||
                typeof entry.category !== 'string' ||
                entry.category.trim() === ''
            ) {
                p.note('Category is required and cannot be empty', 'Error');
                return;
            }

            if (
                !entry.command ||
                typeof entry.command !== 'string' ||
                entry.command.trim() === ''
            ) {
                p.note('Command is required and cannot be empty', 'Error');
                return;
            }

            const newEntry: McpServerRegistryEntry = {
                id: entry.id.trim(),
                name: entry.name.trim(),
                description: entry.description.trim(),
                category: entry.category.trim(),
                config: {
                    type: 'stdio',
                    command: entry.command.trim().split(' ')[0],
                    args: entry.command
                        .trim()
                        .split(' ')
                        .slice(1)
                        .concat(((entry.args as string) || '').split(',').filter(Boolean)),
                },
                tags: ['custom'],
            } as McpServerRegistryEntry;

            await saveLocalMcpServer(newEntry);
            p.outro(chalk.green(`Added '${newEntry.id}' to local registry`));
            return;
        }
    }
}
