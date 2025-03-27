import { AiCliOptions } from './types.js';
import { logger } from '../utils/logger.js';
import { MCPClientManager } from '../client/manager.js';
import { ServerConfigs } from '../server/config.js';
import { runAiCli } from './cli.js';
import { createLLMService } from './llm/factory.js';
import { LLMConfig } from './llm/types.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Start AI-powered CLI with multiple MCP server connections
 * @param options CLI options
 * @param serverConfigs Dictionary of server configurations
 * @param connectionMode Whether to enforce all connections must succeed ("strict") or allow partial success ("lenient")
 */
export async function initializeAiCli(
  options: AiCliOptions = {},
  serverConfigs: ServerConfigs,
  connectionMode: 'strict' | 'lenient' = 'lenient'
) {
  // Get provider from options or default to OpenAI
  const provider = options.provider || 'openai';
  
  // Check for appropriate API key
  const apiKeyEnvVar = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
  const apiKey = process.env[apiKeyEnvVar];

  if (!apiKey) {
    logger.error(`Error: ${apiKeyEnvVar} not found in environment variables`);
    logger.error(`Please set your ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key in the .env file`);
    process.exit(1);
  }

  logger.debug('Verified API key');

  // Initialize client manager
  const mcpClientManager = new MCPClientManager(serverConfigs, connectionMode);
  await mcpClientManager.initialize();

  logger.debug('MCP servers initialized');
  
  // Create LLM service
  const llmConfig: LLMConfig = {
    provider,
    apiKey,
    model: options.model,
    options: options.providerOptions
  };
  
  const llmService = createLLMService(llmConfig, mcpClientManager);

  logger.debug('LLM service created');
  
  // Run AI CLI
  try {
    await runAiCli(mcpClientManager, llmService, options);
  } catch (error) {
    logger.error(`Error running AI CLI: ${error.message}`);
    process.exit(1);
  }
}
