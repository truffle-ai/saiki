#!/usr/bin/env node
import { existsSync } from 'fs';
import { Command } from 'commander';
import dotenv from 'dotenv';
import { logger } from '../src/utils/logger.js';
import { loadConfigFile } from '../src/config/loader.js';
import { DEFAULT_CONFIG_PATH, resolvePackagePath } from '../src/utils/path.js';
import { AgentConfig } from '../src/config/types.js';
import { initializeServices } from '../src/utils/service-initializer.js';
import { runAiCli } from './cli/cli.js';
import { initializeWebUI } from './web/server.js';
import { resolveConfiguration } from '../src/config/resolver.js';
import { z } from 'zod';
import {
    LLM_REGISTRY,
    getSupportedProviders,
    getSupportedModels,
    isValidProviderModel,
} from '../src/ai/llm/registry.js';

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
    // General Options
    .option('-c, --config-file <path>', 'Path to config file', DEFAULT_CONFIG_PATH)
    .option('-s, --strict', 'Require all server connections to succeed')
    .option('--no-verbose', 'Disable verbose output')
    .option('--mode <mode>', 'Run mode: cli or web', 'cli')
    .option('--web-port <port>', 'Port for WebUI', '3000')
    // LLM Options
    .option('-m, --model <model>', 'Specify the LLM model to use')
    .option('-p, --provider <provider>', 'Specify the LLM provider to use')
    .option('-r, --router <router>', 'Specify the LLM router to use (vercel or default)')
    .version('0.2.0');

program.parse();

// Get options
const options = program.opts();
const configFile = options.configFile;
const connectionMode = options.strict ? 'strict' : ('lenient' as 'strict' | 'lenient');
const runMode = options.mode.toLowerCase();
const webPort = parseInt(options.webPort, 10);
const resolveFromPackageRoot = configFile === DEFAULT_CONFIG_PATH; // Check if should resolve from package root

// Validate options by group
try {
    validateGeneralOptions(options);
    validateLlmOptions(options);
} catch (error) {
    // Improved error logging for Zod errors
    if (error instanceof z.ZodError) {
        logger.error('Validation error(s):');
        error.errors.forEach((err) => {
            logger.error(`- ${err.path.join('.') || 'Options'}: ${err.message}`);
        });
    } else {
        logger.error(`Validation error: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    }
    process.exit(1);
}

// Platform-independent path handling
const normalizedConfigPath = resolvePackagePath(configFile, resolveFromPackageRoot);

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
async function startAgent() {
    try {
        // Load the agent configuration from file
        const config: AgentConfig = await loadConfigFile(normalizedConfigPath);
        // Resolve configuration with CLI overrides (model, provider, router)
        const cliArgs = {
            model: options.model,
            provider: options.provider,
            router: options.router,
        };
        const resolvedConfig = resolveConfiguration(config, cliArgs);
        validateAgentConfig(resolvedConfig);

        logger.info('===============================================');
        logger.info(`Initializing Saiki in '${runMode}' mode...`, null, 'cyanBright');
        logger.info('===============================================\n');

        // Use the shared initializer with resolved config
        const { clientManager, llmService, agentEventBus } = await initializeServices(resolvedConfig, {
            connectionMode,
            runMode,
        });

        // Start based on mode
        if (runMode === 'cli') {
            // Run CLI
            await runAiCli(clientManager, llmService, agentEventBus);
        } else if (runMode === 'web') {
            // Run WebUI
            initializeWebUI(clientManager, llmService, agentEventBus, webPort);
            logger.info(`WebUI available at http://localhost:${webPort}`, null, 'magenta');
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
            model: 'gpt-4.1-mini',
            systemPrompt:
                'You are Saiki, a helpful AI assistant with access to tools. Use these tools when appropriate to answer user queries. You can use multiple tools in sequence to solve complex problems. After each tool result, determine if you need more information or can provide a final answer.',
            apiKey: '$OPENAI_API_KEY',
        };
    } else {
        // Ensure required LLM fields are present if section exists
        if (!config.llm.provider || !config.llm.model) {
            throw new Error('LLM configuration must specify provider and model in config file.');
        }
        // **Optional**: Validate config file provider/model against registry
        if (!isValidProviderModel(config.llm.provider, config.llm.model)) {
            const supportedModels = getSupportedModels(config.llm.provider);
            const supportedProviders = getSupportedProviders();
            let errorMsg = `Invalid provider/model combination in config file: provider='${config.llm.provider}', model='${config.llm.model}'.`;
            if (supportedModels.length > 0) {
                errorMsg += ` Supported models for '${config.llm.provider}': ${supportedModels.join(', ')}.`;
            } else {
                errorMsg += ` Supported providers are: ${supportedProviders.join(', ')}.`;
            }
             throw new Error(errorMsg);
        }
        // Provide default system prompt if missing
        if (!config.llm.systemPrompt) {
            logger.info('No system prompt found, using default', 'yellow');
            config.llm.systemPrompt =
                'You are Saiki, a helpful AI assistant with access to tools. Use these tools when appropriate to answer user queries. You can use multiple tools in sequence to solve complex problems. After each tool result, determine if you need more information or can provide a final answer.';
        }
    }

    logger.info(
        `Found ${Object.keys(config.mcpServers).length} server configurations. Validation successful.`,
        'green'
    );
}

// Validation Functions
function validateGeneralOptions(opts: any): void {
    // Define Zod schema for general options
    const generalSchema = z.object({
        configFile: z.string().nonempty('Config file path must not be empty'),
        strict: z.boolean(),
        verbose: z.boolean(),
        mode: z.enum(['cli', 'web'], { errorMap: () => ({ message: 'Mode must be either "cli" or "web"' }) }),
        webPort: z.string().refine(
            (val) => {
                const port = parseInt(val, 10);
                return !isNaN(port) && port > 0 && port <= 65535;
            },
            { message: 'Web port must be a number between 1 and 65535' }
        ),
    });

    // Parse and validate the options
    generalSchema.parse({
        configFile: opts.configFile,
        strict: opts.strict,
        verbose: opts.verbose,
        mode: opts.mode.toLowerCase(),
        webPort: opts.webPort,
    });
}

function validateLlmOptions(opts: any): void {
    const supportedProviders = getSupportedProviders();
    // Define Zod schema for LLM options
    const llmSchema = z
        .object({
            model: z.string().optional(),
            provider: z.string().optional(),
            router: z.string().optional(), // Keep router validation simple for now
        })
        .refine(
            (data) => !((data.provider && !data.model) || (!data.provider && data.model)),
            {
                message: 'Provider and model must both be specified via CLI or neither should be specified.',
                // Specify path for better error reporting if needed, e.g., path: ["provider", "model"]
            }
        )
        .refine(
            (data) => !data.provider || supportedProviders.includes(data.provider.toLowerCase()),
            {
                // This message will be customized below using errorMap for better context
                message: `Unsupported provider specified via CLI.`,
                path: ['provider'],
            }
        )
        .refine(
            (data) => isValidProviderModel(data.provider, data.model),
            {
                // This message will be customized below using errorMap for better context
                message: `Unsupported model specified for the given provider via CLI.`,
                path: ['model'], // Associate error with the model field
            }
        );


    // Use errorMap to provide more detailed messages including supported options
    llmSchema
        .parse(
            {
                model: opts.model,
                provider: opts.provider,
                router: opts.router,
            },
            {
                errorMap: (issue, ctx) => {
                    if (issue.code === z.ZodIssueCode.custom) {
                         // Handle custom refine errors
                         if (issue.path?.includes('provider') && !issue.path?.includes('model') && issue.message.includes('Unsupported provider')) {
                             return { message: `Unsupported provider '${opts.provider}'. Supported providers are: ${supportedProviders.join(', ')}` };
                         }
                         if (issue.path?.includes('model') && issue.message.includes('Unsupported model')) {
                              const models = getSupportedModels(opts.provider);
                              return { message: `Unsupported model '${opts.model}' for provider '${opts.provider}'. Supported models are: ${models.join(', ')}` };
                         }
                         // Fallback for other custom errors (like the both-or-neither check)
                         return { message: issue.message ?? ctx.defaultError };
                    }
                    // Default error handling for other Zod issues (e.g., wrong type)
                    return { message: ctx.defaultError };
                },
            }
        );
}
