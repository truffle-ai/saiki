/**
 * Agent registry types and interfaces
 */

import { z } from 'zod';

export const AgentRegistryEntrySchema = z
    .object({
        name: z.string().describe('Unique identifier for the agent'),
        displayName: z.string().describe('Human-readable display name'),
        description: z.string().describe("Brief description of the agent's purpose"),
        version: z.string().describe('Agent version'),
        author: z.string().optional().describe('Author/maintainer information'),
        tags: z.array(z.string()).optional().describe('Tags for categorization'),
        configUrl: z.string().describe('URL or local path to the agent configuration'),
        source: z
            .enum(['registry', 'remote', 'local'])
            .describe('Whether this is a registry agent or external'),
        lastUpdated: z.string().optional().describe('Last update timestamp'),
    })
    .strict();

export type AgentRegistryEntry = z.infer<typeof AgentRegistryEntrySchema>;

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

export const AgentRegistryConfigSchema = z
    .object({
        registryAgents: z
            .record(z.string(), AgentRegistryEntrySchema)
            .describe('Local registry agents')
            .default({}),
        remoteRegistries: z
            .array(z.string())
            .optional()
            .describe('Remote registry endpoints (for future use)'),
        cacheTtl: z
            .number()
            .positive()
            .describe('Cache TTL for remote agents (in seconds)')
            .default(3600),
    })
    .strict();

export type AgentRegistryConfig = z.infer<typeof AgentRegistryConfigSchema>;
