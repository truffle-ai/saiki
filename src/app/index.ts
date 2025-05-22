#!/usr/bin/env node
import { existsSync } from 'fs';
import { Command } from 'commander';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from '../../package.json' with { type: 'json' };

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
import { startApiServer } from './api/server.js';
import { startDiscordBot } from './discord/bot.js';
import { startTelegramBot } from './telegram/bot.js';
import { validateCliOptions, handleCliOptionsError } from './cli/utils/options.js';
import { getPort } from '@core/utils/port-utils.js';
import { createSaikiProject } from './cli/commands/create.js';
import { initSaiki } from './cli/commands/init.js';
import { getUserInput as getUserInputForProject } from './cli/commands/init.js';
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
    .option('-m, --model <model>', 'Specify the LLM model to use')
    .option('-r, --router <router>', 'Specify the LLM router to use (vercel or in-built)')
    .option('--mode <mode>', 'Run mode: cli, web, discord, or telegram', 'cli')
    .option('--web-port <port>', 'Port for WebUI', '3000');

// 2) `create` SUB-COMMAND
program
    .command('create')
    .description('Scaffold a new Saiki Typescript project')
    .action(async () => {
        // create project
        try {
            await createSaikiProject();
        } catch (err) {
            logger.error('Project creation failed:', err);
            process.exit(1);
        }
        // then call init to initialize the project
        try {
            const userInput = await getUserInputForProject();
            await initSaiki(
                userInput.directory,
                userInput.createExampleFile,
                userInput.llmProvider,
                userInput.llmApiKey
            );
            process.exit(0);
        } catch (err) {
            logger.error('Initialization failed:', err);
            process.exit(1);
        }
    });

// 3) `init` SUB-COMMAND
program
    .command('init')
    .description('Initialize an existing Typescript project with Saiki')
    .action(async () => {
        try {
            // pre-condition: check that package.json exists in current directory to know that project is valid
            await checkForFileInCurrentDirectory('package.json');
            // pre-condition: check for tsconfig.json to validate it's a TypeScript project
            await checkForFileInCurrentDirectory('tsconfig.json');

            // get user input to initialize the project correctly
            const userInput = await getUserInputForProject();
            await initSaiki(
                userInput.directory,
                userInput.createExampleFile,
                userInput.llmProvider,
                userInput.llmApiKey
            );
            process.exit(0);
        } catch (err) {
            // if the package.json or tsconfig.json is not found, we give instructions to create a new project
            if (err instanceof FileNotFoundError) {
                logger.error(`${err.message} Run "saiki create" to create a new project`);
                process.exit(1);
            }
            logger.error(`Initialization failed: ${err}`);
            process.exit(1);
        }
    });

// 4) DEFAULT RUNNER (CLI / HEADLESS / WEB / DISCORD / TELEGRAM)
program
    .argument('[prompt...]', 'Natural-language prompt to run once (omit for REPL)')
    .description('Default runner: interactive REPL, single prompt, or other modes via --mode')
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
                const scriptDir = path.dirname(fileURLToPath(import.meta.url));
                logger.debug(`Script directory for web mode: ${scriptDir}`);

                // Try to find the webui directory - could be in different locations depending on installation type
                let webuiPath = path.resolve(scriptDir, 'webui');

                // If not found in expected location for dist, check other possible locations
                if (!existsSync(webuiPath)) {
                    // Check for source directory (common in dev mode and npm link)
                    const srcPath = path.resolve(scriptDir, '..', '..', 'src', 'app', 'webui');
                    if (existsSync(srcPath)) {
                        webuiPath = srcPath;
                        logger.debug(`Found webui in source path: ${webuiPath}`);
                    } else {
                        // Check for cwd + src path (another npm link scenario)
                        const cwdPath = path.resolve(process.cwd(), 'src', 'app', 'webui');
                        if (existsSync(cwdPath)) {
                            webuiPath = cwdPath;
                            logger.debug(`Found webui in cwd path: ${webuiPath}`);
                        } else {
                            logger.warn(
                                'Could not locate webui directory. Web UI may not be available.'
                            );
                        }
                    }
                } else {
                    logger.debug(`Using installed webui path: ${webuiPath}`);
                }

                const frontUrl = process.env.FRONTEND_URL ?? `http://localhost:${frontPort}`;
                const apiUrl = process.env.API_URL ?? `http://localhost:${apiPort}`;

                // Start API server first
                await startApiServer(
                    agent,
                    apiPort,
                    agent.configManager.getConfig().agentCard || {}
                );
                logger.info(`API endpoints available at: ${apiUrl}`, null, 'green');

                // Check if webui directory exists and has package.json
                const hasWebUI =
                    existsSync(webuiPath) && existsSync(path.join(webuiPath, 'package.json'));

                if (hasWebUI) {
                    await startNextJsWebServer(webuiPath, frontPort, apiUrl, frontUrl);
                } else {
                    logger.warn(
                        'Web UI directory not found. Only API endpoints are available.',
                        null,
                        'yellow'
                    );
                    logger.error(
                        'This is unexpected as the webui directory should be included in the package.'
                    );
                    logger.info('Possible fixes:');
                    logger.info(
                        '  1. Reinstall the package: npm uninstall -g @truffle-ai/saiki && npm install -g @truffle-ai/saiki'
                    );
                    logger.info(
                        '  2. Update to the latest version: npm update -g @truffle-ai/saiki'
                    );
                    logger.info(
                        '  3. Run from source: git clone https://github.com/truffle-ai/saiki.git && cd saiki && npm install && npm run build'
                    );
                }

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

// 5) PARSE & EXECUTE
program.parseAsync(process.argv);
