import { MCPClientManager } from '../../client/manager.js';
import { LLMConfig, ILLMService } from './types.js';
import { VercelLLMService } from './service.js';
import { OpenAIService } from './openai.js';
import { AnthropicService } from './anthropic.js';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { VercelLLM } from './types.js';
/**
 * Create an LLM service instance based on the provided configuration
 */
export function createLLMService(
    config: LLMConfig,
    mcpClientManager: MCPClientManager
): ILLMService {
    switch (config.provider.toLowerCase()) {
        case 'openai':
            return new OpenAIService(mcpClientManager, config.apiKey, config.model, config.options);
        case 'anthropic':
            return new AnthropicService(
                mcpClientManager,
                config.apiKey,
                config.model,
                config.options
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
    mcpClientManager: MCPClientManager
): VercelLLMService {
    const model: VercelLLM = createVercelModel(config.provider, config.model);
    return new VercelLLMService(mcpClientManager, model);
}
