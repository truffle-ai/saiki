#!/usr/bin/env node
import { existsSync } from 'fs';
import { Command } from 'commander';
import dotenv from 'dotenv';
import {
    logger,
    DEFAULT_CONFIG_PATH,
    resolvePackagePath,
    getProviderFromModel,
    getAllSupportedModels,
    SaikiAgent,
} from '@core/index.js';
import { startAiCli, startHeadlessCli } from './cli/cli.js';
import { getPort } from '@core/utils/port-utils.js';
import { startApiServer } from './api/server.js';
import { startDiscordBot } from './discord/bot.js';
import { startTelegramBot } from './telegram/bot.js';
import { validateCliOptions, handleCliOptionsError } from './utils/options.js';
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import { loadConfigFile } from '@core/index.js';
// Load environment variables
dotenv.config();

// Explicitly set the log level from environment
if (process.env.LOG_LEVEL) {
    logger.setLevel(process.env.LOG_LEVEL);
}

const program = new Command();

// Check if .env file exists
if (!existsSync('.env')) {
    logger.debug('WARNING: .env file not found.');
    logger.debug('If you are running locally, please create a .env file with your API key(s).');
    logger.debug('You can copy .env.example and fill in your API key(s).');
    logger.debug('Alternatively, ensure the required environment variables are set.');
    logger.debug('');
    logger.debug('Example .env content:');
    logger.debug('OPENAI_API_KEY=your_openai_api_key_here', null, 'green');
    logger.debug('GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here', null, 'green');
    logger.debug('ANTHROPIC_API_KEY=your_anthropic_api_key_here', null, 'green');
}

// Check for at least one required API key
if (
    !process.env.OPENAI_API_KEY &&
    !process.env.GOOGLE_GENERATIVE_AI_API_KEY &&
    !process.env.ANTHROPIC_API_KEY
) {
    logger.error(
        'ERROR: No API key found. Please set at least one of OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or ANTHROPIC_API_KEY in your environment or .env file.'
    );
    process.exit(1);
}

// Setup command line options
program
    .name('saiki')
    .description('AI-powered CLI and WebUI for interacting with MCP servers')
    .argument('[prompt...]', 'Optional headless prompt for single command mode')
    // General Options
    .option('-c, --config-file <path>', 'Path to config file', DEFAULT_CONFIG_PATH)
    .option('-s, --strict', 'Require all server connections to succeed')
    .option('--no-verbose', 'Disable verbose output')
    .option('--mode <mode>', 'Run mode: cli, web, discord, or telegram', 'cli')
    .option('--web-port <port>', 'Port for WebUI', '3000')
    // LLM Options
    .option('-m, --model <model>', 'Specify the LLM model to use')
    .option('-r, --router <router>', 'Specify the LLM router to use (vercel or in-built)')
    .version('0.2.0');

program.parse();
const headlessInput = program.args.length > 0 ? program.args.join(' ') : undefined;

// Get options
const options = program.opts();
// Dynamically infer provider and api key from the supplied model
if (options.model) {
    let modelProvider: string;
    try {
        modelProvider = getProviderFromModel(options.model);
    } catch (err) {
        // Model inference failed
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`ERROR: ${msg}`);
        logger.error(`Supported models are:\n${getAllSupportedModels().join(', ')}`);
        process.exit(1);
    }
    options.provider = modelProvider;

    // Dynamically extract the actual API key for the provider
    const providerEnvMap: Record<string, string> = {
        openai: 'OPENAI_API_KEY',
        anthropic: 'ANTHROPIC_API_KEY',
        google: 'GOOGLE_GENERATIVE_AI_API_KEY',
    };
    const envVarName = providerEnvMap[modelProvider];
    if (envVarName) {
        const key = process.env[envVarName];
        if (!key) {
            logger.error(
                `ERROR: Missing ${envVarName} environment variable for provider '${modelProvider}'.`
            );
            process.exit(1);
        }
        options.apiKey = key;
    }
}

const configFile = options.configFile;
const connectionMode = options.strict ? 'strict' : ('lenient' as 'strict' | 'lenient');
const runMode = options.mode.toLowerCase();
const webPort = parseInt(options.webPort, 10);
const resolveFromPackageRoot = configFile === DEFAULT_CONFIG_PATH; // Check if should resolve from package root
// Platform-independent path handling
const normalizedConfigPath = resolvePackagePath(configFile, resolveFromPackageRoot);

// basic validation of options here
try {
    validateCliOptions(options);
} catch (error) {
    handleCliOptionsError(error);
}

logger.info(`Initializing Saiki with config: ${normalizedConfigPath}`, null, 'blue');

// Conditionally display CLI examples
if (runMode === 'cli') {
    logger.info('');
    logger.info("Running in CLI mode. Use natural language or type 'exit' to quit.", 'cyanBright');
    logger.info('Examples:', 'yellow');
    logger.info('- "List all files in the current directory"');
    logger.info('- "Show system information"');
    logger.info('- "Create a new file called test.txt with \'Hello World\' as content"');
    logger.info('- "Run a simple python script that prints numbers from 1 to 10"');
    logger.info('');
}

// Main start function
async function startApp() {
    const cliArgs = {
        model: options.model,
        provider: options.provider,
        router: options.router,
        apiKey: options.apiKey,
    };
    let agent: SaikiAgent;
    try {
        const config = await loadConfigFile(normalizedConfigPath);
        agent = await SaikiAgent.create(config, cliArgs, {
            connectionMode,
            runMode: runMode,
        });
    } catch (err) {
        if (err instanceof Error) {
            err.message.split('\n').forEach((line) => logger.error(line));
        } else {
            logger.error('Unexpected error during startup:', err);
        }
        process.exit(1);
    }

    logger.info('===============================================');
    logger.info(`Initializing Saiki in '${runMode}' mode...`, null, 'cyanBright');
    logger.info('===============================================\n');

    // Start based on mode
    // TODO: We ideally should be able to start all services with one or more interfaces at once. Single backend, multiple frontend interfaces.
    if (runMode === 'cli') {
        if (headlessInput) {
            await startHeadlessCli(agent, headlessInput);
            process.exit(0);
        } else {
            // Run CLI
            await startAiCli(agent);
        }
    } else if (runMode === 'web') {
        // Run WebUI with configured MCP identity (pass agentCard only)
        const agentCard = agent.configManager.getConfig().agentCard ?? {};
        const frontPort = getPort(process.env.FRONTEND_PORT, webPort, 'FRONTEND_PORT');
        const apiPort = getPort(process.env.API_PORT, webPort + 1, 'API_PORT');
        const nextCwd = path.resolve(process.cwd(), 'src', 'app', 'webui');
        // Derive standardized URLs from env or defaults
        const frontUrl = process.env.FRONTEND_URL ?? `http://localhost:${frontPort}`;
        const apiUrl = process.env.API_URL ?? `http://localhost:${apiPort}`;

        logger.info(`Starting Next.js dev server on ${frontUrl}`, null, 'cyanBright');
        const nextProc = spawn('npm', ['run', 'dev', '--', '--port', String(frontPort)], {
            cwd: nextCwd,
            shell: true,
            stdio: 'inherit',
            env: {
                ...process.env,
                NODE_ENV: 'development',
                API_PORT: String(apiPort),
                API_URL: apiUrl,
                FRONTEND_URL: frontUrl,
                NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? apiUrl,
                NEXT_PUBLIC_WS_URL:
                    process.env.NEXT_PUBLIC_WS_URL ??
                    (() => {
                        const interfaces = os.networkInterfaces();
                        for (const list of Object.values(interfaces)) {
                            for (const iface of list ?? []) {
                                if (iface.family === 'IPv4' && !iface.internal) {
                                    return `ws://${iface.address}:${apiPort}`;
                                }
                            }
                        }
                        return `ws://localhost:${apiPort}`;
                    })(),
                NEXT_PUBLIC_FRONTEND_URL: process.env.NEXT_PUBLIC_FRONTEND_URL ?? frontUrl,
            },
        });
        nextProc.on('error', (err) => {
            logger.error('Failed to start Next.js process:', err);
        });
        nextProc.on('exit', (code, signal) => {
            logger.info(`Next.js process exited with code ${code} and signal ${signal}`);
        });
        // Start Express API server (for WebSocket and HTTP endpoints)
        await startApiServer(agent, apiPort, agentCard);
        logger.info(`API endpoints available at ${apiUrl}`, null, 'magenta');
        logger.info(`Frontend available at ${frontUrl}`, null, 'magenta');
    } else if (runMode === 'discord') {
        logger.info('Starting Discord bot...', null, 'cyanBright');
        try {
            startDiscordBot(agent);
        } catch (error) {
            logger.error('Failed to start Discord bot:', error);
            process.exit(1);
        }
    } else if (runMode === 'telegram') {
        logger.info('Starting Telegram bot...', null, 'cyanBright');
        try {
            startTelegramBot(agent);
        } catch (error) {
            logger.error('Failed to start Telegram bot:', error);
            process.exit(1);
        }
    }
}

// Execute the agent
startApp().catch((error) => {
    logger.error('Unhandled error during agent startup:');
    logger.error(error);
    process.exit(1);
});
