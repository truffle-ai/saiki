import { MCPClientManager } from '../../client/manager.js';
import { LLMConfig, LLMService } from './types.js';
import { OpenAIService } from './openai.js';
import { AnthropicService } from './anthropic.js';

/**
 * Create an LLM service instance based on the provided configuration
 */
export function createLLMService(
  config: LLMConfig,
  mcpClientManager: MCPClientManager
): LLMService {
  switch (config.provider.toLowerCase()) {
    case 'openai':
      return new OpenAIService(mcpClientManager, config.apiKey, config.model, config.options);
    case 'anthropic':
      return new AnthropicService(mcpClientManager, config.apiKey, config.model, config.options);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}
