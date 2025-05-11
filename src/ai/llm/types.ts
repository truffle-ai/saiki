import type { LLMConfigSchema } from '../../config/schemas.js';
import { z } from 'zod';

/**
 * LLMRouter defines the routing backend for LLM service instantiation.
 * 'vercel' = use Vercel LLM service, 'in-built' = use in-built LLM service
 * This type is derived from the llmConfigSchema to ensure it stays in sync.
 */
export type LLMRouter = z.infer<typeof LLMConfigSchema>['router'];
