import { AgentConfig, CLIConfigOverrides } from './types.js';
import { logger } from '../utils/logger.js';
/**
 * Resolves the final configuration for Saiki based on provided sources.
 * Priority order: CLI arguments (for allowed fields) > config file > defaults.
 * @param configFile The base configuration loaded from a file (e.g., saiki.yml)
 * @param cliArgs CLI arguments for selective overrides (model, provider, router)
 * @returns The resolved configuration object
 */
export function resolveConfiguration(
    configFile: AgentConfig,
    cliArgs: CLIConfigOverrides
): AgentConfig {
    // Deep clone the config to avoid mutating the original object or any nested properties.
    // This ensures CLI overrides and defaults are applied safely without side effects.
    const resolved: AgentConfig = structuredClone(configFile);

    // Apply CLI arguments for allowed options (if provided)
    if (cliArgs.model) {
        logger.debug(`CLI resolved model: ${cliArgs.model}`);
        resolved.llm.model = cliArgs.model;
    }
    if (cliArgs.provider) {
        logger.debug(`CLI resolved provider: ${cliArgs.provider}`);
        resolved.llm.provider = cliArgs.provider;
    }
    if (cliArgs.router) {
        logger.debug(`CLI resolved router: ${cliArgs.router}`);
        resolved.llm.router = cliArgs.router;
    }
    // Add other CLI overrides as needed

    // Ensure defaults if necessary (lowest priority)
    resolved.llm.router = resolved.llm.router ?? 'vercel';
    // Add other defaults as needed for other fields

    logger.debug(`Resolved configuration: ${JSON.stringify(resolved, null, 2)}`);
    return resolved;
} 