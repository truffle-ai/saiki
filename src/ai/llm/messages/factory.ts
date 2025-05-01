import { MessageManager } from './manager.js';
import { VercelMessageFormatter } from './formatters/vercel.js';
import { OpenAIMessageFormatter } from './formatters/openai.js';
import { AnthropicMessageFormatter } from './formatters/anthropic.js';
import { createTokenizer } from '../tokenizer/factory.js';
import { LLMConfig } from '../../../config/types.js';
import { LLMRouter } from '../types.js';
import { IMessageFormatter } from './formatters/types.js';
import { ITokenizer } from '../tokenizer/types.js';
import { SystemPromptContributor } from '../../systemPrompt/types.js';
import { logger } from '../../../utils/logger.js';
import { getMaxTokensForModel } from '../registry.js';

/**
 * Factory function to create a MessageManager instance with the correct formatter, tokenizer, and maxTokens
 * based on the LLM config and router (vercel, default, or future types).
 *
 * @param config LLMConfig object containing provider, model, systemPrompt, etc.
 * @param router LLMRouter flag ('vercel', 'default', etc.)
 * @param contributors SystemPromptContributor[]
 * @returns MessageManager instance
 * TODO: Make compression strategy also configurable
 */
export function createMessageManager(
    config: LLMConfig,
    router: LLMRouter = 'vercel',
    contributors: SystemPromptContributor[]
): MessageManager {
    let formatter: IMessageFormatter;
    let tokenizer: ITokenizer;
    let maxTokens: number;

    const provider = config.provider.toLowerCase();
    const model = config.model.toLowerCase();

    const registryMaxTokens = getMaxTokensForModel(provider, model);

    maxTokens = Math.floor(registryMaxTokens * 0.9);

    try {
        tokenizer = createTokenizer(provider, model);
        logger.debug(`Tokenizer created for ${provider}/${model}`);
    } catch (error) {
        logger.error(`Failed to create tokenizer for ${provider}/${model}. Error: ${error}`);
        throw new Error(`Unsupported tokenizer or invalid model for provider ${provider}: ${model}`);
    }

    if (router === 'vercel') {
        formatter = new VercelMessageFormatter();
    } else if (router === 'default') {
        if (provider === 'openai') {
            formatter = new OpenAIMessageFormatter();
        } else if (provider === 'anthropic') {
            formatter = new AnthropicMessageFormatter();
        } else {
            logger.error(`Provider '${provider}' supported by registry but not configured for 'default' router message formatting.`);
            throw new Error(`Unsupported LLM provider: ${provider} for router: ${router}`);
        }
    } else {
        logger.error(`Unsupported LLM router specified: ${router}`);
        throw new Error(`Unsupported LLM router: ${router}`);
    }

    logger.debug(
        `Creating MessageManager for ${provider}/${model} using ${router} router with maxTokens: ${maxTokens}`
    );
    return new MessageManager(formatter, contributors, maxTokens, tokenizer);
}

