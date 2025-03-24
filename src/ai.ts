#!/usr/bin/env node
import { Command } from 'commander';
import { startAiCli } from './ai/index.js';

const program = new Command();

program
  .name('mcp-ai')
  .description('AI-powered CLI for MCP servers')
  .version('0.1.0');

program
  .command('connect')
  .description('Connect to an MCP server and start AI-powered CLI')
  .argument('<command>', 'Command to execute the server')
  .argument('[args...]', 'Arguments for the command')
  .option('-m, --model <model>', 'OpenAI model to use', 'gpt-4o-mini')
  .option('-v, --verbose', 'Show verbose output', false)
  .action(async (command, args, options) => {
    await startAiCli(command, args, options);
  });

program.parse();