import readline from 'readline';
import chalk from 'chalk';
import { ClientManager } from '../src/client/manager.js';
import { logger } from '../src/utils/logger.js';
import { LLMCallbacks, LLMService } from '../src/ai/llm/types.js';
import { AgentConfig } from '../src/config/types.js';
import { initializeServices } from '../src/utils/service-initializer.js';

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
    llmService: LLMService
) {
    // Get model and provider info directly from the LLM service
    const { provider, model } = llmService.getConfig();
    logger.info(`Using ${provider} model: ${model}`, null, 'yellow');

    logger.debug(`Log level: ${logger.getLevel()}`);
    logger.info(`Connected servers: ${clientManager.getClients().size}`, null, 'green');
    logger.error(
        `Failed connections: ${Object.keys(clientManager.getFailedConnections()).length}. Ignoring in lenient mode.\n`,
        null,
        'red'
    );

    try {
        // Get available tools from all connected servers
        logger.info('Loading available tools...');

        // Get all tools from the manager
        const tools = await clientManager.getAllTools();

        logger.debug(`Received tools: ${tools.map((t) => t.name)}`);

        // Update system context with available tools
        llmService.updateSystemContext(tools);

        logger.info(
            `Loaded ${tools.length} tools from ${clientManager.getClients().size} tool providers\n`
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
                    rl.close();
                    process.exit(0);
                    break;
                }

                if (userInput.toLowerCase() === 'clear') {
                    llmService.resetConversation();
                    logger.info('Conversation history cleared.');
                    continue;
                }

                try {
                    // Create callbacks for progress indication (without spinner)
                    const callbacks: LLMCallbacks = {
                        onThinking: () => {
                            logger.info('AI thinking...');
                        },
                        onToolCall: (toolName, args) => {
                            logger.toolCall(toolName, args);
                        },
                        onToolResult: (toolName, result) => {
                            logger.toolResult(result);
                        },
                        onResponse: (response) => {
                            logger.displayAIResponse({ content: response });
                        },
                    };

                    // Use the high-level method to handle the entire interaction
                    await llmService.completeTask(userInput, callbacks);
                } catch (error) {
                    logger.error(`Error in processing input: ${error.message}`);
                }
            }
        } finally {
            rl.close();
        }
    } catch (error) {
        logger.error(`Error during initialization: ${error.message}`);
    }
}
