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
                        throw 'CANCEL_PROMPT';
                    },
                }
            );

            const newEntry: McpServerRegistryEntry = {
                id: entry.id as string,
                name: entry.name as string,
                description: entry.description as string,
                category: entry.category as string,
                config: {
                    type: 'stdio',
                    command: (entry.command as string).split(' ')[0],
                    args: (entry.command as string)
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
