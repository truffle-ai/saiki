import { ClientManager } from '../../../client/manager.js';
import { ILLMService } from './types.js';
import { LLMConfig } from '../../../config/types.js';
import { logger } from '../../../utils/logger.js';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { VercelLLMService } from './vercel.js';
import { OpenAIService } from './openai.js';
import { AnthropicService } from './anthropic.js';
import { LanguageModelV1 } from 'ai';
import { EventEmitter } from 'events';
import { LLMRouter } from '../types.js';
import { MessageManager } from '../messages/manager.js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Extract and validate API key from config or environment variables
 * @param config LLM configuration from the config file
 * @returns Valid API key or throws an error
 */
function extractApiKey(config: LLMConfig): string {
    const provider = config.provider;

    // Get API key from config (already expanded)
    let apiKey = config.apiKey || '';

    if (!apiKey) {
        const errorMsg = `Error: API key for ${provider} not found`;
        logger.error(errorMsg);
        logger.error(
            `Please set your ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key in the config file or .env file`
        );
        throw new Error(errorMsg);
    }

    logger.debug('Verified API key');
    return apiKey;
}

/**
 * Create an instance of one of our in-built LLM services
 * @param config LLM configuration from the config file
 * @param clientManager Client manager instance
 * @param agentEventBus Event emitter instance
 * @param messageManager Message manager instance
 * @returns ILLMService instance
 */
function _createInBuiltLLMService(
    config: LLMConfig,
    clientManager: ClientManager,
    agentEventBus: EventEmitter,
    messageManager: MessageManager
): ILLMService {
    // Extract and validate API key
    const apiKey = extractApiKey(config);

    switch (config.provider.toLowerCase()) {
        case 'openai': {
            const openai = new OpenAI({ apiKey });
            return new OpenAIService(
                clientManager,
                openai,
                agentEventBus,
                messageManager,
                config.model
            );
        }
        case 'anthropic': {
            const anthropic = new Anthropic({ apiKey });
            return new AnthropicService(
                clientManager,
                anthropic,
                agentEventBus,
                messageManager,
                config.model
            );
        }
        default:
            throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
}

function _createVercelModel(provider: string, model: string): LanguageModelV1 {
    switch (provider.toLowerCase()) {
        case 'openai':
            return openai(model);
        case 'anthropic':
            return anthropic(model);
        case 'google':
            return google(model);
        default:
            throw new Error(`Unsupported LLM provider: ${provider}`);
    }
}

function _createVercelLLMService(
    config: LLMConfig,
    clientManager: ClientManager,
    agentEventBus: EventEmitter,
    messageManager: MessageManager
): VercelLLMService {
    const model: LanguageModelV1 = _createVercelModel(config.provider, config.model);
    // Allow overriding of maxIterations via config.llm.maxIterations
    const maxIter = config.maxIterations ?? 50;
    return new VercelLLMService(clientManager, model, agentEventBus, messageManager, maxIter);
}

/**
 * Enum/type for LLM routing backend selection.
 * 'vercel' = use Vercel LLM service, 'default' = use in-built LLM service
 */
export function createLLMService(
    config: LLMConfig,
    router: LLMRouter = 'vercel',
    clientManager: ClientManager,
    agentEventBus: EventEmitter,
    messageManager: MessageManager
): ILLMService {
    if (router === 'vercel') {
        return _createVercelLLMService(config, clientManager, agentEventBus, messageManager);
    } else {
        return _createInBuiltLLMService(config, clientManager, agentEventBus, messageManager);
    }
}
