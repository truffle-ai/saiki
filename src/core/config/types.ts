/**
 * Type definitions for application configuration
 */

import type { LLMConfig, AgentCard, StorageConfig } from './schemas.js';

/**
 * Keys in LLMConfig that can be overridden via CLI
 */
export type LLMOverrideKey = 'provider' | 'model' | 'router' | 'apiKey';

/**
 * CLI config override type for allowed fields
 */
export type CLIConfigOverrides = Partial<Pick<LLMConfig, LLMOverrideKey>>;

/**
 * Possible sources for configuration field overrides
 */
export type Source = 'file' | 'cli' | 'default' | 'runtime';

/**
 * Provenance for CLI-overridable LLM fields only
 */
export type LLMProvenance = Record<LLMOverrideKey, Source>;

// Re-export types from schemas for convenience
export type { AgentCard, StorageConfig };
