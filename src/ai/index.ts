import { MCPConnectionManager } from '../client/manager.js';
import { runAiCli } from './cli.js';
import { AiCliOptions } from './types.js';
import dotenv from 'dotenv';
import { ServerConfigs } from '../server/config.js';
import { logger } from '../utils/logger.js';

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
  // Check for OpenAI API key
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    logger.error('Error: OPENAI_API_KEY not found in environment variables');
    logger.error('Please set your OpenAI API key in the .env file');
    process.exit(1);
  }

  logger.debug('Verified API key');
  logger.debug('Multi-server mode active');

  const connectionManager = new MCPConnectionManager(serverConfigs, connectionMode);
  await connectionManager.initialize();
  
  // Start AI CLI with multiple connections
  try {
    await runAiCli(connectionManager, apiKey, options);
  } catch (error) {
    logger.error(`Error running AI CLI: ${error.message}`);
    process.exit(1);
  }
}
