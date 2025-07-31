import type { ContributorConfig, SystemPromptConfig } from '../config/schemas.js';
import { StaticContributor, FileContributor } from './contributors.js';
import { getPromptGenerator } from './registry.js';
import { registerPromptGenerator } from './registry.js';
import type { DynamicPromptGenerator } from './registry.js';
import type { SystemPromptContributor, DynamicContributorContext } from './types.js';
import { DynamicContributor } from './contributors.js';
import { logger } from '../logger/index.js';

/**
 * PromptManager orchestrates registration, loading, and composition
 * of both static and dynamic system-prompt contributors.
 */
export class PromptManager {
    private contributors: SystemPromptContributor[] = [];
    private rawConfig!: string | SystemPromptConfig;
    private configDir: string;

    constructor(config: string | SystemPromptConfig, configDir: string = process.cwd()) {
        this.configDir = configDir;
        logger.debug(`[PromptManager] Initializing with configDir: ${configDir}`);
        this.load(config);
    }

    /**
     * Load contributors from config (static + dynamic).
     */
    load(config: string | SystemPromptConfig) {
        this.rawConfig = config;
        const defaultContributors: ContributorConfig[] = [
            { id: 'dateTime', type: 'dynamic', priority: 10, source: 'dateTime', enabled: true },
            { id: 'resources', type: 'dynamic', priority: 20, source: 'resources', enabled: false },
        ];

        let contributorConfigs: ContributorConfig[];

        if (typeof config === 'string') {
            contributorConfigs = [
                ...defaultContributors, // Ensure defaults are always included
                {
                    id: 'legacyPrompt',
                    type: 'static',
                    priority: 0,
                    content: config,
                    enabled: true,
                },
            ];
        } else {
            contributorConfigs = [...defaultContributors];
            for (const userC of config.contributors) {
                const idx = contributorConfigs.findIndex((c) => c.id === userC.id);
                if (idx !== -1) {
                    // Merge, allowing user to override defaults including 'enabled'
                    contributorConfigs[idx] = { ...contributorConfigs[idx], ...userC };
                } else {
                    contributorConfigs.push(userC);
                }
            }
            // Filter out disabled contributors *after* merging defaults and user configs
            contributorConfigs = contributorConfigs.filter((c) => c.enabled !== false);
        }

        const loadedContributors: SystemPromptContributor[] = contributorConfigs.map((config) => {
            if (config.type === 'static') {
                if (config.content === undefined)
                    throw new Error(`Static contributor "${config.id}" missing content`);
                return new StaticContributor(config.id, config.priority, config.content);
            } else if (config.type === 'dynamic' && config.source) {
                const promptGenerator = getPromptGenerator(config.source);
                if (!promptGenerator)
                    throw new Error(
                        `No generator registered for dynamic contributor source: ${config.source}`
                    ); // Changed error message to match manager.ts previous one
                return new DynamicContributor(config.id, config.priority, promptGenerator);
            } else if (config.type === 'file') {
                if (!config.files || config.files.length === 0)
                    throw new Error(`File contributor "${config.id}" missing files`);
                logger.debug(
                    `[PromptManager] Creating FileContributor "${config.id}" with files: ${JSON.stringify(config.files)} and configDir: ${this.configDir}`
                );
                return new FileContributor(
                    config.id,
                    config.priority,
                    config.files,
                    config.options,
                    this.configDir
                );
            }
            throw new Error(`Invalid contributor config: ${JSON.stringify(config)}`);
        });
        // Lower priority number first (0 = highest priority)
        this.contributors = loadedContributors.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Register a new dynamic prompt generator at runtime.
     * Any already-loaded contributors referencing this source
     * will be instantiated and added immediately.
     * This enables APIs to be built on top - to dynamically add new prompt generators
     */
    register(id: string, generator: DynamicPromptGenerator) {
        registerPromptGenerator(id, generator);

        if (typeof this.rawConfig !== 'string') {
            for (const c of this.rawConfig.contributors) {
                if (c.type === 'dynamic' && c.source === id) {
                    this.contributors.push(new DynamicContributor(c.id, c.priority, generator));
                }
            }
            // Maintain priority order (lower = higher priority)
            this.contributors.sort((a, b) => a.priority - b.priority);
        }
    }

    /**
     * Build the full system prompt by invoking each contributor and concatenating.
     */
    async build(ctx: DynamicContributorContext): Promise<string> {
        const parts = await Promise.all(
            this.contributors.map(async (contributor) => {
                const content = await contributor.getContent(ctx);
                logger.debug(
                    `[SystemPrompt] Contributor "${contributor.id}" provided content: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`
                );
                return content;
            })
        );
        return parts.join('\n');
    }

    /**
     * Expose current list of contributors (for inspection or testing).
     */
    getContributors(): SystemPromptContributor[] {
        return this.contributors;
    }
}
