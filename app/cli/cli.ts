import readline from 'readline';
import chalk from 'chalk';
import { MCPClientManager } from '../../src/client/manager.js'; // Adjusted path
import { logger } from '../../src/utils/logger.js'; // Adjusted path
import { ILLMService } from '../../src/ai/llm/services/types.js'; // Adjusted path
import { CLISubscriber } from './cli-subscriber.js'; // Now points to the new location
import { EventEmitter } from 'events';

const validLogLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
const HELP_MESSAGE = `Available commands:
exit/quit - Exit the CLI
clear - Clear conversation history
help - Show this help message
currentloglevel - Show current logging level
${validLogLevels.join('|')} - Set logging level directly
`;

/**
 * Initializes common CLI setup: logging, event subscriptions, tool loading.
 * @param clientManager
 * @param llmService
 * @param agentEventBus
 */
async function _initCli(
    clientManager: MCPClientManager,
    llmService: ILLMService,
    agentEventBus: EventEmitter
): Promise<void> {
    // Log model and connection info
    logger.info(
        `Using model config: ${JSON.stringify(llmService.getConfig(), null, 2)}`,
        null,
        'yellow'
    );
    logger.debug(`Log level: ${logger.getLevel()}`);
    logger.info(`Connected servers: ${clientManager.getClients().size}`, null, 'green');
    const failedConnections = clientManager.getFailedConnections();
    if (Object.keys(failedConnections).length > 0) {
        logger.error(`Failed connections: ${Object.keys(failedConnections).length}.`, null, 'red');
    }

    // Set up event management
    logger.info('Setting up CLI event subscriptions...');
    const cliSubscriber = new CLISubscriber();
    cliSubscriber.subscribe(agentEventBus);

    // Load available tools
    logger.info('Loading available tools...');
    const tools = await clientManager.getAllTools(); // tools variable is not used currently but kept for potential future use
    logger.info(
        `Loaded ${Object.keys(tools).length} tools from ${clientManager.getClients().size} MCP servers
`
    );
    logger.info('AI Agent initialized successfully!', null, 'green');
}

/**
 * Run the AI CLI with the given LLM service
 * @param clientManager Client manager with registered tool providers
 * @param llmService LLM service implementation
 */
export async function startAiCli(
    clientManager: MCPClientManager,
    llmService: ILLMService,
    agentEventBus: EventEmitter
) {
    try {
        // Common initialization
        await _initCli(clientManager, llmService, agentEventBus);

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
                // Check if stdin is still connected/readable
                if (!process.stdin.isTTY) {
                    logger.warn('Input stream closed. Exiting CLI.');
                    resolve('exit'); // Simulate exit command
                    return;
                }
                process.stdin.resume();
                rl.question(chalk.bold.green('\nWhat would you like to do? '), (answer) => {
                    resolve(answer.trim());
                });
            });
        };

        function handleCliCommand(input: string): boolean {
            const lowerInput = input.toLowerCase().trim();

            if (lowerInput === 'exit' || lowerInput === 'quit') {
                logger.warn('Exiting AI CLI. Goodbye!');
                rl.close();
                process.exit(0);
            }

            if (lowerInput === 'clear') {
                llmService.resetConversation();
                logger.info('Conversation history cleared.');
                return true;
            }

            if (validLogLevels.includes(lowerInput)) {
                logger.setLevel(lowerInput);
                return true;
            }

            if (lowerInput === 'currentloglevel') {
                logger.info(`Current log level: ${logger.getLevel()}`);
                return true;
            }

            if (lowerInput === 'help') {
                showHelp();
                return true;
            }

            return false;
        }

        function showHelp() {
            logger.info(HELP_MESSAGE);
        }

        try {
            while (true) {
                const userInput = await promptUser();

                if (handleCliCommand(userInput)) {
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
            // Ensure cleanup happens even if the loop breaks unexpectedly
            rl.close();
        }
    } catch (error) {
        logger.error(`Error during CLI initialization: ${error.message}`);
        process.exit(1); // Exit with error code if CLI setup fails
    }
}

/**
 * Run a single headless command via CLI without interactive prompt
 */
export async function startHeadlessCli(
    clientManager: MCPClientManager,
    llmService: ILLMService,
    agentEventBus: EventEmitter,
    prompt: string
): Promise<void> {
    // Common initialization
    await _initCli(clientManager, llmService, agentEventBus);

    // Execute the task (subscriber handles output events)
    await llmService.completeTask(prompt);
}
