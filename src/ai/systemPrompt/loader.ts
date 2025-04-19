import { AgentConfig } from '../../config/types.js';
import { ClientManager } from '../../client/manager.js';
import { SystemPromptContributor, DynamicContributorContext } from './types.js';
import { ContributorConfig, SystemPromptConfig } from '../../config/types.js';
import { StaticContributor, DynamicContributor } from './contributors.js';
import { getSourceHandler } from './registry.js';
import { logger } from '../../utils/logger.js';
/**
 * Loads and merges system prompt contributors from config and defaults.
 * Returns a sorted array of SystemPromptContributor instances.
 * TODO: REFACTOR
 */
export function loadContributors(
  systemPromptConfig: string | SystemPromptConfig,
  agentConfig: AgentConfig,
  clientManager: ClientManager
): SystemPromptContributor[] {
  logger.debug(`Loading contributors for system prompt: ${systemPromptConfig}`);
  // Default contributors (can be extended)
  const defaultContributors: ContributorConfig[] = [
    { id: 'dateTime', type: 'dynamic', priority: 10, source: 'dateTime', enabled: true },
  ];

  // Determine configContributors based on config type
  let configContributors: ContributorConfig[] = [];
  if (typeof systemPromptConfig === 'string') {
    // Legacy: treat as a single static contributor
    logger.debug(`[SystemPrompt] Loading legacy system prompt: ${systemPromptConfig}`);
    configContributors = [
      { id: 'legacyPrompt', type: 'static', priority: 0, content: systemPromptConfig, enabled: true }
    ];
  } else {
    configContributors = systemPromptConfig.contributors || [];
  }

  // Merge config contributors with defaults
  const merged: ContributorConfig[] = [...defaultContributors];

  for (const config of configContributors) {
    const idx = merged.findIndex((c) => c.id === config.id);
    if (idx !== -1) {
      merged[idx] = config; // Replace default with config
    } else {
      merged.push(config); // Add new
    }
  }

  // Filter out disabled contributors
  const filtered = merged.filter((c) => c.enabled !== false);

  // Instantiate contributors
  const contributors: SystemPromptContributor[] = filtered.map((config) => {
    if (config.type === 'static') {
      if (!config.content) {
        throw new Error(`StaticContributor '${config.id}' requires 'content'.`);
      }
      return new StaticContributor(config.id, config.priority, config.content);
    } else if (config.type === 'dynamic') {
      if (!config.source) {
        throw new Error(`DynamicContributor '${config.id}' requires 'source'.`);
      }
      const handler = getSourceHandler(config.source);
      if (!handler) {
        throw new Error(`No handler found for dynamic contributor source '${config.source}' (id: ${config.id}).`);
      }
      // Provide context when called, not here
      return new DynamicContributor(config.id, config.priority, handler);
    } else {
      throw new Error(`Unknown contributor type: ${config.type}`);
    }
  });

  // Sort by priority (ascending)
  contributors.sort((a, b) => a.priority - b.priority);
  return contributors;
} 