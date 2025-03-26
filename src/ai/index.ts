import { McpConnection } from '../client/connection.js';
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
  
  const connections: McpConnection[] = [];
  const connectionErrors: { [key: string]: string } = {};
  const successfulServers: string[] = [];
  
  // Try to connect to each server
  for (const [alias, config] of Object.entries(serverConfigs)) {
    console.log(chalk.dim(`[DEBUG] Creating connection to MCP server: ${alias}`));
    try {
      const connection = new McpConnection();
      await connection.connectViaStdio(config.command, config.args || [], config.env, alias);
      connections.push(connection);
      successfulServers.push(alias);
      console.log(chalk.green(`[SUCCESS] Connected to server: ${alias}`));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      connectionErrors[alias] = errorMessage;
      console.error(chalk.red(`[ERROR] Failed to connect to server "${alias}": ${errorMessage}`));
    }
  }
  
  // Check if we have any successful connections
  if (connections.length === 0) {
    console.error(chalk.red('Error: Failed to connect to any MCP servers'));
    process.exit(1);
  }
  
  // Handle connection mode
  if (connectionMode === 'strict' && Object.keys(connectionErrors).length > 0) {
    console.error(chalk.red('Error: Some server connections failed in strict mode'));
    console.error(chalk.red('Failed connections:'), connectionErrors);
    process.exit(1);
  }
  
  // Display connection summary
  console.log(chalk.green(`[INFO] Successfully connected to ${connections.length} servers: ${successfulServers.join(', ')}`));
  if (Object.keys(connectionErrors).length > 0) {
    console.error(chalk.red(`[WARN] Failed to connect to ${Object.keys(connectionErrors).length} servers: ${Object.keys(connectionErrors).join(', ')}`));
  }
  
  // Start AI CLI with multiple connections
  try {
    await runAiCli(connections, apiKey, options);
  } catch (error) {
    console.error(chalk.red(`Error running AI CLI: ${error.message}`));
    process.exit(1);
  }
}
