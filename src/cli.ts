#!/usr/bin/env node
import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';

const program = new Command();

// Display header
console.log(chalk.cyan.bold('AI-Powered MCP Client'));
console.log(chalk.cyan.bold('===================='));
console.log();

// Check if .env file exists
if (!existsSync('.env')) {
  console.error(chalk.red('ERROR: .env file not found.'));
  console.log('Please create a .env file with your OpenAI API key.');
  console.log('You can copy .env.example and fill in your API key.');
  console.log();
  console.log('Example .env content:');
  console.log(chalk.green('OPENAI_API_KEY=your_openai_api_key_here'));
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
console.log('Building the project...');
const buildResult = spawnSync('npm', ['run', 'build'], { 
  stdio: 'inherit',
  shell: true // Required for Windows compatibility
});

if (buildResult.status !== 0) {
  console.error(chalk.red('Error: Failed to build the project.'));
  process.exit(1);
}

console.log(chalk.green('Project built successfully.'));
console.log();

// Platform-independent path handling
const normalizedConfigPath = path.normalize(configFile);

console.log(`Starting AI-powered MCP client with config file: ${normalizedConfigPath}`);

// Display examples
console.log();
console.log('This client uses OpenAI to interpret your commands and call appropriate MCP tools.');
console.log('You can interact with tools using natural language.');
console.log();
console.log('Examples:');
console.log('- "List all files in the current directory"');
console.log('- "Show system information"');
console.log('- "Create a new file called test.txt with \'Hello World\' as content"');
console.log('- "Run a simple python script that prints numbers from 1 to 10"');
console.log();

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