#!/usr/bin/env node
import { existsSync } from 'fs';
import { Command } from 'commander';
import dotenv from 'dotenv';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import pkg from '../../package.json' with { type: 'json' };
import path from 'path';

import {
    logger,
    DEFAULT_CONFIG_PATH,
    resolvePackagePath,
    getProviderFromModel,
    getAllSupportedModels,
    SaikiAgent,
    loadConfigFile,
    createSaikiAgent,
} from '@core/index.js';
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
} from './cli/commands/create.js';
import { initSaiki, postInitSaiki } from './cli/commands/init.js';
import { getUserInputToInitSaikiApp } from './cli/commands/init.js';
import { checkForFileInCurrentDirectory, FileNotFoundError } from './cli/utils/package-mgmt.js';
import { startNextJsWebServer } from './web.js';
// Load environment variables
dotenv.config();

const program = new Command();

// Universal stuff
if (process.env.SAIKI_LOG_LEVEL) {
    logger.setLevel(process.env.SAIKI_LOG_LEVEL);
}

// 1) GLOBAL OPTIONS
program
    .name('saiki')
    .description('AI-powered CLI and WebUI for interacting with MCP servers')
    .version(pkg.version, '-v, --version', 'output the current version')
    .option('-c, --config-file <path>', 'Path to config file', DEFAULT_CONFIG_PATH)
    .option('-s, --strict', 'Require all server connections to succeed')
    .option('--no-verbose', 'Disable verbose output')
    .option('-m, --model <model>', 'Specify the LLM model to use. ')
    .option('-r, --router <router>', 'Specify the LLM router to use (vercel or in-built)')
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
            logger.error(`saiki create-app command failed: ${err}`);
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
                logger.error(`${err.message} Run "saiki create-app" to create a new app`);
                process.exit(1);
            }
            logger.error(`Initialization failed: ${err}`);
            process.exit(1);
        }
    });

// 4) Interactive/One shot (CLI/HEADLESS) or run in other modes (--mode web/discord/telegram)
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
            'Run saiki web UI with `saiki --mode web`\n' +
            'Run saiki as a server (REST APIs + WebSockets) with `saiki --mode server`\n' +
            'Run saiki as a discord bot with `saiki --mode discord`\n' +
            'Run saiki as a telegram bot with `saiki --mode telegram`\n' +
            'Run saiki as an MCP server with `saiki --mode mcp`\n\n' +
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
            logger.error(
                'ERROR: No API key found. Please set OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or ANTHROPIC_API_KEY.'
            );
            process.exit(1);
        }

        const opts = program.opts();
        const headlessInput = prompt.join(' ') || undefined;

        // ——— Infer provider & API key from model ———
        if (opts.model) {
            let provider: string;
            try {
                provider = getProviderFromModel(opts.model);
            } catch (err) {
                logger.error((err as Error).message);
                logger.error('Supported models: ' + getAllSupportedModels().join(', '));
                process.exit(1);
            }
            const envMap: Record<string, string> = {
                openai: 'OPENAI_API_KEY',
                anthropic: 'ANTHROPIC_API_KEY',
                google: 'GOOGLE_GENERATIVE_AI_API_KEY',
            };
            const envVar = envMap[provider as keyof typeof envMap];
            if (!process.env[envVar]) {
                logger.error(`Missing ${envVar} for provider '${provider}'`);
                process.exit(1);
            }
            opts.provider = provider;
            opts.apiKey = process.env[envVar];
        }

        try {
            validateCliOptions(opts);
        } catch (err) {
            handleCliOptionsError(err);
        }

        // ——— Load config & create agent ———
        let agent: SaikiAgent;
        try {
            const configPath = resolvePackagePath(
                opts.configFile,
                opts.configFile === DEFAULT_CONFIG_PATH
            );
            logger.info(`Initializing Saiki with config: ${configPath}`);
            const cfg = await loadConfigFile(configPath);
            agent = await createSaikiAgent(
                cfg,
                {
                    model: opts.model,
                    provider: opts.provider,
                    router: opts.router,
                    apiKey: opts.apiKey,
                },
                {
                    connectionMode: opts.strict ? 'strict' : 'lenient',
                    runMode: opts.mode,
                }
            );
        } catch (err) {
            logger.error((err as Error).message);
            process.exit(1);
        }

        // ——— Dispatch based on --mode ———
        switch (opts.mode) {
            case 'cli':
                if (headlessInput) {
                    // One shot CLI
                    await startHeadlessCli(agent, headlessInput);
                    process.exit(0);
                } else {
                    await startAiCli(agent); // Interactive CLI
                }
                break;

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

            case 'discord':
                logger.info('Starting Discord bot…', null, `cyanBright`);
                try {
                    startDiscordBot(agent);
                } catch (err) {
                    logger.error('Discord startup failed:', err);
                    process.exit(1);
                }
                break;

            case 'telegram':
                logger.info('Starting Telegram bot…', null, `cyanBright`);
                try {
                    startTelegramBot(agent);
                } catch (err) {
                    logger.error('Telegram startup failed:', err);
                    process.exit(1);
                }
                break;

            // TODO: Remove is server mode is stable and supports mcp
            case 'mcp': {
                // Start API server only
                const webPort = parseInt(opts.webPort, 10);
                const agentCard = agent.getEffectiveConfig().agentCard ?? {};
                const apiPort = getPort(process.env.API_PORT, webPort + 1, 'API_PORT');
                const apiUrl = process.env.API_URL ?? `http://localhost:${apiPort}`;

                logger.info('Starting API server...', null, 'cyanBright');
                await startApiAndLegacyWebUIServer(agent, apiPort, false, agentCard);
                logger.info(`API endpoints available at ${apiUrl}`, null, 'magenta');
                break;
            }

            case 'server': {
                // Start server with REST APIs and WebSockets only
                const webPort = parseInt(opts.webPort, 10);
                const agentCard = agent.getEffectiveConfig().agentCard ?? {};
                const apiPort = getPort(process.env.API_PORT, webPort + 1, 'API_PORT');
                const apiUrl = process.env.API_URL ?? `http://localhost:${apiPort}`;

                logger.info('Starting server (REST APIs + WebSockets)...', null, 'cyanBright');
                await startApiAndLegacyWebUIServer(agent, apiPort, false, agentCard);
                logger.info(`Server running at ${apiUrl}`, null, 'green');
                logger.info('Available endpoints:', null, 'cyan');
                logger.info('  POST /api/message - Send async message', null, 'gray');
                logger.info('  POST /api/message-sync - Send sync message', null, 'gray');
                logger.info('  POST /api/reset - Reset conversation', null, 'gray');
                logger.info('  GET  /api/mcp/servers - List MCP servers', null, 'gray');
                logger.info('  WebSocket support available for real-time events', null, 'gray');
                break;
            }

            default:
                logger.error(
                    `Unknown mode '${opts.mode}'. Use cli, web, server, discord, telegram, or mcp.`
                );
                process.exit(1);
        }
    });

// 5) PARSE & EXECUTE
program.parseAsync(process.argv);
