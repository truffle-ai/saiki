import readline from 'readline';
import chalk from 'chalk';
import { ClientManager } from '../src/client/manager.js';
import { logger } from '../src/utils/logger.js';
import { ILLMService } from '../src/ai/llm/services/types.js';
import { AgentConfig } from '../src/config/types.js';
import { initializeServices } from '../src/utils/service-initializer.js';
import { AgentEventManager } from '../src/ai/llm/events/event-manager.js';
import { CLISubscriber } from './cli-subscriber.js';

/**
 * Start AI-powered CLI with unified configuration
 * @param config Agent configuration including MCP servers and LLM settings
 * @param connectionMode Whether to enforce all connections must succeed ("strict") or allow partial success ("lenient")
 */
export async function initializeAiCli(
    config: AgentConfig,
    connectionMode: 'strict' | 'lenient' = 'lenient'
) {
    try {
        // Initialize services using the utility function
        const { clientManager, llmService } = await initializeServices(config, connectionMode);
        
        // Run AI CLI
        await runAiCli(clientManager, llmService);
    } catch (error) {
        logger.error(`Error running AI CLI: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Run the AI CLI with the given LLM service
 * @param clientManager Client manager with registered tool providers
 * @param llmService LLM service implementation
 */
export async function runAiCli(
    clientManager: ClientManager,
    llmService: ILLMService
) {
    // Get model and provider info directly from the LLM service
    logger.info(
        `Using model config:${JSON.stringify(llmService.getConfig(), null, 2)}`,
        null,
        'yellow'
    );

    logger.debug(`Log level: ${logger.getLevel()}`);
    logger.info(`Connected servers: ${clientManager.getClients().size}`, null, 'green');
    logger.error(
        `Failed connections: ${Object.keys(clientManager.getFailedConnections()).length}. Ignoring in lenient mode.\n`,
        null,
        'red'
    );

    try {
        // Set up event management
        logger.info('Setting up event manager and cli logging...');
        const eventManager = new AgentEventManager(llmService);
        const cliSubscriber = new CLISubscriber();
        eventManager.registerSubscriber(cliSubscriber);

        // Get available tools from all connected servers
        logger.info('Loading available tools...');
        const tools = await clientManager.getAllTools();
        logger.info(
            `Loaded ${Object.keys(tools).length} tools from ${clientManager.getClients().size} MCP servers\n`
        );
        logger.info('AI Agent initialized successfully!', null, 'green');

        // Create readline interface
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.bold.green('\nWhat would you like to do? '),
        });

        // Make sure stdin is in flowing mode
        process.stdin.resume();
        rl.prompt();

        // Main interaction loop - simplified with question-based approach
        const promptUser = () => {
            return new Promise<string>((resolve) => {
                process.stdin.resume();
                rl.question(chalk.bold.green('\nWhat would you like to do? '), (answer) => {
                    resolve(answer.trim());
                });
            });
        };

        try {
            while (true) {
                const userInput = await promptUser();

                if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
                    logger.warn('Exiting AI CLI. Goodbye!');
                    eventManager.removeSubscriber(cliSubscriber);
                    rl.close();
                    process.exit(0);
                }

                if (userInput.toLowerCase() === 'clear') {
                    llmService.resetConversation();
                    logger.info('Conversation history cleared.');
                    continue;
                }

                try {
                    // Simply call completeTask - all updates happen via events
                    await llmService.completeTask(userInput);
                } catch (error) {
                    logger.error(`Error in processing input: ${error.message}`);
                }
            }
        } finally {
            eventManager.removeSubscriber(cliSubscriber);
            rl.close();
        }
    } catch (error) {
        logger.error(`Error during initialization: ${error.message}`);
    }
}
