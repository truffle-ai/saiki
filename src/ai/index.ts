import { AiCliOptions } from './types.js';
import { logger } from '../utils/logger.js';
import { MCPClientManager } from '../client/manager.js';
import { AgentConfig } from '../server/config.js';
import { runAiCli } from './cli.js';
import { createLLMService } from './llm/factory.js';
import { LLMConfig } from './llm/types.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Start AI-powered CLI with unified configuration
 * @param options CLI options
 * @param config Agent configuration including MCP servers and LLM settings
 * @param connectionMode Whether to enforce all connections must succeed ("strict") or allow partial success ("lenient")
 */
export async function initializeAiCli(
  options: AiCliOptions = {},
  config: AgentConfig,
  connectionMode: 'strict' | 'lenient' = 'lenient'
) {
  // Extract LLM config with default values
  const llmConfig: LLMConfig = {
    provider: config.llm?.provider || 'openai',
    model: config.llm?.model || 'gpt-4o-mini',
    apiKey: config.llm?.apiKey || '',
    options: config.llm?.providerOptions
  };
  
  // Get provider from config
  const provider = llmConfig.provider;
  
  // Get API key from config or environment
  let apiKey = llmConfig.apiKey;
  if (apiKey?.startsWith('env:')) {
    // If the API key is specified as an environment variable reference
    const envVarName = apiKey.substring(4);
    apiKey = process.env[envVarName];
  } else {
    // Fall back to environment variables if not in config
    const apiKeyEnvVar = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
    apiKey = apiKey || process.env[apiKeyEnvVar];
  }

  if (!apiKey) {
    logger.error(`Error: API key for ${provider} not found`);
    logger.error(`Please set your ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key in the config file or .env file`);
    process.exit(1);
  }

  logger.debug('Verified API key');

  // Initialize client manager with server configs from unified config
  const mcpClientManager = new MCPClientManager(config.mcpServers, connectionMode);
  await mcpClientManager.initialize();

  logger.debug('MCP servers initialized');
  
  // Create LLM service using config from unified config
  const llmServiceConfig: LLMConfig = {
    provider,
    apiKey,
    model: llmConfig.model,
    options: llmConfig.options
  };
  
  const llmService = createLLMService(llmServiceConfig, mcpClientManager);

  logger.debug('LLM service created');
  
  // Run AI CLI
  try {
    await runAiCli(mcpClientManager, llmService, options);
  } catch (error) {
    logger.error(`Error running AI CLI: ${error.message}`);
    process.exit(1);
  }
}
