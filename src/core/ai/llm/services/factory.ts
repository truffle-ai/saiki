import { MCPManager } from '../../../client/manager.js';
import { ILLMService } from './types.js';
import { LLMConfig } from '../../../config/schemas.js';
import { logger } from '../../../logger/index.js';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGroq } from '@ai-sdk/groq';
import { VercelLLMService } from './vercel.js';
import { OpenAIService } from './openai.js';
import { AnthropicService } from './anthropic.js';
import { LanguageModelV1 } from 'ai';
import { SessionEventBus } from '../../../events/index.js';
import { LLMRouter } from '../types.js';
import { ContextManager } from '../messages/manager.js';
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
        logger.error(`Please set your ${provider} API key in the config file or .env file`);
        throw new Error(errorMsg);
    }

    logger.debug('Verified API key');
    return apiKey;
}

/**
 * Create an instance of one of our in-built LLM services
 * @param config LLM configuration from the config file
 * @param clientManager Client manager instance
 * @param sessionEventBus Session-level event bus for emitting LLM events
 * @param contextManager Message manager instance
 * @returns ILLMService instance
 */
function _createInBuiltLLMService(
    config: LLMConfig,
    clientManager: MCPManager,
    sessionEventBus: SessionEventBus,
    contextManager: ContextManager
): ILLMService {
    // Extract and validate API key
    const apiKey = extractApiKey(config);

    switch (config.provider.toLowerCase()) {
        case 'openai': {
            const baseURL = getOpenAICompatibleBaseURL(config);
            // This will correctly handle both cases:
            // 1. When baseURL is set, it will be included in the options
            // 2. When baseURL is undefined/null/empty, the spread operator won't add the baseURL property
            const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
            return new OpenAIService(
                clientManager,
                openai,
                sessionEventBus,
                contextManager,
                config.model,
                config.maxIterations
            );
        }
        case 'anthropic': {
            const anthropic = new Anthropic({ apiKey });
            return new AnthropicService(
                clientManager,
                anthropic,
                sessionEventBus,
                contextManager,
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
        case 'openai': {
            const baseURL = getOpenAICompatibleBaseURL(llmConfig);
            const options: {
                apiKey: string;
                baseURL?: string;
                compatibility?: 'strict' | 'compatible';
            } = { apiKey, compatibility: 'strict' };
            if (baseURL) {
                options.baseURL = baseURL;
                options.compatibility = 'compatible';
            }
            return createOpenAI(options)(model);
        }
        case 'anthropic':
            return createAnthropic({ apiKey })(model);
        case 'google':
            return createGoogleGenerativeAI({ apiKey })(model);
        case 'groq':
            return createGroq({ apiKey })(model);
        default:
            throw new Error(`Unsupported LLM provider: ${provider}`);
    }
}

/**
 * Overrides a default base URL for OpenAI compatible models - this allows adding openai compatibles
 * Hierarchy: we first check the config file, then the environment variable
 * Regex checks for trailing slashes and removes them
 * @param llmConfig LLM configuration from the config file
 * @returns Base URL or empty string if not found
 */
function getOpenAICompatibleBaseURL(llmConfig: LLMConfig): string {
    if (llmConfig.baseURL) {
        return llmConfig.baseURL.replace(/\/$/, '');
    }
    // Check for environment variable as fallback
    if (process.env.OPENAI_BASE_URL) {
        return process.env.OPENAI_BASE_URL.replace(/\/$/, '');
    }
    return '';
}

function _createVercelLLMService(
    config: LLMConfig,
    clientManager: MCPManager,
    sessionEventBus: SessionEventBus,
    contextManager: ContextManager
): VercelLLMService {
    const model = _createVercelModel(config);

    return new VercelLLMService(
        clientManager,
        model,
        config.provider,
        sessionEventBus,
        contextManager,
        config.maxIterations,
        config.temperature,
        config.maxOutputTokens
    );
}

/**
 * Enum/type for LLM routing backend selection.
 */
export function createLLMService(
    config: LLMConfig,
    router: LLMRouter,
    clientManager: MCPManager,
    sessionEventBus: SessionEventBus,
    contextManager: ContextManager
): ILLMService {
    if (router === 'vercel') {
        return _createVercelLLMService(config, clientManager, sessionEventBus, contextManager);
    } else {
        return _createInBuiltLLMService(config, clientManager, sessionEventBus, contextManager);
    }
}
