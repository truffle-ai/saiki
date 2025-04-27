import readline from 'readline';
import chalk from 'chalk';
import { ClientManager } from '../../src/client/manager.js'; // Adjusted path
import { logger } from '../../src/utils/logger.js'; // Adjusted path
import { ILLMService } from '../../src/ai/llm/services/types.js'; // Adjusted path
import { CLISubscriber } from './cli-subscriber.js'; // Now points to the new location
import { EventEmitter } from 'events';
/**
 * Run the AI CLI with the given LLM service
 * @param clientManager Client manager with registered tool providers
 * @param llmService LLM service implementation
 */
export async function runAiCli(clientManager: ClientManager, llmService: ILLMService, agentEventBus: EventEmitter) {
    // Get model and provider info directly from the LLM service
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

    try {
        // Set up event management
        logger.info('Setting up CLI event subscriptions...');
        const cliSubscriber = new CLISubscriber();
        agentEventBus.on('llmservice:thinking', cliSubscriber.onThinking.bind(cliSubscriber));
        agentEventBus.on('llmservice:chunk', cliSubscriber.onChunk.bind(cliSubscriber));
        agentEventBus.on('llmservice:toolCall', cliSubscriber.onToolCall.bind(cliSubscriber));
        agentEventBus.on('llmservice:toolResult', cliSubscriber.onToolResult.bind(cliSubscriber));
        agentEventBus.on('llmservice:response', cliSubscriber.onResponse.bind(cliSubscriber));
        agentEventBus.on('llmservice:error', cliSubscriber.onError.bind(cliSubscriber));
        agentEventBus.on('llmservice:conversationReset', cliSubscriber.onConversationReset.bind(cliSubscriber));

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

        try {
            while (true) {
                const userInput = await promptUser();

                if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
                    logger.warn('Exiting AI CLI. Goodbye!');
                    rl.close();
                    // Use process.exit(0) for a clean exit in CLI mode
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
export async function runHeadlessCli(
    clientManager: ClientManager,
    llmService: ILLMService,
    agentEventBus: EventEmitter,
    prompt: string
): Promise<void> {
    // Print basic model and connection info
    logger.info(`Using model config: ${JSON.stringify(llmService.getConfig(), null, 2)}`, null, 'yellow');
    logger.debug(`Log level: ${logger.getLevel()}`);
    logger.info(`Connected servers: ${clientManager.getClients().size}`, null, 'green');
    const failedConnections = clientManager.getFailedConnections();
    if (Object.keys(failedConnections).length > 0) {
        logger.error(`Failed connections: ${Object.keys(failedConnections).length}.`, null, 'red');
    }

    // Subscribe to events for streaming output
    logger.info('Setting up CLI event subscriptions...');
    const cliSubscriber = new CLISubscriber();
    agentEventBus.on('llmservice:thinking', cliSubscriber.onThinking.bind(cliSubscriber));
    agentEventBus.on('llmservice:chunk', cliSubscriber.onChunk.bind(cliSubscriber));
    agentEventBus.on('llmservice:toolCall', cliSubscriber.onToolCall.bind(cliSubscriber));
    agentEventBus.on('llmservice:toolResult', cliSubscriber.onToolResult.bind(cliSubscriber));
    agentEventBus.on('llmservice:response', cliSubscriber.onResponse.bind(cliSubscriber));
    agentEventBus.on('llmservice:error', cliSubscriber.onError.bind(cliSubscriber));
    agentEventBus.on('llmservice:conversationReset', cliSubscriber.onConversationReset.bind(cliSubscriber));

    // Load tools and confirm initialization
    logger.info('Loading available tools...');
    const tools = await clientManager.getAllTools();
    logger.info(
        `Loaded ${Object.keys(tools).length} tools from ${clientManager.getClients().size} MCP servers\n`
    );
    logger.info('AI Agent initialized successfully!', null, 'green');

    // Execute the task (subscriber handles output events)
    await llmService.completeTask(prompt);
}
