import { ClientManager } from '../../client/manager.js';
import { LLMConfig as LLMServiceConfig, LLMService } from './types.js';
import { OpenAIService } from './openai.js';
import { AnthropicService } from './anthropic.js';
import { LLMConfig as ConfigLLMConfig } from '../../config/types.js';
import { logger } from '../../utils/logger.js';

/**
 * Extract and validate API key from config or environment variables
 * @param config LLM configuration from the config file
 * @returns Valid API key or throws an error
 */
function extractApiKey(config: ConfigLLMConfig): string {
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
    config: ConfigLLMConfig,
    clientManager: ClientManager
): LLMService {
    // Extract and validate API key
    const apiKey = extractApiKey(config);
    
    // Convert config to service-compatible format
    const serviceConfig: LLMServiceConfig = {
        provider: config.provider,
        apiKey,
        model: config.model,
        options: config.providerOptions
    };
    
    switch (config.provider.toLowerCase()) {
        case 'openai':
            return new OpenAIService(clientManager, serviceConfig.apiKey, serviceConfig.model, serviceConfig.options);
        case 'anthropic':
            return new AnthropicService(
                clientManager,
                serviceConfig.apiKey,
                serviceConfig.model,
                serviceConfig.options
            );
        default:
            throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
}
