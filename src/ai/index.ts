import { MCPConnectionManager } from '../client/manager.js';
import { runAiCli } from './cli.js';
import { AiCliOptions } from './types.js';
import dotenv from 'dotenv';
import { ServerConfigs } from '../server/config.js';
import chalk from 'chalk';

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
    console.error(chalk.red('Error: OPENAI_API_KEY not found in environment variables'));
    console.error(chalk.red('Please set your OpenAI API key in the .env file'));
    process.exit(1);
  }

  // Verify API key format
  if (!apiKey.startsWith('sk-')) {
    console.error(chalk.red('Error: Invalid OpenAI API key format'));
    console.error(chalk.red('OpenAI API keys should start with "sk-"'));
    console.error(chalk.red('You appear to be using an Anthropic API key (starts with sk-proj-)'));
    console.error(chalk.red('Please set a valid OpenAI API key in the .env file'));
    process.exit(1);
  }

  console.log(chalk.dim('[DEBUG] Verified API key'));
  console.log(chalk.dim('[DEBUG] Multi-server mode active'));

  const connectionManager = new MCPConnectionManager(serverConfigs, connectionMode);
  await connectionManager.initialize();
  
  // Start AI CLI with multiple connections
  try {
    await runAiCli(connectionManager, apiKey, options);
  } catch (error) {
    console.error(chalk.red(`Error running AI CLI: ${error.message}`));
    process.exit(1);
  }
}
