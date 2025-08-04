/**
 * Agent registry types and interfaces
 */

export interface AgentRegistryEntry {
    /** Unique identifier for the agent */
    name: string;
    /** Human-readable display name */
    displayName: string;
    /** Brief description of the agent's purpose */
    description: string;
    /** Agent version */
    version: string;
    /** Author/maintainer information */
    author?: string;
    /** Tags for categorization */
    tags?: string[];
    /** URL or local path to the agent configuration */
    configUrl: string;
    /** Whether this is a registry agent or external */
    source: 'registry' | 'remote' | 'local';
    /** Last update timestamp */
    lastUpdated?: string;
}

export interface AgentRegistry {
    /** Get all available agents */
    listAgents(): Promise<AgentRegistryEntry[]>;

    /** Get a specific agent by name */
    getAgent(name: string): Promise<AgentRegistryEntry | null>;

    /** Check if an agent exists in the registry */
    hasAgent(name: string): Promise<boolean>;

    /** Resolve an agent name/path to a config path */
    resolveAgent(nameOrPath: string): Promise<string>;
}

export interface AgentRegistryConfig {
    /** Local registry agents */
    registryAgents: Record<string, AgentRegistryEntry>;

    /** Remote registry endpoints (for future use) */
    remoteRegistries?: string[];

    /** Cache TTL for remote agents (in seconds) */
    cacheTtl?: number;
}
