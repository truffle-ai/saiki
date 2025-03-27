#!/usr/bin/env node
import { existsSync } from 'fs';
import { Command } from 'commander';
import path from 'path';
import { logger } from './utils/logger.js';
import { initializeAiCli } from './ai/index.js';
import { getMultiServerConfig } from './server/config.js';

const program = new Command();

// Check if .env file exists
if (!existsSync('.env')) {
  logger.error('ERROR: .env file not found.');
  logger.info('Please create a .env file with your OpenAI API key.');
  logger.info('You can copy .env.example and fill in your API key.');
  logger.info('');
  logger.info('Example .env content:');
  logger.info('OPENAI_API_KEY=your_openai_api_key_here', null, 'green');
  process.exit(1);
}

// Setup command line options
program
  .name('mcp-cli')
  .description('AI-powered CLI for interacting with MCP servers')
  .option('-c, --config-file <path>', 'Path to server config file', 'configuration/mcp.json')
  .option('-s, --strict', 'Require all server connections to succeed')
  .option('-m, --model <model>', 'OpenAI model to use', 'gpt-4o-mini')
  .option('--no-verbose', 'Disable verbose output')
  .version('0.1.0');

program.parse();

// Get options
const options = program.opts();
const configFile = options.configFile;
const connectionMode = options.strict ? 'strict' : 'lenient' as 'strict' | 'lenient';
const verbose = options.verbose !== false;

// Platform-independent path handling
const normalizedConfigPath = path.normalize(configFile);

logger.info(`Starting AI-powered MCP client with config file: ${normalizedConfigPath}`, null, 'blue');

// Display examples
logger.info('');
logger.info('This client uses LLM models to interpret your commands and call appropriate MCP tools.', null, 'cyanBright');
logger.info('You can interact with tools using natural language.');
logger.info('');
logger.info('Examples:', null, 'yellow');
logger.info('- "List all files in the current directory"');
logger.info('- "Show system information"');
logger.info('- "Create a new file called test.txt with \'Hello World\' as content"');
logger.info('- "Run a simple python script that prints numbers from 1 to 10"');
logger.info('');

// Start the AI client directly
async function startAiClient() {
  try {
    const serverConfigs = await getMultiServerConfig(normalizedConfigPath);
    if (Object.keys(serverConfigs).length === 0) {
      logger.error('Error: No server configurations found in the provided file');
      process.exit(1);
    }
    
    logger.info(`Found ${Object.keys(serverConfigs).length} server configurations in ${normalizedConfigPath}`, null, 'green');
    logger.info('===============================================');
    logger.info('Starting AI-powered MCP client...', null, 'cyanBright');
    logger.info('===============================================\n');
    
    // Convert CLI options to the format expected by initializeAiCli
    const aiOptions = {
      configFile: normalizedConfigPath,
      model: options.model,
      verbose: verbose
    };
    
    await initializeAiCli(aiOptions, serverConfigs, connectionMode);
  } catch (error) {
    logger.error('Error: Failed to load server configurations from file');
    logger.error(error);
    process.exit(1);
  }
}

// Execute the client
startAiClient().catch(error => {
  logger.error('Unhandled error:');
  logger.error(error);
  process.exit(1);
}); 