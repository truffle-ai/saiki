import readline from 'readline';
import chalk from 'chalk';
import { ClientManager } from '../src/client/manager.js';
import { logger } from '../src/utils/logger.js';
import { LLMCallbacks, ILLMService } from '../src/ai/llm/types.js';
import { AgentConfig } from '../src/config/types.js';
import { initializeServices } from '../src/utils/service-initializer.js';
import boxen from 'boxen';

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
    // const { provider, model } = llmService.getConfig();
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
        // Get available tools from all connected servers
        logger.info('Loading available tools...');

        // Get all tools from the LLM service
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
                    let accumulatedResponse = '';
                    let currentLines = 0;
                    // Create callbacks for progress indication (without spinner)
                    const callbacks: LLMCallbacks = {
                        // onChunk: (text: string) => {
                        //     process.stdout.write(text);
                        // },
                        onChunk: (text: string) => {
                            // Append the new chunk to the accumulated response
                            accumulatedResponse += text;
                    
                            // Generate the new box
                            const box = boxen(chalk.white(accumulatedResponse), {
                                padding: 1,
                                borderColor: 'yellow',
                                title: '🤖 AI Response',
                                titleAlignment: 'center',
                            });
                            const newLines = box.split('\n').length;
                    
                            // Move cursor up to the start of the previous box (if it exists)
                            if (currentLines > 0) {
                                process.stdout.write(`\x1b[${currentLines}A`); // Move up currentLines
                            }
                    
                            // Print the new box (this overwrites the old one)
                            process.stdout.write(box);
                    
                            // Update the line count
                            currentLines = newLines;
                    
                            // Move cursor to the end of the box to allow logs below
                            process.stdout.write('\n');
                        },
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
