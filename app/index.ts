#!/usr/bin/env node
import { existsSync } from 'fs';
import { Command } from 'commander';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../src/utils/logger.js';
import { initializeAiCli } from './cli.js';
import { loadConfigFile } from '../src/config/loader.js';
import { AgentConfig } from '../src/config/types.js';
// Load environment variables
dotenv.config();

// Explicitly set the log level from environment
if (process.env.LOG_LEVEL) {
    logger.setLevel(process.env.LOG_LEVEL);
}
logger.info(`Logger level set to: ${logger.getLevel()}`);

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
    .name('saiki')
    .description('AI-powered CLI for interacting with MCP servers')
    .option('-c, --config-file <path>', 'Path to config file', 'configuration/saiki.yml')
    .option('-s, --strict', 'Require all server connections to succeed')
    .option('--no-verbose', 'Disable verbose output')
    .version('0.1.0');

program.parse();

// Get options
const options = program.opts();
const configFile = options.configFile;
const connectionMode = options.strict ? 'strict' : ('lenient' as 'strict' | 'lenient');

// Platform-independent path handling
const normalizedConfigPath = path.normalize(configFile);

logger.info(
    `Starting AI-powered MCP client with config file: ${normalizedConfigPath}`,
    null,
    'blue'
);

// Display examples
logger.info('');
logger.info(
    'This client uses LLM models to interpret your commands and call appropriate MCP tools.',
    null,
    'cyanBright'
);
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
        // Load the agent configuration
        const config: AgentConfig = await loadConfigFile(normalizedConfigPath);

        validateAgentConfig(config);

        logger.info('===============================================');
        logger.info('Starting AI-powered MCP client...', null, 'cyanBright');
        logger.info('===============================================\n');

        await initializeAiCli(config, connectionMode);
    } catch (error) {
        logger.error(
            `Error: Failed to initialize AI CLI from config file ${normalizedConfigPath}: ${JSON.stringify(
                error,
                null,
                2
            )}`
        );
        process.exit(1);
    }
}

// Execute the client
startAiClient().catch((error) => {
    logger.error('Unhandled error:');
    logger.error(error);
    process.exit(1);
});

function validateAgentConfig(config: AgentConfig): void {
    logger.info('Validating agent config', null, 'cyanBright');
    if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
        throw new Error('No MCP server configurations provided');
    }

    // Validate LLM section exists, use defaults if not
    if (!config.llm) {
        logger.info('No LLM configuration found, using defaults', null, 'yellow');
        config.llm = {
            provider: 'openai',
            model: 'gpt-4o-mini',
            apiKey: 'env:OPENAI_API_KEY',
        };
    }

    if (!config.llm.provider || !config.llm.model) {
        throw new Error('LLM configuration must specify provider and model');
    }

    logger.info(
        `Found ${Object.keys(config.mcpServers).length} server configurations`,
        null,
        'green'
    );
}
