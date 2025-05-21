#!/usr/bin/env node
import { existsSync } from 'fs';
import { Command } from 'commander';
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

import {
    logger,
    DEFAULT_CONFIG_PATH,
    resolvePackagePath,
    getProviderFromModel,
    getAllSupportedModels,
    SaikiAgent,
    loadConfigFile,
} from '@core/index.js';
import { startAiCli, startHeadlessCli } from './cli/cli.js';
import { startApiServer } from './api/server.js';
import { startDiscordBot } from './discord/bot.js';
import { startTelegramBot } from './telegram/bot.js';
import { validateCliOptions, handleCliOptionsError } from './utils/options.js';
import { getPort } from '@core/utils/port-utils.js';
import { handleCreateProject } from './cli/commands/create.js';

// Load environment variables
dotenv.config();

const program = new Command();

// 1) GLOBAL OPTIONS
program
    .name('saiki')
    .description('AI-powered CLI and WebUI for interacting with MCP servers')
    .version('0.2.3')
    .option('-c, --config-file <path>', 'Path to config file', DEFAULT_CONFIG_PATH)
    .option('-s, --strict', 'Require all server connections to succeed')
    .option('--no-verbose', 'Disable verbose output')
    .option('-m, --model <model>', 'Specify the LLM model to use')
    .option('-r, --router <router>', 'Specify the LLM router to use (vercel or in-built)')
    .option('--mode <mode>', 'Run mode: cli, web, discord, or telegram', 'cli')
    .option('--web-port <port>', 'Port for WebUI', '3000');

// 2) `create` SUB-COMMAND
program
    .command('create')
    .alias('new')
    .description('Scaffold a new Saiki Node.js project')
    .action(async () => {
        try {
            await handleCreateProject();
            process.exit(0);
        } catch (err) {
            logger.error('Project creation failed:', err);
            process.exit(1);
        }
    });

// 3) DEFAULT RUNNER (CLI / HEADLESS / WEB / DISCORD / TELEGRAM)
program
    .argument('[prompt...]', 'Natural-language prompt to run once (omit for REPL)')
    .description('Default runner: interactive REPL, single prompt, or other modes via --mode')
    .action(async (prompt: string[] = []) => {
        // ——— ENV & API-KEY VALIDATION ———
        if (!existsSync('.env')) {
            logger.debug('WARNING: .env file not found; copy .env.example and set your API keys.');
        }
        if (process.env.SAIKI_LOG_LEVEL) {
            logger.setLevel(process.env.SAIKI_LOG_LEVEL);
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

        // ——— Load config & create agent ———
        let agent: SaikiAgent;
        try {
            const configPath = resolvePackagePath(
                opts.configFile,
                opts.configFile === DEFAULT_CONFIG_PATH
            );
            validateCliOptions(opts);
            logger.info(`Initializing Saiki with config: ${configPath}`);
            const cfg = await loadConfigFile(configPath);
            agent = await SaikiAgent.create(
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
                const cwd = path.resolve(process.cwd(), 'src', 'app', 'webui');
                const frontUrl = process.env.FRONTEND_URL ?? `http://localhost:${frontPort}`;
                const apiUrl = process.env.API_URL ?? `http://localhost:${apiPort}`;

                logger.info(`Launching Next.js dev server on ${frontUrl}`, null, 'cyanBright');
                const nextProc = spawn('npm', ['run', 'dev', '--', '--port', String(frontPort)], {
                    cwd,
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
                                const ifaces = os.networkInterfaces();
                                for (const list of Object.values(ifaces)) {
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
                    logger.error('Next.js dev server failed to start:', err);
                    process.exit(1);
                });
                nextProc.on('exit', (code, signal) => {
                    if (code !== 0) {
                        logger.error(`Next.js dev server exited with code ${code}`, null, 'red');
                        process.exit(1);
                    }
                });

                await startApiServer(
                    agent,
                    apiPort,
                    agent.configManager.getConfig().agentCard || {}
                );
                logger.info(
                    `API endpoints and legacy web UI available at: ${apiUrl}`,
                    null,
                    'green'
                );
                logger.info(`New web UI available at: ${frontUrl}`, null, 'green');
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

            default:
                logger.error(`Unknown mode '${opts.mode}'. Use cli, web, discord, or telegram.`);
                process.exit(1);
        }
    });

// 4) PARSE & EXECUTE
program.parseAsync(process.argv);
