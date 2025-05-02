/**
 * LLMRouter defines the routing backend for LLM service instantiation.
 * 'vercel' = use Vercel LLM service, 'in-built' = use in-built LLM service
 */
export type LLMRouter = 'vercel' | 'in-built';
