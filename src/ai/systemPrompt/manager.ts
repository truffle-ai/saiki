import type { ContributorConfig, SystemPromptConfig } from '../../config/types.js';
import { StaticContributor } from './contributors.js';
import { getPromptGenerator } from './registry.js';
import { registerPromptGenerator } from './registry.js';
import type { DynamicPromptGenerator } from './registry.js';
import type { SystemPromptContributor, DynamicContributorContext } from './types.js';
import { DynamicContributor } from './contributors.js';
import { logger } from '../../utils/logger.js';

/**
 * PromptManager orchestrates registration, loading, and composition
 * of both static and dynamic system-prompt contributors.
 */
export class PromptManager {
    private contributors: SystemPromptContributor[] = [];
    private rawConfig: string | SystemPromptConfig;

    constructor(config: string | SystemPromptConfig) {
        this.load(config);
    }

    /**
     * Load contributors from config (static + dynamic).
     */
    load(config: string | SystemPromptConfig) {
        this.rawConfig = config;
        // Inline loader logic from loader.ts:
        const defaultContributors: ContributorConfig[] = [
            { id: 'dateTime', type: 'dynamic', priority: 10, source: 'dateTime', enabled: true },
            { id: 'resources', type: 'dynamic', priority: 20, source: 'resources', enabled: true },
        ];

        let contributorCfgs: ContributorConfig[];
        // basic prompt config - string
        if (typeof config === 'string') {
            // Always include default dynamic contributors (e.g. dateTime)
            contributorCfgs = [
                ...defaultContributors,
                { id: 'legacyPrompt', type: 'static', priority: 0, content: config, enabled: true },
            ];
        } else {
            // Start with default dynamic contributors
            contributorCfgs = [...defaultContributors];
            for (const userC of config.contributors) {
                const idx = contributorCfgs.findIndex((c) => c.id === userC.id);
                if (idx !== -1) contributorCfgs[idx] = userC;
                else contributorCfgs.push(userC);
            }
            contributorCfgs = contributorCfgs.filter((c) => c.enabled !== false);
        }

        const contributors = contributorCfgs.map((contributor) => {
            if (contributor.type === 'static') {
                if (!contributor.content)
                    throw new Error(`Static contributor "${contributor.id}" missing content`);
                return new StaticContributor(
                    contributor.id,
                    contributor.priority,
                    contributor.content
                );
            } else if (contributor.type === 'dynamic' && contributor.source) {
                const promptGenerator = getPromptGenerator(contributor.source);
                if (!promptGenerator)
                    throw new Error(
                        `No generator registered for dynamic contributor source: ${contributor.source}`
                    );
                return new DynamicContributor(
                    contributor.id,
                    contributor.priority,
                    promptGenerator
                );
            }
            throw new Error(`Invalid contributor config: ${JSON.stringify(contributor)}`);
        });
        // Lower priority number first (0 = highest priority)
        this.contributors = contributors.sort((a, b) => a.priority - b.priority);
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
