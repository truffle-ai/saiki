import { MessageManager } from './manager.js';
import { VercelMessageFormatter } from './formatters/vercel.js';
import { OpenAIMessageFormatter } from './formatters/openai.js';
import { AnthropicMessageFormatter } from './formatters/anthropic.js';
import { createTokenizer } from '../tokenizer/factory.js';
import { getMaxTokens } from '../tokenizer/utils.js';
import { LLMConfig } from '../../../config/types.js';
import { LLMRouter } from '../types.js';
import { IMessageFormatter } from './formatters/types.js';
import { ITokenizer } from '../tokenizer/types.js';

/**
 * Factory function to create a MessageManager instance with the correct formatter, tokenizer, and maxTokens
 * based on the LLM config and router (vercel, default, or future types).
 *
 * @param config LLMConfig object containing provider, model, systemPrompt, etc.
 * @param router LLMRouter flag ('vercel', 'default', etc.)
 * @returns MessageManager instance
 */
export function createMessageManager(
    config: LLMConfig,
    router: LLMRouter = 'vercel'
): MessageManager {
    let formatter: IMessageFormatter;
    let tokenizer: ITokenizer;
    let maxTokens: number;
    const provider = config.provider.toLowerCase();
    const model = config.model;

    if (router === 'vercel') {
        formatter = new VercelMessageFormatter();
        tokenizer = createTokenizer(provider, model);
        maxTokens = Math.floor(getMaxTokens(provider, model) * 0.9);
    } else if (router === 'default') {
        if (provider === 'openai') {
            formatter = new OpenAIMessageFormatter();
            tokenizer = createTokenizer('openai', model);
            maxTokens = Math.floor(getMaxTokens('openai', model) * 0.9);
        } else if (provider === 'anthropic') {
            formatter = new AnthropicMessageFormatter();
            tokenizer = createTokenizer('anthropic', model);
            maxTokens = Math.floor(getMaxTokens('anthropic', model) * 0.9);
        } else {
            throw new Error(`Unsupported LLM provider: ${provider} for router: ${router}`);
        }
    } else {
        throw new Error(`Unsupported LLM router: ${router}`);
    }

    return new MessageManager(
        formatter,
        config.systemPrompt ?? null,
        maxTokens,
        tokenizer
    );
} 