import { MCPManager } from '../../../client/manager.js';
import { ILLMService } from './types.js';
import { ValidatedLLMConfig } from '../../../config/schemas.js';
import { logger } from '../../../logger/index.js';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGroq } from '@ai-sdk/groq';
import { createXai } from '@ai-sdk/xai';
import { VercelLLMService } from './vercel.js';
import { OpenAIService } from './openai.js';
import { AnthropicService } from './anthropic.js';
import { LanguageModelV1 } from 'ai';
import { SessionEventBus } from '../../../events/index.js';
import { LLMRouter } from '../types.js';
import { ContextManager } from '../messages/manager.js';
import { createCohere } from '@ai-sdk/cohere';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { PluginManager } from '../../../plugins/index.js';

/**
 * Extract and validate API key from config or environment variables
 * @param config LLM configuration from the config file
 * @returns Valid API key or throws an error
 */
function extractApiKey(config: ValidatedLLMConfig): string {
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
 * @param mcpManager Client manager instance
 * @param sessionEventBus Session-level event bus for emitting LLM events
 * @param contextManager Message manager instance
 * @param sessionId Session ID
 * @returns ILLMService instance
 */
function _createInBuiltLLMService(
    config: ValidatedLLMConfig,
    mcpManager: MCPManager,
    sessionEventBus: SessionEventBus,
    contextManager: ContextManager,
    sessionId: string,
    _pluginManager?: PluginManager
): ILLMService {
    // Extract and validate API key
    const apiKey = extractApiKey(config);

    switch (config.provider.toLowerCase()) {
        case 'openai': {
            // Regular OpenAI - no baseURL support
            const openai = new OpenAI({ apiKey });
            return new OpenAIService(
                mcpManager,
                openai,
                sessionEventBus,
                contextManager,
                config.model,
                config.maxIterations,
                sessionId
            );
        }
        case 'openai-compatible': {
            // OpenAI-compatible - requires baseURL
            const baseURL = getOpenAICompatibleBaseURL(config);
            const openai = new OpenAI({ apiKey, baseURL });
            return new OpenAIService(
                mcpManager,
                openai,
                sessionEventBus,
                contextManager,
                config.model,
                config.maxIterations,
                sessionId
            );
        }
        case 'anthropic': {
            const anthropic = new Anthropic({ apiKey });
            return new AnthropicService(
                mcpManager,
                anthropic,
                sessionEventBus,
                contextManager,
                config.model,
                config.maxIterations,
                sessionId
            );
        }
        default:
            throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
}

function _createVercelModel(llmConfig: ValidatedLLMConfig): LanguageModelV1 {
    const provider = llmConfig.provider;
    const model = llmConfig.model;
    const apiKey = extractApiKey(llmConfig);

    switch (provider.toLowerCase()) {
        case 'openai': {
            // Regular OpenAI - strict compatibility, no baseURL
            return createOpenAI({ apiKey, compatibility: 'strict' })(model);
        }
        case 'openai-compatible': {
            // OpenAI-compatible - requires baseURL, uses compatible mode
            const baseURL = getOpenAICompatibleBaseURL(llmConfig);
            return createOpenAI({ apiKey, baseURL, compatibility: 'compatible' })(model);
        }
        case 'anthropic':
            return createAnthropic({ apiKey })(model);
        case 'google':
            return createGoogleGenerativeAI({ apiKey })(model);
        case 'groq':
            return createGroq({ apiKey })(model);
        case 'xai':
            return createXai({ apiKey })(model);
        case 'cohere':
            return createCohere({ apiKey })(model);
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
function getOpenAICompatibleBaseURL(llmConfig: ValidatedLLMConfig): string {
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
    config: ValidatedLLMConfig,
    mcpManager: MCPManager,
    sessionEventBus: SessionEventBus,
    contextManager: ContextManager,
    sessionId: string,
    pluginManager?: PluginManager
): VercelLLMService {
    const model = _createVercelModel(config);

    return new VercelLLMService(
        mcpManager,
        model,
        config.provider,
        sessionEventBus,
        contextManager,
        config.maxIterations,
        sessionId,
        config.temperature,
        config.maxOutputTokens,
        config.baseURL,
        pluginManager
    );
}

/**
 * Enum/type for LLM routing backend selection.
 */
export function createLLMService(
    config: ValidatedLLMConfig,
    router: LLMRouter,
    mcpManager: MCPManager,
    sessionEventBus: SessionEventBus,
    contextManager: ContextManager,
    sessionId: string,
    pluginManager?: PluginManager
): ILLMService {
    if (router === 'vercel') {
        return _createVercelLLMService(
            config,
            mcpManager,
            sessionEventBus,
            contextManager,
            sessionId,
            pluginManager
        );
    } else {
        return _createInBuiltLLMService(
            config,
            mcpManager,
            sessionEventBus,
            contextManager,
            sessionId,
            pluginManager
        );
    }
}
