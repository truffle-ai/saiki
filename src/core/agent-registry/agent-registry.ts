/**
 * Agent Registry Implementation
 * Handles resolution of agent names to configuration paths
 */

import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { logger } from '@core/logger/index.js';
import { getSaikiPath } from '@core/utils/path.js';
import {
    AgentRegistry,
    AgentRegistryEntry,
    AgentRegistryConfig,
    AgentRegistryConfigSchema,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

/**
 * Interface for the raw agent data from JSON file
 */
interface RawAgentData {
    name: string;
    displayName: string;
    description: string;
    version: string;
    author?: string;
    tags?: string[];
    configUrl: string;
    lastUpdated?: string;
}

export class LocalAgentRegistry implements AgentRegistry {
    private config: AgentRegistryConfig;
    private _registryAgents: Record<string, AgentRegistryEntry> | null = null;

    constructor(config?: Partial<AgentRegistryConfig>) {
        const validatedConfig = AgentRegistryConfigSchema.parse({
            registryAgents: {}, // Will be loaded lazily
            cacheTtl: 3600, // 1 hour
            ...config,
        });
        this.config = validatedConfig;
    }

    /**
     * Lazy load registry agents from JSON file
     */
    private getRegistryAgents(): Record<string, AgentRegistryEntry> {
        if (this._registryAgents === null) {
            this._registryAgents = this.loadRegistryAgents();
        }
        return this._registryAgents;
    }

    /**
     * Load registry agents from JSON file and convert to AgentRegistryEntry format
     */
    private loadRegistryAgents(): Record<string, AgentRegistryEntry> {
        try {
            const jsonPath = path.join(PROJECT_ROOT, 'agents', 'agent-registry.json');
            const jsonData = readFileSync(jsonPath, 'utf-8');
            const rawAgents: Record<string, RawAgentData> = JSON.parse(jsonData);

            const agents: Record<string, AgentRegistryEntry> = {};

            for (const [key, rawAgent] of Object.entries(rawAgents)) {
                const entry: AgentRegistryEntry = {
                    name: rawAgent.name,
                    displayName: rawAgent.displayName,
                    description: rawAgent.description,
                    version: rawAgent.version,
                    // Use configUrl directly if it's a URL, otherwise resolve as local path
                    configUrl: rawAgent.configUrl.startsWith('http')
                        ? rawAgent.configUrl
                        : path.join(PROJECT_ROOT, rawAgent.configUrl),
                    source: 'registry' as const,
                };

                // Only add optional properties if they exist
                if (rawAgent.author) {
                    entry.author = rawAgent.author;
                }
                if (rawAgent.tags) {
                    entry.tags = rawAgent.tags;
                }
                if (rawAgent.lastUpdated) {
                    entry.lastUpdated = rawAgent.lastUpdated;
                }

                agents[key] = entry;
            }

            return agents;
        } catch (error) {
            logger.error(`Failed to load registry agents: ${error}`);
            return {};
        }
    }

    /**
     * Check if a name corresponds to a registry agent
     */
    private isRegistryAgent(name: string): boolean {
        return name in this.getRegistryAgents();
    }

    /**
     * Get a registry agent by name
     */
    private getRegistryAgent(name: string): AgentRegistryEntry | null {
        return this.getRegistryAgents()[name] || null;
    }

    /**
     * Download and cache a remote agent configuration
     */
    private async downloadAndCacheConfig(url: string): Promise<string> {
        try {
            // Create cache directory
            const cacheDir = getSaikiPath('cache', 'agents');
            if (!existsSync(cacheDir)) {
                mkdirSync(cacheDir, { recursive: true });
            }

            // Generate cache filename from URL using SHA-256 hash
            const urlHash = createHash('sha256').update(url).digest('hex');
            const cacheFile = path.join(cacheDir, `${urlHash}.yml`);
            const metaFile = path.join(cacheDir, `${urlHash}.meta.json`);

            // Check if cached version exists and is still valid
            if (existsSync(cacheFile) && existsSync(metaFile)) {
                try {
                    const meta = JSON.parse(readFileSync(metaFile, 'utf-8'));
                    const cacheAge = Date.now() - meta.timestamp;

                    if (cacheAge < this.config.cacheTtl! * 1000) {
                        logger.debug(`Using cached agent config: ${cacheFile}`);
                        return cacheFile;
                    }
                } catch (error) {
                    logger.debug(`Cache meta file corrupted, re-downloading: ${error}`);
                }
            }

            // Download fresh copy
            logger.info(`Downloading agent config from: ${url}`);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const content = await response.text();

            // Save to cache
            writeFileSync(cacheFile, content, 'utf-8');
            writeFileSync(
                metaFile,
                JSON.stringify({
                    url,
                    timestamp: Date.now(),
                    size: content.length,
                }),
                'utf-8'
            );

            logger.debug(`Cached agent config: ${cacheFile}`);
            return cacheFile;
        } catch (error) {
            throw new Error(
                `Failed to download agent config from ${url}: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * List all available agents in the registry
     */
    async listAgents(): Promise<AgentRegistryEntry[]> {
        const agents: AgentRegistryEntry[] = [];

        // Add registry agents
        for (const agent of Object.values(this.getRegistryAgents())) {
            // For HTTP URLs, we assume they're available (don't test connectivity during listing)
            // For local paths, verify the config file exists
            if (agent.configUrl.startsWith('http') || existsSync(agent.configUrl)) {
                agents.push(agent);
            } else {
                logger.debug(`Registry agent config not found: ${agent.configUrl}`);
            }
        }

        // TODO: Add remote registry agents in future

        return agents.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Get a specific agent by name
     */
    async getAgent(name: string): Promise<AgentRegistryEntry | null> {
        // Check registry agents first
        const registryAgent = this.getRegistryAgent(name);
        if (registryAgent) {
            // For HTTP URLs, we assume they're available
            // For local paths, verify the config file exists
            if (registryAgent.configUrl.startsWith('http') || existsSync(registryAgent.configUrl)) {
                return registryAgent;
            }
        }

        // TODO: Check remote registries in future

        return null;
    }

    /**
     * Check if an agent exists in the registry
     */
    async hasAgent(name: string): Promise<boolean> {
        const agent = await this.getAgent(name);
        return agent !== null;
    }

    /**
     * Resolve an agent name or path to a configuration file path
     *
     * Resolution order:
     * 1. If it's a registry agent name, return the registry config path (download if HTTP URL)
     * 2. If it's a file path that exists, return it as-is
     * 3. If it's a relative path, resolve it relative to cwd
     * 4. Return null if nothing matches
     */
    async resolveAgent(nameOrPath: string): Promise<string> {
        logger.debug(`Resolving agent: ${nameOrPath}`);

        // 1. Check if it's a registry agent name
        if (this.isRegistryAgent(nameOrPath)) {
            const agent = this.getRegistryAgent(nameOrPath);
            if (agent) {
                // If it's an HTTP URL, download and cache it
                if (agent.configUrl.startsWith('http')) {
                    const cachedPath = await this.downloadAndCacheConfig(agent.configUrl);
                    logger.debug(
                        `Resolved registry agent '${nameOrPath}' to cached file: ${cachedPath}`
                    );
                    return cachedPath;
                }
                // If it's a local file, check if it exists
                else if (existsSync(agent.configUrl)) {
                    logger.debug(`Resolved registry agent '${nameOrPath}' to: ${agent.configUrl}`);
                    return agent.configUrl;
                }
            }
        }

        // 2. Check if it's an absolute path that exists
        if (path.isAbsolute(nameOrPath) && existsSync(nameOrPath)) {
            logger.debug(`Using absolute path: ${nameOrPath}`);
            return nameOrPath;
        }

        // 3. Check if it's a relative path that exists (resolve from cwd)
        const resolvedPath = path.resolve(nameOrPath);
        if (existsSync(resolvedPath)) {
            logger.debug(`Resolved relative path '${nameOrPath}' to: ${resolvedPath}`);
            return resolvedPath;
        }

        // 4. Nothing found - throw error with helpful message
        const availableAgents = Object.keys(this.getRegistryAgents());
        throw new Error(
            `Agent '${nameOrPath}' not found. ` +
                `Available agents: ${availableAgents.join(', ')}. ` +
                `Or provide a valid file path to an agent configuration.`
        );
    }
}

// Default global registry instance
let defaultRegistry: LocalAgentRegistry | null = null;

/**
 * Get the default agent registry instance
 */
export function getDefaultAgentRegistry(): LocalAgentRegistry {
    if (!defaultRegistry) {
        defaultRegistry = new LocalAgentRegistry();
    }
    return defaultRegistry;
}

/**
 * Convenience function to resolve an agent name/path using the default registry
 */
export async function resolveAgentConfig(nameOrPath: string): Promise<string> {
    const registry = getDefaultAgentRegistry();
    return await registry.resolveAgent(nameOrPath);
}
