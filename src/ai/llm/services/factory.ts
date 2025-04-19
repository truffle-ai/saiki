import { ClientManager } from '../../../client/manager.js';
import { ILLMService } from './types.js';
import { LLMConfig, AgentConfig } from '../../../config/types.js';
import { logger } from '../../../utils/logger.js';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { VercelLLMService } from './vercel.js';
import { OpenAIService } from './openai.js';
import { AnthropicService } from './anthropic.js';
import { LanguageModelV1 } from 'ai';

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
 * Create an LLM service instance based on the provided configuration
 */
function _createLLMService(agentConfig: AgentConfig, clientManager: ClientManager): ILLMService {
    // Extract and validate API key
    const apiKey = extractApiKey(agentConfig.llm);
    switch (agentConfig.llm.provider.toLowerCase()) {
        case 'openai':
            return new OpenAIService(agentConfig, clientManager, apiKey, agentConfig.llm.model);
        case 'anthropic':
            return new AnthropicService(agentConfig, clientManager, apiKey, agentConfig.llm.model);
        default:
            throw new Error(`Unsupported LLM provider: ${agentConfig.llm.provider}`);
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
    agentConfig: AgentConfig,
    clientManager: ClientManager
): VercelLLMService {
    const model: LanguageModelV1 = _createVercelModel(agentConfig.llm.provider, agentConfig.llm.model);
    return new VercelLLMService(agentConfig, clientManager, model);
}

export function createLLMService(
    agentConfig: AgentConfig,
    clientManager: ClientManager,
    vercel: boolean = false
): ILLMService {
    if (vercel) {
        return _createVercelLLMService(agentConfig, clientManager);
    } else {
        return _createLLMService(agentConfig, clientManager);
    }
}
