#!/usr/bin/env node
import { Command } from 'commander';
import { startStdioHost } from './server/index.js';

const program = new Command();

program
  .name('mcp-host')
  .description('Start an MCP host server')
  .version('0.1.0');

program
  .command('stdio')
  .description('Start an MCP host with stdio transport')
  .action(async () => {
    console.log('Starting MCP host with stdio transport...');
    await startStdioHost();
  });

program.parse();