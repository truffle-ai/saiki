#!/usr/bin/env node
import { Command } from 'commander';
import { initializeAiCli } from './ai/index.js';
import { getServerConfig, configExists } from './server/config.js';

const program = new Command();

program.name('mcp-ai').description('AI-powered CLI for MCP servers').version('0.1.0');

program
  .command('connect')
  .description('Connect to an MCP server and start AI-powered CLI')
  .argument('<serverAlias>', 'Server alias from config')
  .argument('[args...]', 'Additional arguments to pass to the server')
  .option('-c, --config <path>', 'Path to config file')
  .option('-m, --model <model>', 'OpenAI model to use', 'gpt-4o-mini')
  .option('-v, --verbose', 'Show verbose output', false)
  .action(async (serverAlias, args, options) => {
    let command;
    let finalArgs = args;
    let env = undefined;

    try {
      if (await configExists(options.config)) {
        const serverConfig = await getServerConfig(serverAlias, options.config);
        if (serverConfig) {
          console.log(`Using server configuration for alias: ${serverAlias}`);
          command = serverConfig.command;
          finalArgs = serverConfig.args.concat(args);
          env = serverConfig.env;
        } else {
          console.error(`Error: Server alias "${serverAlias}" not found in configuration`);
          process.exit(1);
        }
      } else {
        console.error('Error: Configuration file not found');
        process.exit(1);
      }
    } catch (error) {
      console.error('Error: Failed to load server configuration');
      console.error(error);
      process.exit(1);
    }

    await initializeAiCli(command, finalArgs, options, env);
  });

program.parse();
