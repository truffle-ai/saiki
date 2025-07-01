import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { McpServerRegistryEntry } from '@core/config/mcp-registry.js';

const LOCAL_REGISTRY_PATH = path.join(os.homedir(), '.saiki', 'mcp-registry.local.json');

/**
 * Load local registry entries from file
 */
async function loadLocalRegistry(): Promise<Record<string, McpServerRegistryEntry>> {
    try {
        const data = await fs.readFile(LOCAL_REGISTRY_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (_err) {
        return {}; // no local registry yet
    }
}

/**
 * Save local registry to file
 */
async function saveLocalRegistry(registry: Record<string, McpServerRegistryEntry>): Promise<void> {
    await fs.mkdir(path.dirname(LOCAL_REGISTRY_PATH), { recursive: true });
    await fs.writeFile(LOCAL_REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
}

export async function mcpRegistryCommand(
    action: 'add' | 'list' | 'remove',
    id?: string
): Promise<void> {
    const registry = await loadLocalRegistry();

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
            delete registry[id];
            await saveLocalRegistry(registry);
            p.outro(chalk.green(`Removed '${id}' from local registry`));
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

            registry[newEntry.id] = newEntry;
            await saveLocalRegistry(registry);
            p.outro(chalk.green(`Added '${newEntry.id}' to local registry`));
            return;
        }
    }
}
