/**
 * Type definitions for application configuration
 */

import { LLMRouter } from '../ai/llm/types.js';
import type { PromptGeneratorKey } from '../ai/systemPrompt/registry.js';
import type { LLMConfig } from './schemas.js'; // Direct import for LLMConfig for internal use

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
export type Source = 'file' | 'cli' | 'default';

/**
 * Provenance for CLI-overridable LLM fields only
 */
export type LLMProvenance = Record<LLMOverrideKey, Source>;
