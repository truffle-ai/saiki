/**
 * LLMRouter defines the routing backend for LLM service instantiation.
 * 'vercel' = use Vercel LLM service, 'default' = use in-built LLM service
 */
export type LLMRouter = 'vercel' | 'default'; 