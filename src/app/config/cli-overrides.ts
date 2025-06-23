/**
 * CLI-specific configuration types and utilities
 * This file handles CLI argument processing and config merging logic
 */

import type { LLMConfig, AgentConfig } from '@core/index.js';

/**
 * CLI config override type for LLM fields that can be overridden via CLI
 */
export type CLIConfigOverrides = Partial<
    Pick<LLMConfig, 'provider' | 'model' | 'router' | 'apiKey'>
>;

/**
 * Applies CLI overrides to an agent configuration
 * This merges CLI arguments into the base config, producing a final AgentConfig
 * that can be passed to the core layer
 *
 * @param baseConfig The configuration loaded from file
 * @param cliOverrides CLI arguments to override specific fields
 * @returns Merged configuration ready for core layer
 */
export function applyCLIOverrides(
    baseConfig: AgentConfig,
    cliOverrides?: CLIConfigOverrides
): AgentConfig {
    if (!cliOverrides) {
        return baseConfig;
    }

    // Create a deep copy of the base config
    const mergedConfig: AgentConfig = JSON.parse(JSON.stringify(baseConfig));

    // Apply CLI overrides to LLM config
    if (cliOverrides.provider) {
        mergedConfig.llm.provider = cliOverrides.provider;
    }
    if (cliOverrides.model) {
        mergedConfig.llm.model = cliOverrides.model;
    }
    if (cliOverrides.router) {
        mergedConfig.llm.router = cliOverrides.router;
    }
    if (cliOverrides.apiKey) {
        mergedConfig.llm.apiKey = cliOverrides.apiKey;
    }

    return mergedConfig;
}
