import { ClientManager } from '../../client/manager.js';
import { ILLMService } from './types.js';
import { LLMConfig } from '../../config/types.js';
import { logger } from '../../utils/logger.js';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { VercelLLMService } from './service.js'; 
import { VercelLLM } from './types.js';
import { OpenAIService } from './openai.js';
import { AnthropicService } from './anthropic.js';
/**
 * Extract and validate API key from config or environment variables
 * @param config LLM configuration from the config file
 * @returns Valid API key or throws an error
 */
function extractApiKey(config: LLMConfig): string {
    const provider = config.provider;
    
    // Get API key from config or environment
    let apiKey = config.apiKey || '';
    if (apiKey.startsWith('env:')) {
        // If the API key is specified as an environment variable reference
        const envVarName = apiKey.substring(4);
        apiKey = process.env[envVarName] || '';
    } else {
        // Fall back to environment variables if not in config
        const apiKeyEnvVar = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
        apiKey = apiKey || process.env[apiKeyEnvVar] || '';
    }

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
export function createLLMService(
    config: LLMConfig,
    clientManager: ClientManager
): ILLMService {
    // Extract and validate API key
    const apiKey = extractApiKey(config);
    
    switch (config.provider.toLowerCase()) {
        case 'openai':
            return new OpenAIService(clientManager, apiKey, config.model, config.providerOptions);
        case 'anthropic':
            return new AnthropicService(
                clientManager,
                apiKey,
                config.model,
                config.providerOptions
            );
        default:
            throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
}

export function createVercelModel(provider: string, model: string): any {
    switch (provider.toLowerCase()) {
        case 'openai':
            return openai(model);
        case 'anthropic':
            return anthropic(model);
        default:
            throw new Error(`Unsupported LLM provider: ${provider}`);
    }
}

export function createVercelLLMService(
    config: LLMConfig,
    clientManager: ClientManager
): VercelLLMService {
    const model: VercelLLM = createVercelModel(config.provider, config.model);
    return new VercelLLMService(clientManager, model);
}
