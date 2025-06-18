import readline from 'readline';
import chalk from 'chalk';
import { logger } from '@core/index.js';
import { SaikiAgent } from '@core/index.js';
import { EventSubscriber } from '../api/types.js';
import { AgentEventBus } from '@core/events/index.js';

/**
 * Modern CLI subscriber for inline streaming responses
 */
class CLISubscriber implements EventSubscriber {
    private isStreamingResponse = false;
    private hasStartedResponse = false;
    private hasReceivedChunks = false; // Track if we actually got chunks

    subscribe(eventBus: AgentEventBus): void {
        eventBus.on('llmservice:thinking', this.onThinking.bind(this));
        eventBus.on('llmservice:chunk', (payload) => this.onChunk(payload.content));
        eventBus.on('llmservice:toolCall', (payload) =>
            this.onToolCall(payload.toolName, payload.args)
        );
        eventBus.on('llmservice:toolResult', (payload) =>
            this.onToolResult(payload.toolName, payload.result)
        );
        eventBus.on('llmservice:response', (payload) => this.onResponse(payload.content));
        eventBus.on('llmservice:error', (payload) => this.onError(payload.error));
        eventBus.on('saiki:conversationReset', this.onConversationReset.bind(this));
    }

    cleanup(): void {
        if (this.isStreamingResponse) {
            process.stdout.write('\n');
        }
        this.isStreamingResponse = false;
        this.hasStartedResponse = false;
        this.hasReceivedChunks = false;
    }

    onThinking(): void {
        // Simple thinking indicator
        process.stdout.write(chalk.yellow('🤔 '));
    }

    onChunk(text: string): void {
        // Mark that we received chunks
        this.hasReceivedChunks = true;

        // Start AI response if not already started
        if (!this.hasStartedResponse) {
            // Clear thinking indicator and start AI response
            process.stdout.write('\r   \r'); // Clear thinking indicator
            process.stdout.write(chalk.green('🤖 ')); // AI prefix
            this.hasStartedResponse = true;
            this.isStreamingResponse = true;
        }

        // Write the chunk directly to stdout for real-time streaming
        process.stdout.write(chalk.white(text));
    }

    onToolCall(toolName: string, args: any): void {
        // Clear any ongoing streaming
        if (this.isStreamingResponse) {
            process.stdout.write('\n');
            this.isStreamingResponse = false;
        }

        console.log(chalk.cyan(`🔧 Using tool: ${toolName}`));
        if (logger.getLevel() === 'debug' || logger.getLevel() === 'verbose') {
            console.log(chalk.gray(`   Args: ${JSON.stringify(args, null, 2)}`));
        }
    }

    onToolResult(toolName: string, result: any): void {
        console.log(chalk.green(`✅ Tool completed: ${toolName}`));
        if (logger.getLevel() === 'debug' || logger.getLevel() === 'verbose') {
            const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
            const truncated =
                resultStr.length > 200 ? resultStr.substring(0, 200) + '...' : resultStr;
            console.log(chalk.gray(`   Result: ${truncated}`));
        }
    }

    onResponse(text: string): void {
        // Only display the response if we didn't receive any chunks (non-streaming response)
        if (!this.hasReceivedChunks) {
            // No streaming happened, display the full response
            console.log(chalk.green('🤖 ') + chalk.white(text));
        } else {
            // We streamed chunks, just add a newline to finish
            if (this.isStreamingResponse) {
                process.stdout.write('\n');
            }
        }

        // Reset state for next response
        this.isStreamingResponse = false;
        this.hasStartedResponse = false;
        this.hasReceivedChunks = false;
    }

    onError(error: Error): void {
        // Clear any ongoing streaming
        if (this.isStreamingResponse) {
            process.stdout.write('\n');
            this.isStreamingResponse = false;
        }

        // Reset state
        this.hasStartedResponse = false;
        this.hasReceivedChunks = false;

        console.log(chalk.red(`❌ Error: ${error.message}`));
    }

    onConversationReset(): void {
        // Clear any ongoing streaming
        if (this.isStreamingResponse) {
            process.stdout.write('\n');
            this.isStreamingResponse = false;
        }

        // Reset state
        this.hasStartedResponse = false;
        this.hasReceivedChunks = false;

        console.log(chalk.blue('🔄 Conversation cleared'));
    }
}

/**
 * Simple CLI class for streamlined chat experience
 */
export class CLI {
    private agent: SaikiAgent;
    private subscriber: CLISubscriber;
    private rl: readline.Interface;
    private isRunning = false;

    constructor(agent: SaikiAgent) {
        this.agent = agent;
        this.subscriber = new CLISubscriber();

        // Create readline interface
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.blue.bold('💬 You: '),
        });
    }

    /**
     * Start the simple CLI
     */
    async start(): Promise<void> {
        this.isRunning = true;
        await this.initialize();
        this.setupEventHandlers();

        // Show welcome message
        console.log(chalk.cyan('🚀 Saiki CLI ready! Start chatting below.'));
        console.log(chalk.gray('Commands: /help, /clear, /exit'));
        console.log('─'.repeat(50));

        this.rl.prompt();
    }

    /**
     * Initialize the CLI
     */
    private async initialize(): Promise<void> {
        // Set up event subscription
        this.subscriber.subscribe(this.agent.agentEventBus);

        // Load tools with minimal feedback
        try {
            const tools = await this.agent.clientManager.getAllTools();
            const connectedServers = this.agent.clientManager.getClients().size;

            if (connectedServers > 0) {
                console.log(
                    chalk.green(
                        `✅ Connected to ${connectedServers} servers with ${Object.keys(tools).length} tools`
                    )
                );
            } else {
                console.log(chalk.yellow(`⚠️  No MCP servers connected`));
            }

            const failedConnections = this.agent.clientManager.getFailedConnections();
            if (Object.keys(failedConnections).length > 0) {
                console.log(
                    chalk.red(
                        `❌ ${Object.keys(failedConnections).length} server connections failed`
                    )
                );
            }
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Warning: Could not load tools`));
        }
    }

    /**
     * Set up readline event handlers
     */
    private setupEventHandlers(): void {
        this.rl.on('line', async (input: string) => {
            const trimmedInput = input.trim();

            if (!trimmedInput) {
                this.rl.prompt();
                return;
            }

            // Handle commands
            if (trimmedInput.startsWith('/')) {
                await this.handleCommand(trimmedInput);
                this.rl.prompt();
                return;
            }

            // Process user input
            await this.processUserInput(trimmedInput);
            this.rl.prompt();
        });

        this.rl.on('SIGINT', () => {
            console.log(chalk.yellow('\n👋 Goodbye!'));
            this.cleanup();
            process.exit(0);
        });

        this.rl.on('close', () => {
            console.log(chalk.yellow('\n👋 Goodbye!'));
            this.cleanup();
            process.exit(0);
        });
    }

    /**
     * Process user input and get AI response
     */
    private async processUserInput(input: string): Promise<void> {
        try {
            // Process the input - the subscriber will handle streaming
            await this.agent.run(input);
        } catch (error) {
            console.log(
                chalk.red(`❌ Error: ${error instanceof Error ? error.message : String(error)}`)
            );
        }
    }

    /**
     * Handle CLI commands
     */
    private async handleCommand(command: string): Promise<void> {
        const cmd = command.toLowerCase();

        switch (cmd) {
            case '/help':
                this.showHelp();
                break;

            case '/clear':
                await this.clearConversation();
                break;

            case '/status':
                this.showStatus();
                break;

            case '/exit':
            case '/quit':
                console.log(chalk.yellow('👋 Goodbye!'));
                this.cleanup();
                process.exit(0);
                break;

            default:
                console.log(chalk.red(`Unknown command: ${command}`));
                console.log(chalk.gray('Type /help for available commands'));
        }
    }

    /**
     * Show help information
     */
    private showHelp(): void {
        console.log(chalk.bold('\n📖 Available Commands:'));
        console.log('─'.repeat(30));
        console.log(chalk.blue('/help   ') + '- Show this help message');
        console.log(chalk.blue('/clear  ') + '- Clear conversation history');
        console.log(chalk.blue('/status ') + '- Show connection status');
        console.log(chalk.blue('/exit   ') + '- Exit the CLI');
        console.log('─'.repeat(30));
        console.log(chalk.gray('Just type your message to chat with AI!'));
    }

    /**
     * Clear conversation history
     */
    private async clearConversation(): Promise<void> {
        await this.agent.resetConversation();
        console.log(chalk.blue('🔄 Conversation cleared'));
    }

    /**
     * Show connection status
     */
    private showStatus(): void {
        const clients = this.agent.clientManager.getClients();
        const failedConnections = this.agent.clientManager.getFailedConnections();

        console.log(chalk.bold('\n🔌 Status:'));
        console.log('─'.repeat(30));
        console.log(`Connected servers: ${chalk.green(clients.size)}`);

        if (Object.keys(failedConnections).length > 0) {
            console.log(`Failed connections: ${chalk.red(Object.keys(failedConnections).length)}`);
        }

        const config = this.agent.getEffectiveConfig();
        console.log(`Model: ${chalk.cyan(config.llm?.model || 'Unknown')}`);
        console.log(`Log level: ${chalk.yellow(logger.getLevel())}`);
        console.log('─'.repeat(30));
    }

    /**
     * Cleanup resources
     */
    cleanup(): void {
        this.isRunning = false;
        this.subscriber.cleanup();
        this.rl.close();
    }
}

/**
 * Start the interactive CLI mode
 */
export async function startAiCli(agent: SaikiAgent): Promise<void> {
    const cli = new CLI(agent);

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
        cli.cleanup();
        process.exit(0);
    });

    await cli.start();
}

/**
 * Run a single headless command via CLI without interactive prompt
 * @param agent The SaikiAgent instance providing access to all required services
 * @param prompt The user input to process
 */
export async function startHeadlessCli(agent: SaikiAgent, prompt: string): Promise<void> {
    // Initialize CLI components with the same simplified subscriber
    const cliSubscriber = new CLISubscriber();
    cliSubscriber.subscribe(agent.agentEventBus);

    // Log connection info
    logger.debug(`Log level: ${logger.getLevel()}`);
    logger.info(`Connected servers: ${agent.clientManager.getClients().size}`, null, 'green');
    const failedConnections = agent.clientManager.getFailedConnections();
    if (Object.keys(failedConnections).length > 0) {
        logger.error(`Failed connections: ${Object.keys(failedConnections).length}.`, null, 'red');
    }

    // Load available tools
    try {
        const tools = await agent.clientManager.getAllTools();
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

    try {
        // Execute the task
        await agent.resetConversation();
        await agent.run(prompt);
    } catch (error) {
        logger.error(
            `Error in processing input: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
    } finally {
        cliSubscriber.cleanup();
    }
}
