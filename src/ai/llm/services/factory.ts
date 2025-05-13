import { MCPClientManager } from '../../../client/manager.js';
import { ILLMService } from './types.js';
import { LLMConfig } from '../../../config/schemas.js';
import { logger } from '../../../utils/logger.js';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
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
    clientManager: MCPClientManager,
    agentEventBus: EventEmitter,
    messageManager: MessageManager
): ILLMService {
    // Extract and validate API key
    const apiKey = extractApiKey(config);

    switch (config.provider.toLowerCase()) {
        case 'openai': {
            const baseURL = getOpenAICompatibleBaseURL(config);
            let openai: OpenAI;
            if (baseURL) {
                openai = new OpenAI({ apiKey, baseURL });
            } else {
                openai = new OpenAI({ apiKey });
            }
            return new OpenAIService(
                clientManager,
                openai,
                agentEventBus,
                messageManager,
                config.model,
                config.maxIterations
            );
        }
        case 'anthropic': {
            const anthropic = new Anthropic({ apiKey });
            return new AnthropicService(
                clientManager,
                anthropic,
                agentEventBus,
                messageManager,
                config.model,
                config.maxIterations
            );
        }
        default:
            throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
}

function _createVercelModel(llmConfig: LLMConfig): LanguageModelV1 {
    const provider = llmConfig.provider;
    const model = llmConfig.model;
    const apiKey = extractApiKey(llmConfig);

    switch (provider.toLowerCase()) {
        case 'openai':
            const baseURL = getOpenAICompatibleBaseURL(llmConfig);
            const options: { apiKey: string; baseURL?: string } = { apiKey };
            if (baseURL) {
                options.baseURL = baseURL;
            }
            return createOpenAI(options)(model);
        case 'anthropic':
            return createAnthropic({ apiKey })(model);
        case 'google':
            return createGoogleGenerativeAI({ apiKey })(model);
        default:
            throw new Error(`Unsupported LLM provider: ${provider}`);
    }
}

/**
 * Overrides a default base URL for OpenAI compatible models - this allows adding openai compatibles
 * Hierarchy: we first check the config file, then the environment variable
 * @param llmConfig LLM configuration from the config file
 * @returns Base URL or empty string if not found
 */
function getOpenAICompatibleBaseURL(llmConfig: LLMConfig): string {
    if (llmConfig.baseURL) {
        return llmConfig.baseURL;
    }
    // Check for environment variable as fallback
    if (process.env.OPENAI_BASE_URL) {
        return process.env.OPENAI_BASE_URL;
    }
    return '';
}

function _createVercelLLMService(
    config: LLMConfig,
    clientManager: MCPClientManager,
    agentEventBus: EventEmitter,
    messageManager: MessageManager
): VercelLLMService {
    const model: LanguageModelV1 = _createVercelModel(config);
    return new VercelLLMService(
        clientManager,
        model,
        config.provider,
        agentEventBus,
        messageManager,
        config.maxIterations
    );
}

/**
 * Enum/type for LLM routing backend selection.
 */
export function createLLMService(
    config: LLMConfig,
    router: LLMRouter,
    clientManager: MCPClientManager,
    agentEventBus: EventEmitter,
    messageManager: MessageManager
): ILLMService {
    if (router === 'vercel') {
        return _createVercelLLMService(config, clientManager, agentEventBus, messageManager);
    } else {
        return _createInBuiltLLMService(config, clientManager, agentEventBus, messageManager);
    }
}
