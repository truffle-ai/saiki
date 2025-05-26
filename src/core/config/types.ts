/**
 * Type definitions for application configuration
 */

import type { LLMConfig } from './schemas.js';
import { AgentCardSchema } from './schemas.js';
import { z } from 'zod';

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

export type AgentCard = z.infer<typeof AgentCardSchema>;
