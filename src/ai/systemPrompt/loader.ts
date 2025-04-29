import { ContributorConfig, SystemPromptConfig } from '../../config/types.js';
import { SystemPromptContributor } from './types.js';
import { StaticContributor, DynamicContributor } from './contributors.js';
import { getSourceHandler } from './registry.js';

export function loadContributors(
    systemPromptConfig: string | SystemPromptConfig
): SystemPromptContributor[] {
    const defaultContributors: ContributorConfig[] = [
        { id: 'dateTime', type: 'dynamic', priority: 10, source: 'dateTime', enabled: true },
    ];

    let contributors: ContributorConfig[] = [];

    if (typeof systemPromptConfig === 'string') {
        contributors = [
            {
                id: 'legacyPrompt',
                type: 'static',
                priority: 0,
                content: systemPromptConfig,
                enabled: true,
            },
        ];
    } else {
        contributors = [...defaultContributors];
        for (const userC of systemPromptConfig.contributors) {
            const idx = contributors.findIndex((c) => c.id === userC.id);
            if (idx !== -1) contributors[idx] = userC;
            else contributors.push(userC);
        }
        contributors = contributors.filter((c) => c.enabled !== false);
    }

    const result: SystemPromptContributor[] = contributors.map((c) => {
        if (c.type === 'static') {
            if (!c.content) throw new Error(`Static contributor "${c.id}" missing content`);
            return new StaticContributor(c.id, c.priority, c.content);
        } else if (c.type === 'dynamic' && c.source) {
            const handler = getSourceHandler(c.source);
            if (!handler) throw new Error(`No handler for dynamic contributor source: ${c.source}`);
            return new DynamicContributor(c.id, c.priority, handler);
        }
        throw new Error(`Invalid contributor config: ${JSON.stringify(c)}`);
    });
    // Lower priority number first, so 0 is highest priority
    return result.sort((a, b) => a.priority - b.priority);
}
