import { IMessageFormatter } from './types.js';
import { VercelMessageFormatter } from './vercel.js';
import { OpenAIMessageFormatter } from './openai.js';
import { AnthropicMessageFormatter } from './anthropic.js';
import { logger } from '../../../logger/index.js';
import { LLMProvider } from '../../registry.js';

export function createMessageFormatter(provider: LLMProvider, router: string): IMessageFormatter {
    if (router === 'vercel') {
        return new VercelMessageFormatter();
    } else if (router === 'in-built') {
        if (provider === 'openai') {
            return new OpenAIMessageFormatter();
        } else if (provider === 'anthropic') {
            return new AnthropicMessageFormatter();
        } else {
            logger.error(
                `Provider '${provider}' supported by registry but not configured for 'default' router message formatting.`
            );
            throw new Error(`Unsupported LLM provider: ${provider} for router: ${router}`);
        }
    } else {
        logger.error(`Unsupported LLM router specified: ${router}`);
        throw new Error(`Unsupported LLM router: ${router}`);
    }
}
