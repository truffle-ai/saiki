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
import { handleCreateProject } from './cli/commands/create.js';

// Load environment variables
dotenv.config();

// Determine if the invocation is the 'create' subcommand
const invokedSubcommand = process.argv[2];
// Skip API key enforcement for 'create' subcommand
if (invokedSubcommand !== 'create' && invokedSubcommand !== 'new') {
    // Explicitly set the log level from environment
    if (process.env.SAIKI_LOG_LEVEL) {
        logger.setLevel(process.env.SAIKI_LOG_LEVEL);
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
} else {
    // Skip API key check for create/new command
    logger.debug(`Skipping API key check for subcommand '${invokedSubcommand}'`);
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

// Setup command line options
program
    .name('saiki')
    .description('AI-powered CLI and WebUI for interacting with MCP servers')
    .option('-c, --config-file <path>', 'Path to config file', DEFAULT_CONFIG_PATH)
    .option('-s, --strict', 'Require all server connections to succeed')
    .option('--no-verbose', 'Disable verbose output')
    .option('--mode <mode>', 'Run mode: cli, web, discord, or telegram', 'cli')
    .option('--web-port <port>', 'Port for WebUI', '3000')
    .option('-m, --model <model>', 'Specify the LLM model to use')
    .option('-r, --router <router>', 'Specify the LLM router to use (vercel or in-built)')
    .version('0.2.3');

// Define the 'create' command
program
    .command('create')
    .alias('new')
    .description('Scaffold a new Saiki Node.js project')
    .action(async (options, command) => {
        try {
            await handleCreateProject();
            process.exit(0);
        } catch (error) {
            process.exit(1);
        }
    });

// Potentially re-evaluate how [prompt...] is handled.
// Commander allows for actions if no subcommand is matched.
// For now, we'll parse and then check program.args for headless input if 'create' wasn't run.

// Main start function
async function startApp() {
    // Determine invoked subcommand (if any)
    const invokedSubcommand = process.argv[2];

    // Use async parsing so that Commander waits for async .action handlers like 'create'
    if (invokedSubcommand === 'create' || invokedSubcommand === 'new') {
        await program.parseAsync(process.argv);
        // 'create' action will call process.exit(), or parsing completes and we return
        return;
    }
    // For all other cases, parse and then proceed to default logic
    await program.parseAsync(process.argv);

    // After parsing, handle default headless or interactive CLI behavior

    const headlessInput = program.args.length > 0 ? program.args.join(' ') : undefined;
    const options = program.opts(); // These are the global options

    // Dynamically infer provider and api key from the supplied model
    if (options.model) {
        let modelProvider: string;
        try {
            modelProvider = getProviderFromModel(options.model);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error(`ERROR: ${msg}`);
            logger.error(`Supported models are:\n${getAllSupportedModels().join(', ')}`);
            process.exit(1);
        }
        options.provider = modelProvider;

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
    const runMode = options.mode.toLowerCase(); // Default is 'cli'
    const webPort = parseInt(options.webPort, 10);
    const resolveFromPackageRoot = configFile === DEFAULT_CONFIG_PATH;
    const normalizedConfigPath = resolvePackagePath(configFile, resolveFromPackageRoot);

    try {
        validateCliOptions(options);
    } catch (error) {
        handleCliOptionsError(error);
    }

    // If 'create' was specified, its action handler (handleCreateProject)
    // calls process.exit(), so we shouldn't reach here if 'create' was run.

    // The primary way to distinguish headless/interactive from a command like 'create'
    // is that 'create's action handler will terminate the process.
    // If we are past program.parse() and the process hasn't exited, it means
    // either no command was given, or a command/option was processed that doesn't exit (not 'create').

    // If program.args has content, it implies a headless prompt was intended,
    // as 'create' doesn't use program.args for its main argument anymore.

    logger.info(`Initializing Saiki with config: ${normalizedConfigPath}`, null, 'blue');

    // Display startup messages for CLI or headless modes
    if (runMode === 'cli') {
        if (!headlessInput) {
            logger.info('');
            logger.info(
                "Running in CLI mode. Use natural language or type 'exit' to quit.",
                'cyanBright'
            );
            logger.info('Examples:', 'yellow');
            logger.info('- "List all files in the current directory"');
            logger.info('- "Show system information"');
            logger.info('- "Create a new file called test.txt with \'Hello World\' as content"');
            logger.info('- "Run a simple python script that prints numbers from 1 to 10"');
            logger.info('');
        } else {
            logger.info(
                `Running in headless CLI mode with prompt: "${headlessInput}"`,
                'cyanBright'
            );
        }
    }

    let agent: SaikiAgent;
    try {
        const config = await loadConfigFile(normalizedConfigPath);
        agent = await SaikiAgent.create(
            config,
            {
                // Pass relevant CLI options for agent creation
                model: options.model,
                provider: options.provider,
                router: options.router,
                apiKey: options.apiKey,
            },
            {
                connectionMode,
                runMode: runMode, // This might need to be more nuanced if a command like 'web' is run
            }
        );
    } catch (err) {
        if (err instanceof Error) {
            err.message.split('\n').forEach((line) => logger.error(line));
        } else {
            logger.error('Unexpected error during startup:', err);
        }
        process.exit(1);
    }

    // If a specific command like 'web' or 'discord' was intended, the 'runMode' option handles it.
    // We need to ensure that if 'saiki web' is a future command, it takes precedence over 'runMode' option.
    // For now, runMode option dictates.

    if (runMode === 'cli') {
        if (headlessInput) {
            await startHeadlessCli(agent, headlessInput);
            process.exit(0);
        } else {
            await startAiCli(agent); // Interactive CLI
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

// Execute the app
startApp().catch((error) => {
    logger.error('Unhandled error during Saiki execution:');
    logger.error(error);
    process.exit(1);
});
