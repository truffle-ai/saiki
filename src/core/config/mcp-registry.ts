import type { McpServerConfig } from './schemas.js';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../logger/index.js';
import { isSaikiProject } from '../utils/path.js';

export interface McpServerRegistryEntry {
    /** Unique identifier for the server */
    id: string;
    /** Display name for the server */
    name: string;
    /** Brief description of what this server does */
    description: string;
    /** Category for grouping servers */
    category: string;
    /** Server configuration */
    config: McpServerConfig;
    /** Optional setup instructions or requirements */
    setupInstructions?: string;
    /** Required environment variables */
    requiredEnvVars?: string[];
    /** Optional environment variables */
    optionalEnvVars?: string[];
    /** Whether this server requires special setup */
    requiresSetup?: boolean;
    /** Tags for filtering and searching */
    tags: string[];
}

/**
 * Path to the default MCP registry file in the project root.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_MCP_REGISTRY_PATH = path.resolve(
    path.join(__dirname, '../../../mcp-registry.json')
);

/**
 * Resolve the local MCP registry path based on whether we're in a Saiki project or not.
 * Follows the same pattern as storage backends:
 * - Local: .saiki/mcp-registry.local.json in current working directory (when in Saiki project)
 * - Global: .saiki/mcp-registry.local.json in user's home directory (when not in Saiki project)
 */
async function resolveLocalMcpRegistryPath(): Promise<string> {
    const isInSaikiProject = await isSaikiProject();

    const baseDir = isInSaikiProject ? process.cwd() : os.homedir();

    return path.join(baseDir, '.saiki', 'mcp-registry.local.json');
}

/**
 * Loads the default MCP registry from the project root.
 */
export async function loadDefaultMcpRegistry(): Promise<Record<string, McpServerRegistryEntry>> {
    try {
        const data = await fs.readFile(DEFAULT_MCP_REGISTRY_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        logger.warn(
            `Failed to load default MCP registry from ${DEFAULT_MCP_REGISTRY_PATH}: ${error}`
        );
        return {};
    }
}

/**
 * Loads the local MCP registry from the appropriate directory (local or global).
 */
export async function loadLocalMcpRegistry(): Promise<Record<string, McpServerRegistryEntry>> {
    try {
        const localRegistryPath = await resolveLocalMcpRegistryPath();
        const data = await fs.readFile(localRegistryPath, 'utf-8');
        return JSON.parse(data);
    } catch (_err) {
        // File might not exist, which is fine.
        return {};
    }
}

/**
 * Loads the combined MCP registry (default + local).
 * Local entries override default entries with the same ID.
 */
export async function loadMcpRegistry(): Promise<Record<string, McpServerRegistryEntry>> {
    const [defaultRegistry, localRegistry] = await Promise.all([
        loadDefaultMcpRegistry(),
        loadLocalMcpRegistry(),
    ]);

    // Merge registries, with local overriding default
    return { ...defaultRegistry, ...localRegistry };
}

/**
 * Gets all unique categories from the registry.
 */
export async function getMcpServerCategories(): Promise<string[]> {
    const registry = await loadMcpRegistry();
    const categories = new Set<string>();

    for (const entry of Object.values(registry)) {
        categories.add(entry.category);
    }

    return Array.from(categories).sort();
}

/**
 * Gets all servers in a specific category.
 */
export async function getMcpServersByCategory(category: string): Promise<McpServerRegistryEntry[]> {
    const registry = await loadMcpRegistry();
    return Object.values(registry).filter((entry) => entry.category === category);
}

/**
 * Gets servers that have all the specified tags.
 */
export async function getMcpServersByTags(tags: string[]): Promise<McpServerRegistryEntry[]> {
    const registry = await loadMcpRegistry();
    return Object.values(registry).filter((entry) => tags.every((tag) => entry.tags.includes(tag)));
}

/**
 * Searches servers by name, description, or tags.
 */
export async function searchMcpServers(query: string): Promise<McpServerRegistryEntry[]> {
    const registry = await loadMcpRegistry();
    const searchTerm = query.toLowerCase();

    return Object.values(registry).filter(
        (entry) =>
            entry.name.toLowerCase().includes(searchTerm) ||
            entry.description.toLowerCase().includes(searchTerm) ||
            entry.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
    );
}

/**
 * Gets a specific server by ID.
 */
export async function getMcpServerById(id: string): Promise<McpServerRegistryEntry | undefined> {
    const registry = await loadMcpRegistry();
    return registry[id];
}

/**
 * Gets all available MCP servers.
 */
export async function getAllMcpServers(): Promise<McpServerRegistryEntry[]> {
    const registry = await loadMcpRegistry();
    return Object.values(registry);
}

/**
 * Saves a custom MCP server to the local registry.
 */
export async function saveLocalMcpServer(entry: McpServerRegistryEntry): Promise<void> {
    const localRegistry = await loadLocalMcpRegistry();
    localRegistry[entry.id] = entry;

    // Ensure the directory exists
    const localRegistryPath = await resolveLocalMcpRegistryPath();
    const dir = path.dirname(localRegistryPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(localRegistryPath, JSON.stringify(localRegistry, null, 2));
}

/**
 * Removes a custom MCP server from the local registry.
 */
export async function removeLocalMcpServer(id: string): Promise<boolean> {
    const localRegistry = await loadLocalMcpRegistry();

    if (!(id in localRegistry)) {
        return false;
    }

    delete localRegistry[id];
    const localRegistryPath = await resolveLocalMcpRegistryPath();
    await fs.writeFile(localRegistryPath, JSON.stringify(localRegistry, null, 2));
    return true;
}
