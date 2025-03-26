#!/usr/bin/env node
import { Command } from 'commander';
import { initializeAiCli } from './ai/index.js';
import { getMultiServerConfig } from './server/config.js';
import { logger } from './utils/logger.js';

const program = new Command();

program.name('mcp-ai').description('AI-powered CLI for MCP servers').version('0.1.0');

program
  .command('connect')
  .description('Connect to multiple MCP servers and start AI-powered CLI')
  .requiredOption('-c, --config-file <path>', 'Path to config file with server definitions')
  .option('--connection-mode <mode>', 'Connection mode: "strict" or "lenient"', 'lenient')
  .option('-m, --model <model>', 'OpenAI model to use', 'gpt-4o-mini')
  .option('-v, --verbose', 'Show verbose output', false)
  .action(async (options) => {
    try {
      const serverConfigs = await getMultiServerConfig(options.configFile);
      if (Object.keys(serverConfigs).length === 0) {
        logger.error('Error: No server configurations found in the provided file');
        process.exit(1);
      }
      
      logger.info(`Found ${Object.keys(serverConfigs).length} server configurations in ${options.configFile}`, null, 'green');
      logger.info('===============================================');
      logger.info('Starting AI-powered MCP client...', null, 'cyanBright');
      logger.info('===============================================\n');
      await initializeAiCli(options, serverConfigs, options.connectionMode);
    } catch (error) {
      logger.error('Error: Failed to load server configurations from file');
      logger.error(error);
      process.exit(1);
    }
  });

program.parse();
