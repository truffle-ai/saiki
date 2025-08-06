/**
 * Agent Registry Implementation
 * Handles resolution of agent names to configuration paths
 */

import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { logger } from '@core/logger/index.js';
import { getSaikiPath } from '@core/utils/path.js';
import { resolveBundledScript } from '@core/utils/path.js';
import {
    AgentRegistry,
    AgentRegistryEntry,
    AgentRegistryConfig,
    AgentRegistryConfigSchema,
    RawToRegistryEntrySchema,
} from './types.js';

/**
 * Check if a string is a URL
 */
function isUrl(str: string): boolean {
    try {
        new URL(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * Convert GitHub blob URLs to raw URLs for direct file access
 */
function normalizeGitHubUrl(url: string): string {
    try {
        const urlObj = new URL(url);

        // Check if this is a GitHub blob URL
        if (urlObj.hostname === 'github.com' && urlObj.pathname.includes('/blob/')) {
            // Convert github.com/user/repo/blob/branch/path to raw.githubusercontent.com/user/repo/branch/path
            const pathParts = urlObj.pathname.split('/');
            if (pathParts.length >= 5 && pathParts[3] === 'blob') {
                const user = pathParts[1];
                const repo = pathParts[2];
                const branch = pathParts[4];
                const filePath = pathParts.slice(5).join('/');

                const rawUrl = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${filePath}`;
                logger.debug(`Converted GitHub blob URL to raw URL: ${url} → ${rawUrl}`);
                return rawUrl;
            }
        }

        // Return original URL if not a GitHub blob URL
        return url;
    } catch (error) {
        logger.debug(`Failed to normalize URL ${url}: ${error}`);
        return url;
    }
}

/**
 * Check if a string looks like a file path (contains path separators)
 */
function isPath(str: string): boolean {
    return str.includes('/') || str.includes('\\') || str.includes('.');
}

export class LocalAgentRegistry implements AgentRegistry {
    private config: AgentRegistryConfig;
    private _registryAgents: Record<string, AgentRegistryEntry> | null = null;

    constructor(config?: Partial<AgentRegistryConfig>) {
        this.config = AgentRegistryConfigSchema.parse(config || {});
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
        let jsonPath: string;

        try {
            // Use bundled script resolution for proper path handling
            jsonPath = resolveBundledScript('agents/agent-registry.json');
        } catch (error) {
            logger.error(`Failed to resolve agent registry path: ${error}`);
            return {};
        }

        if (!existsSync(jsonPath)) {
            logger.debug(`Agent registry not found at: ${jsonPath}`);
            return {};
        }

        try {
            const jsonData = readFileSync(jsonPath, 'utf-8');
            const rawAgents: Record<string, unknown> = JSON.parse(jsonData);

            const agents: Record<string, AgentRegistryEntry> = {};

            for (const [key, rawAgentData] of Object.entries(rawAgents)) {
                // Validate and transform using Zod schema
                const transformedAgent = RawToRegistryEntrySchema.parse(rawAgentData);

                // Resolve config file path using bundled script resolution
                let configPath: string;
                try {
                    configPath = resolveBundledScript(`agents/${transformedAgent.configFile}`);
                } catch (error) {
                    logger.debug(`Failed to resolve config for agent '${key}': ${error}`);
                    continue; // Skip this agent if config can't be resolved
                }

                // Create final registry entry with resolved config path
                const entry: AgentRegistryEntry = {
                    ...transformedAgent,
                    configFile: configPath,
                };

                agents[key] = entry;
            }

            return agents;
        } catch (error) {
            logger.error(`Failed to load registry agents from ${jsonPath}: ${error}`);
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
            // For local paths, verify the config file exists
            if (existsSync(agent.configFile)) {
                agents.push(agent);
            } else {
                logger.debug(`Registry agent config not found: ${agent.configFile}`);
            }
        }

        return agents.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Get a specific agent by name
     */
    async getAgent(name: string): Promise<AgentRegistryEntry | null> {
        // Check registry agents first
        const registryAgent = this.getRegistryAgent(name);
        if (registryAgent) {
            // For local paths, verify the config file exists
            if (existsSync(registryAgent.configFile)) {
                return registryAgent;
            }
        }

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
     * Resolve an agent name, URL, or path to a configuration file path
     *
     * Resolution order:
     * 1. If it's a URL (starts with http/https), download and cache it
     * 2. If it's a registry agent name, return the registry config path
     * 3. If it's an absolute file path that exists, return it as-is
     * 4. If it's a relative path, resolve it relative to cwd
     * 5. Throw error if nothing matches
     */
    async resolveAgent(nameOrPath: string): Promise<string> {
        logger.debug(`Resolving agent: ${nameOrPath}`);

        // 1. Check if it's a URL - download and cache it
        if (isUrl(nameOrPath)) {
            try {
                const normalizedUrl = normalizeGitHubUrl(nameOrPath);
                const cachedPath = await this.downloadAndCacheConfig(normalizedUrl);
                logger.debug(`Resolved URL '${nameOrPath}' to cached file: ${cachedPath}`);
                return cachedPath;
            } catch (error) {
                throw new Error(
                    `Failed to download agent from URL '${nameOrPath}': ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }

        // 2. Check if it's a registry agent name
        if (this.isRegistryAgent(nameOrPath)) {
            const agent = this.getRegistryAgent(nameOrPath);
            if (agent && existsSync(agent.configFile)) {
                logger.debug(`Resolved registry agent '${nameOrPath}' to: ${agent.configFile}`);
                return agent.configFile;
            }
        }

        // 3. Check if it's an absolute path that exists
        if (path.isAbsolute(nameOrPath) && existsSync(nameOrPath)) {
            logger.debug(`Using absolute path: ${nameOrPath}`);
            return nameOrPath;
        }

        // 4. Check if it's a relative path that exists (resolve from cwd)
        if (isPath(nameOrPath)) {
            const resolvedPath = path.resolve(nameOrPath);
            if (existsSync(resolvedPath)) {
                logger.debug(`Resolved relative path '${nameOrPath}' to: ${resolvedPath}`);
                return resolvedPath;
            }
        }

        // 5. Nothing found - throw error with helpful message
        const availableAgents = Object.keys(this.getRegistryAgents());
        throw new Error(
            `Agent '${nameOrPath}' not found. ` +
                `Available registry agents: ${availableAgents.join(', ')}. ` +
                `You can also provide: a file path to an agent configuration, or a URL to download one.`
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
