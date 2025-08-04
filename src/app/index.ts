#!/usr/bin/env node
// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config();

import { existsSync } from 'fs';
import { Command } from 'commander';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import pkg from '../../package.json' with { type: 'json' };

import {
    logger,
    DEFAULT_CONFIG_PATH,
    resolveConfigPath,
    getProviderFromModel,
    getAllSupportedModels,
    SaikiAgent,
    loadAgentConfig,
    LLMProvider,
} from '@core/index.js';
import { applyCLIOverrides, type CLIConfigOverrides } from './config/cli-overrides.js';
import { resolveApiKeyForProvider } from '@core/utils/api-key-resolver.js';
import { startAiCli, startHeadlessCli } from './cli/cli.js';
import { startApiAndLegacyWebUIServer } from './api/server.js';
import { startDiscordBot } from './discord/bot.js';
import { startTelegramBot } from './telegram/bot.js';
import { validateCliOptions, handleCliOptionsError } from './cli/utils/options.js';
import { getPort } from '@core/utils/port-utils.js';
import {
    createSaikiProject,
    createTsconfigJson,
    addSaikiScriptsToPackageJson,
    postCreateSaiki,
    initSaiki,
    postInitSaiki,
    getUserInputToInitSaikiApp,
} from './cli/project-commands/index.js';
import { checkForFileInCurrentDirectory, FileNotFoundError } from './cli/utils/package-mgmt.js';
import { startNextJsWebServer } from './web.js';
import { initializeMcpServer, createMcpTransport } from './api/mcp/mcp_handler.js';
import { createAgentCard } from '@core/config/agentCard.js';
import { initializeMcpToolAggregationServer } from './api/mcp/tool-aggregation-handler.js';

const program = new Command();

// 1) GLOBAL OPTIONS
program
    .name('saiki')
    .description('AI-powered CLI and WebUI for interacting with MCP servers')
    .version(pkg.version, '-v, --version', 'output the current version')
    .option('-a, --agent <path>', 'Path to agent config file', DEFAULT_CONFIG_PATH)
    .option('-s, --strict', 'Require all server connections to succeed')
    .option('--no-verbose', 'Disable verbose output')
    .option('-m, --model <model>', 'Specify the LLM model to use. ')
    .option('-r, --router <router>', 'Specify the LLM router to use (vercel or in-built)')
    .option('--new-session [sessionId]', 'Start with a new session (optionally specify session ID)')
    .option(
        '--mode <mode>',
        'The application in which saiki should talk to you - cli | web | server | discord | telegram | mcp',
        'cli'
    )
    .option('--web-port <port>', 'optional port for the web UI', '3000');

// 2) `create-app` SUB-COMMAND
program
    .command('create-app')
    .description('Scaffold a new Saiki Typescript app')
    .action(async () => {
        try {
            p.intro(chalk.inverse('Saiki Create App'));
            // first setup the initial files in the project and get the project path
            const appPath = await createSaikiProject();

            // then get user inputs for directory, llm etc.
            const userInput = await getUserInputToInitSaikiApp();

            // move to project directory, then add the saiki scripts to the package.json and create the tsconfig.json
            process.chdir(appPath);
            await addSaikiScriptsToPackageJson(userInput.directory, appPath);
            await createTsconfigJson(appPath, userInput.directory);

            // then initialize the other parts of the project
            await initSaiki(
                userInput.directory,
                userInput.createExampleFile,
                userInput.llmProvider,
                userInput.llmApiKey
            );
            p.outro(chalk.greenBright('Saiki app created and initialized successfully!'));
            // add notes for users to get started with their newly created Saiki project
            await postCreateSaiki(appPath, userInput.directory);
            process.exit(0);
        } catch (err) {
            console.error(`❌ saiki create-app command failed: ${err}`);
            process.exit(1);
        }
    });

// 3) `init-app` SUB-COMMAND
program
    .command('init-app')
    .description('Initialize an existing Typescript app with Saiki')
    .action(async () => {
        try {
            // pre-condition: check that package.json and tsconfig.json exist in current directory to know that project is valid
            await checkForFileInCurrentDirectory('package.json');
            await checkForFileInCurrentDirectory('tsconfig.json');

            // start intro
            p.intro(chalk.inverse('Saiki Init App'));
            const userInput = await getUserInputToInitSaikiApp();
            await initSaiki(
                userInput.directory,
                userInput.createExampleFile,
                userInput.llmProvider,
                userInput.llmApiKey
            );
            p.outro(chalk.greenBright('Saiki app initialized successfully!'));

            // add notes for users to get started with their new initialized Saiki project
            await postInitSaiki(userInput.directory);
            process.exit(0);
        } catch (err) {
            // if the package.json or tsconfig.json is not found, we give instructions to create a new project
            if (err instanceof FileNotFoundError) {
                console.error(`❌ ${err.message} Run "saiki create-app" to create a new app`);
                process.exit(1);
            }
            console.error(`❌ Initialization failed: ${err}`);
            process.exit(1);
        }
    });

// 4) `mcp` SUB-COMMAND
// For now, this mode simply aggregates and re-expose tools from configured MCP servers (no agent)
// saiki --mode mcp will be moved to this sub-command in the future
program
    .command('mcp')
    .description(
        'Start Saiki as an MCP server. Use --group-servers to aggregate and re-expose tools from configured MCP servers. \
        In the future, this command will expose the agent as an MCP server by default.'
    )
    .option('-s, --strict', 'Require all MCP server connections to succeed')
    .option(
        '--group-servers',
        'Aggregate and re-expose tools from configured MCP servers (required for now)'
    )
    .option('--name <n>', 'Name for the MCP server', 'saiki-tools')
    .option('--version <version>', 'Version for the MCP server', '1.0.0')
    .action(async (options) => {
        try {
            // Validate that --group-servers flag is provided (mandatory for now)
            if (!options.groupServers) {
                console.error(
                    '❌ The --group-servers flag is required. This command currently only supports aggregating and re-exposing tools from configured MCP servers.'
                );
                console.error('Usage: saiki mcp --group-servers');
                process.exit(1);
            }

            // Load and resolve config
            // Get the global agent option from the main program
            const globalOpts = program.opts();
            const configPath =
                globalOpts.agent === DEFAULT_CONFIG_PATH ? undefined : globalOpts.agent;

            const config = await loadAgentConfig(configPath);
            console.log(`📄 Loading Saiki config from: ${resolveConfigPath(configPath)}`);

            // Validate that MCP servers are configured
            if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
                console.error(
                    '❌ No MCP servers configured. Please configure mcpServers in your config file.'
                );
                process.exit(1);
            }

            // Logs are already redirected to file by default to prevent interference with stdio transport
            const currentLogPath = logger.getLogFilePath();
            logger.info(`MCP mode using log file: ${currentLogPath || 'default .saiki location'}`);

            logger.info(
                `Starting MCP tool aggregation server: ${options.name} v${options.version}`
            );
            logger.info(`Configured MCP servers: ${Object.keys(config.mcpServers).join(', ')}`);

            // Create stdio transport for MCP tool aggregation
            const mcpTransport = await createMcpTransport('stdio');

            // Initialize tool aggregation server
            await initializeMcpToolAggregationServer(
                config.mcpServers,
                mcpTransport,
                options.name,
                options.version,
                options.strict
            );

            logger.info('MCP tool aggregation server started successfully');
        } catch (err) {
            // Write to stderr to avoid interfering with MCP protocol
            process.stderr.write(`MCP tool aggregation server startup failed: ${err}\n`);
            process.exit(1);
        }
    });

// 5) Main saiki CLI - Interactive/One shot (CLI/HEADLESS) or run in other modes (--mode web/discord/telegram)
program
    .argument(
        '[prompt...]',
        'Natural-language prompt to run once. If not passed, saiki will start as an interactive CLI'
    )
    // Main customer facing description
    .description(
        'Saiki CLI allows you to talk to Saiki, build custom AI Agents, ' +
            'build complex AI applications like Cursor, and more.\n\n' +
            // TODO: Add `saiki tell me about your cli` starter prompt
            'Run saiki interactive CLI with `saiki` or run a one-shot prompt with `saiki <prompt>`\n' +
            'Start with a new session using `saiki --new-session [sessionId]`\n' +
            'Run saiki web UI with `saiki --mode web`\n' +
            'Run saiki as a server (REST APIs + WebSockets) with `saiki --mode server`\n' +
            'Run saiki as a discord bot with `saiki --mode discord`\n' +
            'Run saiki as a telegram bot with `saiki --mode telegram`\n' +
            'Run saiki agent as an MCP server with `saiki --mode mcp`\n' +
            'Run saiki as an MCP server aggregator with `saiki mcp --group-servers`\n\n' +
            'Check subcommands for more features. Check https://github.com/truffle-ai/saiki for documentation on how to customize saiki and other examples'
    )
    .action(async (prompt: string[] = []) => {
        // ——— ENV & API-KEY VALIDATION ———
        if (!existsSync('.env')) {
            logger.debug('WARNING: .env file not found; copy .env.example and set your API keys.');
        }
        if (
            !process.env.OPENAI_API_KEY &&
            !process.env.GOOGLE_GENERATIVE_AI_API_KEY &&
            !process.env.ANTHROPIC_API_KEY
        ) {
            console.error(
                '❌ No API key found. Please set OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or ANTHROPIC_API_KEY.'
            );
            process.exit(1);
        }

        const opts = program.opts();
        const headlessInput = prompt.join(' ') || undefined;

        // ——— Infer provider & API key from model ———
        if (opts.model) {
            let provider: LLMProvider;
            try {
                provider = getProviderFromModel(opts.model);
            } catch (err) {
                console.error(`❌ ${(err as Error).message}`);
                console.error(`Supported models: ${getAllSupportedModels().join(', ')}`);
                process.exit(1);
            }

            const apiKey = resolveApiKeyForProvider(provider);
            if (!apiKey) {
                console.error(
                    `❌ Missing API key for provider '${provider}' - please set the appropriate environment variable`
                );
                process.exit(1);
            }
            opts.provider = provider;
            opts.apiKey = apiKey;
        }

        try {
            validateCliOptions(opts);
        } catch (err) {
            handleCliOptionsError(err);
        }

        // ——— Load config & create agent ———
        let agent: SaikiAgent;
        try {
            const configPath = opts.agent === DEFAULT_CONFIG_PATH ? undefined : opts.agent;
            console.log(`🚀 Initializing Saiki with config: ${resolveConfigPath(configPath)}`);
            const cfg = await loadAgentConfig(configPath);

            // Apply CLI overrides to config before passing to core layer
            const cliOverrides: CLIConfigOverrides = {
                model: opts.model,
                provider: opts.provider,
                router: opts.router,
                apiKey: opts.apiKey,
            };
            // Set run mode for tool confirmation provider
            process.env.SAIKI_RUN_MODE = opts.mode;

            // Apply CLI overrides
            const finalConfig = applyCLIOverrides(cfg, cliOverrides);

            // Apply --strict flag to all server configs
            if (opts.strict && finalConfig.mcpServers) {
                for (const [_serverName, serverConfig] of Object.entries(finalConfig.mcpServers)) {
                    // All server config types have connectionMode field
                    serverConfig.connectionMode = 'strict';
                }
            }

            agent = new SaikiAgent(finalConfig, configPath);

            // Start the agent (initialize async services)
            await agent.start();

            // Handle --new-session flag
            if (opts.newSession !== undefined) {
                try {
                    // Use provided session ID or generate a random one
                    const sessionId =
                        typeof opts.newSession === 'string' && opts.newSession
                            ? opts.newSession
                            : undefined; // Let agent generate random ID

                    const session = await agent.createSession(sessionId);
                    await agent.loadSession(session.id);

                    logger.info(`Created and loaded new session: ${session.id}`, null, 'green');
                } catch (err) {
                    console.error(
                        `❌ Failed to create new session: ${err instanceof Error ? err.message : String(err)}`
                    );
                    process.exit(1);
                }
            }
        } catch (err) {
            // Ensure config errors are shown to user, not hidden in logs
            console.error(`❌ Configuration Error: ${(err as Error).message}`);
            process.exit(1);
        }

        // ——— Dispatch based on --mode ———
        switch (opts.mode) {
            case 'cli': {
                // Set up CLI tool confirmation subscriber
                const { CLIToolConfirmationSubscriber } = await import(
                    './cli/tool-confirmation/cli-confirmation-handler.js'
                );
                const cliSubscriber = new CLIToolConfirmationSubscriber();
                cliSubscriber.subscribe(agent.agentEventBus);
                logger.info('Setting up CLI event subscriptions...');

                if (headlessInput) {
                    // One shot CLI
                    await startHeadlessCli(agent, headlessInput);
                    process.exit(0);
                } else {
                    await startAiCli(agent); // Interactive CLI
                }
                break;
            }

            case 'web': {
                const webPort = parseInt(opts.webPort, 10);
                const frontPort = getPort(process.env.FRONTEND_PORT, webPort, 'FRONTEND_PORT');
                const apiPort = getPort(process.env.API_PORT, webPort + 1, 'API_PORT');
                const apiUrl = process.env.API_URL ?? `http://localhost:${apiPort}`;
                const nextJSserverURL = process.env.FRONTEND_URL ?? `http://localhost:${frontPort}`;

                // Start API server first with legacy web UI
                await startApiAndLegacyWebUIServer(
                    agent,
                    apiPort,
                    true,
                    agent.getEffectiveConfig().agentCard || {}
                );

                // Start Next.js web server
                await startNextJsWebServer(apiUrl, frontPort, nextJSserverURL);

                break;
            }

            // Start server with REST APIs and WebSockets on port 3001
            // This also enables saiki to be used as a remote mcp server at localhost:3001/mcp
            case 'server': {
                // Start server with REST APIs and WebSockets only
                const agentCard = agent.getEffectiveConfig().agentCard ?? {};
                const apiPort = getPort(process.env.API_PORT, 3001, 'API_PORT');
                const apiUrl = process.env.API_URL ?? `http://localhost:${apiPort}`;

                console.log('🌐 Starting server (REST APIs + WebSockets)...');
                await startApiAndLegacyWebUIServer(agent, apiPort, false, agentCard);
                console.log(`✅ Server running at ${apiUrl}`);
                console.log('Available endpoints:');
                console.log('  POST /api/message - Send async message');
                console.log('  POST /api/message-sync - Send sync message');
                console.log('  POST /api/reset - Reset conversation');
                console.log('  GET  /api/mcp/servers - List MCP servers');
                console.log('  WebSocket support available for real-time events');
                break;
            }

            case 'discord':
                console.log('🤖 Starting Discord bot…');
                try {
                    startDiscordBot(agent);
                } catch (err) {
                    console.error('❌ Discord startup failed:', err);
                    process.exit(1);
                }
                break;

            case 'telegram':
                console.log('🤖 Starting Telegram bot…');
                try {
                    startTelegramBot(agent);
                } catch (err) {
                    console.error('❌ Telegram startup failed:', err);
                    process.exit(1);
                }
                break;

            // TODO: Remove if server mode is stable and supports mcp
            // Starts saiki as a local mcp server
            // Use `saiki --mode mcp` to start saiki as a local mcp server
            // Use `saiki --mode server` to start saiki as a remote server
            case 'mcp': {
                // Start stdio mcp server only
                const agentCardConfig = agent.getEffectiveConfig().agentCard || {
                    name: 'saiki',
                    version: '1.0.0',
                };

                try {
                    // Logs are already redirected to file by default to prevent interference with stdio transport

                    const agentCardData = createAgentCard(
                        {
                            defaultName: agentCardConfig.name ?? 'saiki',
                            defaultVersion: agentCardConfig.version ?? '1.0.0',
                            defaultBaseUrl: 'stdio://local-saiki',
                        },
                        agentCardConfig // preserve overrides from agent.yml
                    );
                    // Use stdio transport in mcp mode
                    const mcpTransport = await createMcpTransport('stdio');
                    await initializeMcpServer(agent, agentCardData, mcpTransport);
                } catch (err) {
                    // Write to stderr instead of stdout to avoid interfering with MCP protocol
                    process.stderr.write(`MCP server startup failed: ${err}\n`);
                    process.exit(1);
                }
                break;
            }

            default:
                console.error(
                    `❌ Unknown mode '${opts.mode}'. Use cli, web, server, discord, telegram, or mcp.`
                );
                process.exit(1);
        }
    });

// 6) PARSE & EXECUTE
program.parseAsync(process.argv);
