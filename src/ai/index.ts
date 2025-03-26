import { McpConnection } from '../client/connection.js';
import { startAiCli as startAiInterface } from './cli.js';
import { AiCliOptions } from './types.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Start AI-powered CLI with a command to connect to an MCP server
 * @param command Command to execute the server
 * @param args Arguments for the command
 * @param options CLI options
 * @param env Environment variables for the server process
 */
export async function startAiCli(
  command: string,
  args: string[],
  options: AiCliOptions,
  env?: Record<string, string>
) {
  // Check for OpenAI API key
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY not found in environment variables');
    console.error('Please set your OpenAI API key in the .env file');
    process.exit(1);
  }

  // Verify API key format
  if (!apiKey.startsWith('sk-')) {
    console.error('Error: Invalid OpenAI API key format');
    console.error('OpenAI API keys should start with "sk-"');
    console.error('You appear to be using an Anthropic API key (starts with sk-proj-)');
    console.error('Please set a valid OpenAI API key in the .env file');
    process.exit(1);
  }

  console.log('[DEBUG] Verified API key');

  console.log('[DEBUG] Creating connection to MCP server');

  // Create connection to MCP server
  const connection = new McpConnection();

  try {
    // Connect to server
    await connection.connectViaStdio(command, args, env);

    // Start AI CLI
    await startAiInterface(connection, apiKey, options);
  } catch (error) {
    console.error('Error connecting to MCP server:', error.message);
    process.exit(1);
  }
}
