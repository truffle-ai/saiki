import type { LLMConfigSchema } from '../config/schemas.js';
import { z } from 'zod';
import { LLMProvider } from './registry.js';

/**
 * LLMRouter defines the routing backend for LLM service instantiation.
 * 'vercel' = use Vercel LLM service, 'in-built' = use in-built LLM service
 * This type is derived from the llmConfigSchema to ensure it stays in sync.
 */
export type LLMRouter = z.infer<typeof LLMConfigSchema>['router'];
/**
 * Context interface for message formatters.
 * Provides runtime information for model-aware processing.
 */

export interface LLMContext {
    /** LLM provider name (e.g., 'google.generative-ai', 'openai') */
    provider: LLMProvider;

    /** Specific LLM model name (e.g., 'gemini-2.5-flash', 'gpt-4') */
    model: string;
}
