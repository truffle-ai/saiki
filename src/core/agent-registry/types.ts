/**
 * Agent registry types and interfaces
 */

import { z } from 'zod';

// Base schema for agent metadata
const BaseAgentSchema = z.object({
    name: z.string().describe('Unique identifier for the agent'),
    displayName: z.string().describe('Human-readable display name'),
    description: z.string().describe("Brief description of the agent's purpose"),
    version: z.string().describe('Agent version'),
    author: z.string().optional().describe('Author/maintainer information'),
    tags: z.array(z.string()).optional().describe('Tags for categorization'),
    lastUpdated: z.string().optional().describe('Last update timestamp'),
});

// Schema for raw agent data from JSON file (what's stored in agent-registry.json)
export const RawAgentDataSchema = BaseAgentSchema.extend({
    configFile: z
        .string()
        .describe('Local path to the agent configuration (relative to agents directory)'),
}).strict();

export type RawAgentData = z.output<typeof RawAgentDataSchema>;

// Schema for processed agent registry entries - derived from raw data with additional fields
export const AgentRegistryEntrySchema = BaseAgentSchema.extend({
    configFile: z.string().describe('Absolute path to the agent configuration file'),
    source: z
        .enum(['registry', 'url', 'local'])
        .describe('Whether this is a registry agent, direct URL, or local file'),
}).strict();

export type AgentRegistryEntry = z.output<typeof AgentRegistryEntrySchema>;

// Transformation schema that converts RawAgentData to AgentRegistryEntry
export const RawToRegistryEntrySchema = RawAgentDataSchema.transform((rawData) => ({
    ...rawData,
    source: 'registry' as const,
}));

export type RawToRegistryEntry = z.output<typeof RawToRegistryEntrySchema>;

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
        cacheTtl: z
            .number()
            .positive()
            .describe('Cache TTL for remote agents (in seconds)')
            .default(3600),
    })
    .strict();

export type AgentRegistryConfig = z.output<typeof AgentRegistryConfigSchema>;
