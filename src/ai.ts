#!/usr/bin/env node
import { Command } from 'commander';
import { startAiCli } from './ai/index.js';
import { getServerConfig, configExists } from './config.js';

const program = new Command();

program
  .name('mcp-ai')
  .description('AI-powered CLI for MCP servers')
  .version('0.1.0');

program
  .command('connect')
  .description('Connect to an MCP server and start AI-powered CLI')
  .argument('<serverAliasOrCommand>', 'Server alias from config or command to execute the server')
  .argument('[args...]', 'Arguments for the command (only used if first arg is a command)')
  .option('-c, --config <path>', 'Path to config file')
  .option('-m, --model <model>', 'OpenAI model to use', 'gpt-4o-mini')
  .option('-v, --verbose', 'Show verbose output', false)
  .action(async (serverAliasOrCommand, args, options) => {
    // Check if the input is a server alias
    let command = serverAliasOrCommand;
    let finalArgs = args;
    let env = undefined;
    
    try {
      if (await configExists(options.config)) {
        const serverConfig = await getServerConfig(serverAliasOrCommand, options.config);
        if (serverConfig) {
          console.log(`Using server configuration for alias: ${serverAliasOrCommand}`);
          command = serverConfig.command;
          finalArgs = serverConfig.args;
          env = serverConfig.env;
        }
      }
    } catch (error) {
      console.log('Could not load server configuration, using direct command');
    }
    
    await startAiCli(command, finalArgs, options, env);
  });

program.parse();