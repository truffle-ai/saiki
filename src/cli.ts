#!/usr/bin/env node
import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { Command } from 'commander';
import path from 'path';
import { logger } from './utils/logger.js';

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
  .option('--no-verbose', 'Disable verbose output')
  .version('0.1.0');

program.parse();

// Get options
const options = program.opts();
const configFile = options.configFile;
const connectionMode = options.strict ? 'strict' : 'lenient';
const verbose = options.verbose !== false ? '-v' : '';

// Always build the project
logger.info('Building the project...', null, 'yellow');
const buildResult = spawnSync('npm', ['run', 'build'], { 
  stdio: 'inherit',
  shell: true // Required for Windows compatibility
});

if (buildResult.status !== 0) {
  logger.error('Error: Failed to build the project.');
  process.exit(1);
}

logger.info('Project built successfully.', null, 'green');
logger.info('');

// Platform-independent path handling
const normalizedConfigPath = path.normalize(configFile);

logger.info(`Starting AI-powered MCP client with config file: ${normalizedConfigPath}`, null, 'blue');

// Display examples
logger.info('');
logger.info('This client uses OpenAI to interpret your commands and call appropriate MCP tools.', null, 'cyanBright');
logger.info('You can interact with tools using natural language.');
logger.info('');
logger.info('Examples:', null, 'yellow');
logger.info('- "List all files in the current directory"');
logger.info('- "Show system information"');
logger.info('- "Create a new file called test.txt with \'Hello World\' as content"');
logger.info('- "Run a simple python script that prints numbers from 1 to 10"');
logger.info('');

// Start the AI client
const aiProcess = spawnSync('node', [
  'dist/ai.js', 
  'connect', 
  '--config-file', normalizedConfigPath,
  '--connection-mode', connectionMode,
  ...(verbose ? [verbose] : [])
], {
  stdio: 'inherit',
  shell: true // Required for Windows compatibility
});

// Pass the exit code from the AI client
process.exit(aiProcess.status || 0); 