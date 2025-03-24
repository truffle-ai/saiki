#!/usr/bin/env node
import { Command } from 'commander';
import { connectAndInteract } from './client/index.js';

const program = new Command();

program
  .name('mcp-client')
  .description('MCP client CLI tool')
  .version('0.1.0');

program
  .command('connect')
  .description('Connect to an MCP server and start interactive CLI')
  .argument('<command>', 'Command to execute the server')
  .argument('[args...]', 'Arguments for the command')
  .action(async (command, args) => {
    await connectAndInteract(command, args);
  });

program.parse();