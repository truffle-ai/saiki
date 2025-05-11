import readline from 'readline';
import chalk from 'chalk';
import { logger } from '../../src/utils/logger.js';
import { CLISubscriber } from './cli-subscriber.js';
import { SaikiAgent } from '../../src/ai/agent/SaikiAgent.js';

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
 * @param agent The SaikiAgent instance providing access to all required services
 */
async function _initCli(agent: SaikiAgent): Promise<void> {
    // Log model and connection info
    logger.info(
        `Using model config: ${JSON.stringify(agent.llmService.getConfig(), null, 2)}`,
        null,
        'yellow'
    );
    logger.debug(`Log level: ${logger.getLevel()}`);
    logger.info(`Connected servers: ${agent.clientManager.getClients().size}`, null, 'green');
    const failedConnections = agent.clientManager.getFailedConnections();
    if (Object.keys(failedConnections).length > 0) {
        logger.error(`Failed connections: ${Object.keys(failedConnections).length}.`, null, 'red');
    }

    // Set up event management
    logger.info('Setting up CLI event subscriptions...');
    const cliSubscriber = new CLISubscriber();
    cliSubscriber.subscribe(agent.agentEventBus);

    // Load available tools
    logger.info('Loading available tools...');
    try {
        const tools = await agent.clientManager.getAllTools(); // tools variable is not used currently but kept for potential future use
        logger.info(
            `Loaded ${Object.keys(tools).length} tools from ${
                agent.clientManager.getClients().size
            } MCP servers`
        );
    } catch (error) {
        logger.error(
            `Failed to load tools: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    logger.info('CLI initialized successfully. Ready for input.', null, 'green');
}

/**
 * Run the AI CLI with the given LLM service
 * @param agent Saiki agent instance
 */
export async function startAiCli(agent: SaikiAgent) {
    try {
        // Common initialization
        await _initCli(agent);

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
                agent.resetConversation();
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
                    // Simply call run - all updates happen via events
                    await agent.run(userInput);
                } catch (error) {
                    logger.error(
                        `Error in processing input: ${error instanceof Error ? error.message : String(error)}`
                    );
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
 * @param agent The SaikiAgent instance providing access to all required services
 * @param prompt The user input to process
 */
export async function startHeadlessCli(agent: SaikiAgent, prompt: string): Promise<void> {
    // Common initialization
    await _initCli(agent);
    try {
        // Execute the task
        await agent.run(prompt);
    } catch (error) {
        logger.error(
            `Error in processing input: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1); // Exit with error code if headless execution fails
    }
}
