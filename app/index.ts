#!/usr/bin/env node
import { existsSync } from 'fs';
import { Command } from 'commander';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../src/utils/logger.js';
import { loadConfigFile } from '../src/config/loader.js';
import { AgentConfig } from '../src/config/types.js';
import { initializeServices } from '../src/utils/service-initializer.js';
import { runAiCli } from './cli/cli.js';
import { initializeWebUI } from './web/server.js';

// Load environment variables
dotenv.config();

// Explicitly set the log level from environment
if (process.env.LOG_LEVEL) {
    logger.setLevel(process.env.LOG_LEVEL);
}

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
    .description('AI-powered CLI and WebUI for interacting with MCP servers')
    .option('-c, --config-file <path>', 'Path to config file', 'configuration/saiki.yml')
    .option('-s, --strict', 'Require all server connections to succeed')
    .option('--no-verbose', 'Disable verbose output')
    .option('--mode <mode>', 'Run mode: cli or web', 'cli')
    .option('--web-port <port>', 'Port for WebUI', '3000')
    .version('0.2.0');

program.parse();

// Get options
const options = program.opts();
const configFile = options.configFile;
const connectionMode = options.strict ? 'strict' : ('lenient' as 'strict' | 'lenient');
const runMode = options.mode.toLowerCase();
const webPort = parseInt(options.webPort, 10);

// Validate run mode
if (!['cli', 'web'].includes(runMode)) {
    logger.error(`Invalid mode: ${runMode}. Must be 'cli' or 'web'.`);
    process.exit(1);
}

// Validate web port
if (isNaN(webPort) || webPort <= 0 || webPort > 65535) {
    logger.error(`Invalid web port: ${options.webPort}. Must be a number between 1 and 65535.`);
    process.exit(1);
}

// Platform-independent path handling
const normalizedConfigPath = path.normalize(configFile);

logger.info(
    `Initializing Saiki with config: ${normalizedConfigPath}`,
    null,
    'blue'
);

// Conditionally display CLI examples
if (runMode === 'cli') {
    logger.info('');
    logger.info(
        'Running in CLI mode. Use natural language or type \'exit\' to quit.',
        'cyanBright'
    );
    logger.info('Examples:', 'yellow');
    logger.info('- "List all files in the current directory"');
    logger.info('- "Show system information"');
    logger.info('- "Create a new file called test.txt with \'Hello World\' as content"');
    logger.info('- "Run a simple python script that prints numbers from 1 to 10"');
    logger.info('');
}

// Main start function
async function startAgent() {
    try {
        // Load the agent configuration
        const config: AgentConfig = await loadConfigFile(normalizedConfigPath);
        validateAgentConfig(config);

        logger.info('===============================================');
        logger.info(`Initializing Saiki in '${runMode}' mode...`, null, 'cyanBright');
        logger.info('===============================================\n');

        // Use the shared initializer
        const { clientManager, llmService } = await initializeServices(config, connectionMode);

        // Start based on mode
        if (runMode === 'cli') {
            // Run CLI
            await runAiCli(clientManager, llmService);
        } else if (runMode === 'web') {
            // Run WebUI
            initializeWebUI(clientManager, llmService, webPort);
            logger.info(`WebUI available at http://localhost:${webPort}`, null, 'magenta');
            // Note: Web server runs indefinitely, no need to await here unless
            // you specifically want the script to only exit when the server does.
        }

    } catch (error) {
        logger.error(
            `Error: Failed to initialize AI CLI from config file ${normalizedConfigPath}: ${
                error instanceof Error
                    ? `${error.message}\n${error.stack}`
                    : JSON.stringify(error, null, 2)
            }`
        );
        process.exit(1);
    }
}

// Execute the agent
startAgent().catch((error) => {
    logger.error('Unhandled error during agent startup:');
    logger.error(error);
    process.exit(1);
});

function validateAgentConfig(config: AgentConfig): void {
    logger.info('Validating agent config', 'cyanBright');
    if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
        throw new Error('No MCP server configurations provided in config file.');
    }

    // Validate LLM section exists, use defaults if not
    if (!config.llm) {
        logger.info('No LLM configuration found, applying defaults', 'yellow');
        config.llm = {
            provider: 'openai',
            model: 'gpt-4o-mini',
            systemPrompt: 'You are Saiki, a helpful AI assistant with access to tools. Use these tools when appropriate to answer user queries. You can use multiple tools in sequence to solve complex problems. After each tool result, determine if you need more information or can provide a final answer.',
            apiKey: '$OPENAI_API_KEY',
        };
    } else {
        // Ensure required LLM fields are present if section exists
        if (!config.llm.provider || !config.llm.model) {
            throw new Error('LLM configuration must specify provider and model');
        }
        // Provide default system prompt if missing
        if (!config.llm.systemPrompt) {
            logger.info('No system prompt found, using default', 'yellow');
            config.llm.systemPrompt = 'You are Saiki, a helpful AI assistant with access to tools. Use these tools when appropriate to answer user queries. You can use multiple tools in sequence to solve complex problems. After each tool result, determine if you need more information or can provide a final answer.';
        }
    }

    logger.info(
        `Found ${Object.keys(config.mcpServers).length} server configurations. Validation successful.`,
        'green'
    );
}
