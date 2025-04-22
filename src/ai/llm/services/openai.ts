import OpenAI from 'openai';
import { ClientManager } from '../../../client/manager.js';
import { ILLMService } from './types.js';
import { ToolSet } from '../../types.js';
import { logger } from '../../../utils/logger.js';
import { EventEmitter } from 'events';
import { MessageManager } from '../messages/manager.js';
import { OpenAIMessageFormatter } from '../messages/formatters/openai.js';
import { createTokenizer } from '../tokenizer/factory.js';
import { getMaxTokens } from '../tokenizer/utils.js';
import { countMessagesTokens } from '../messages/utils.js';
import { ITokenizer } from '../tokenizer/types.js';
import { ImageData } from '../messages/types.js';

// System prompt constants

const DETAILED_SYSTEM_PROMPT_TEMPLATE = `You are an AI assistant with access to MCP tools. Your job is to help users accomplish their tasks by calling appropriate tools.


## Follow these guidelines when using tools:
1. Use tools whenever they can help complete the user's request. Do not ever say you don't have access to tools, read your tools completely and try to use them.
2. You can call multiple tools in sequence to solve complex problems.
3. After each tool returns a result, analyze the result carefully to determine next steps.
4. If the result indicates you need additional information, call another tool to get that information.
5. Continue this process until you have all the information needed to fulfill the user's request.
6. Be concise in your responses, focusing on the task at hand.
7. If a tool returns an error, try a different approach or ask the user for clarification.

Remember: You can use multiple tool calls in a sequence to solve multi-step problems.

## Available tools:
TOOL_DESCRIPTIONS`;

/**
 * OpenAI implementation of LLMService
 */
export class OpenAIService implements ILLMService {
    private openai: OpenAI;
    private model: string;
    private clientManager: ClientManager;
    private messageManager: MessageManager;
    private eventEmitter: EventEmitter;

    constructor(
        clientManager: ClientManager,
        systemPrompt: string,
        apiKey: string,
        agentEventBus: EventEmitter,
        model?: string
    ) {
        this.model = model || 'gpt-4o-mini';
        this.openai = new OpenAI({ apiKey });
        this.clientManager = clientManager;

        // Initialize Formatter, Tokenizer, and get Max Tokens
        const formatter = new OpenAIMessageFormatter();
        const tokenizer = createTokenizer('openai', this.model);
        const rawMaxTokens = getMaxTokens('openai', this.model);
        const maxTokensWithMargin = Math.floor(rawMaxTokens * 0.9);

        // Initialize MessageManager with OpenAIFormatter
        this.messageManager = new MessageManager(
            formatter,
            systemPrompt || DETAILED_SYSTEM_PROMPT_TEMPLATE,
            maxTokensWithMargin,
            tokenizer
        );

        this.eventEmitter = agentEventBus;
    }

    getEventEmitter(): EventEmitter {
        return this.eventEmitter;
    }

    getAllTools(): Promise<ToolSet> {
        return this.clientManager.getAllTools();
    }

    updateSystemContext(newSystemPrompt: string): void {
        this.messageManager.setSystemPrompt(newSystemPrompt);
    }

    async completeTask(userInput: string, imageData?: ImageData): Promise<string> {
        // Add user message with optional image data
        this.messageManager.addUserMessage(userInput, imageData);

        // Get all tools
        const rawTools = await this.clientManager.getAllTools();
        const formattedTools = this.formatToolsForOpenAI(rawTools);

        logger.silly(`Formatted tools: ${JSON.stringify(formattedTools, null, 2)}`);

        // Notify thinking
        this.eventEmitter.emit('llmservice:thinking');

        // Maximum number of tool use iterations
        const MAX_ITERATIONS = 10;
        let iterationCount = 0;

        try {
            while (iterationCount < MAX_ITERATIONS) {
                iterationCount++;

                // Attempt to get a response, with retry logic
                const message = await this.getAIResponseWithRetries(formattedTools);

                // If there are no tool calls, we're done
                if (!message.tool_calls || message.tool_calls.length === 0) {
                    const responseText = message.content || '';

                    // Add assistant message to history
                    this.messageManager.addAssistantMessage(responseText);

                    this.eventEmitter.emit('llmservice:response', responseText);
                    return responseText;
                }

                // Add assistant message with tool calls to history
                this.messageManager.addAssistantMessage(message.content, message.tool_calls);

                // Handle tool calls
                for (const toolCall of message.tool_calls) {
                    logger.debug(`Tool call initiated: ${JSON.stringify(toolCall, null, 2)}`);
                    const toolName = toolCall.function.name;
                    let args: any = {};

                    try {
                        args = JSON.parse(toolCall.function.arguments);
                    } catch (e) {
                        logger.error(`Error parsing arguments for ${toolName}:`, e);
                        this.messageManager.addToolResult(toolCall.id, toolName, {
                            error: `Failed to parse arguments: ${e}`,
                        });
                        continue;
                    }

                    // Notify tool call
                    this.eventEmitter.emit('llmservice:toolCall', toolName, args);

                    // Execute tool
                    try {
                        const result = await this.clientManager.executeTool(toolName, args);

                        // Add tool result to message manager
                        this.messageManager.addToolResult(toolCall.id, toolName, result);

                        // Notify tool result
                        this.eventEmitter.emit('llmservice:toolResult', toolName, result);
                    } catch (error) {
                        // Handle tool execution error
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        logger.error(`Tool execution error for ${toolName}: ${errorMessage}`);

                        // Add error as tool result
                        this.messageManager.addToolResult(toolCall.id, toolName, {
                            error: errorMessage,
                        });

                        this.eventEmitter.emit('llmservice:toolResult', toolName, { error: errorMessage });
                    }
                }

                // Notify thinking for next iteration
                this.eventEmitter.emit('llmservice:thinking');
            }

            // If we reached max iterations, return a message
            logger.warn(`Reached maximum iterations (${MAX_ITERATIONS}) for task.`);
            const finalResponse = 'Task completed but reached maximum tool call iterations.';
            this.messageManager.addAssistantMessage(finalResponse);
            this.eventEmitter.emit('llmservice:response', finalResponse);
            return finalResponse;
        } catch (error) {
            // Handle API errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error in OpenAI service API call: ${errorMessage}`, { error });

            this.eventEmitter.emit(
                'llmservice:error',
                error instanceof Error ? error : new Error(errorMessage)
            );
            return `Error processing request: ${errorMessage}`;
        }
    }

    resetConversation(): void {
        // Reset message manager (keeps the system prompt)
        this.messageManager.reset();
        this.eventEmitter.emit('llmservice:conversationReset');
    }

    /**
     * Get configuration information about the LLM service
     * @returns Configuration object with provider and model information
     */
    getConfig(): { provider: string; model: string; [key: string]: any } {
        const configuredMaxTokens = (this.messageManager as any).maxTokens;
        return {
            provider: 'openai',
            model: this.model,
            configuredMaxTokens: configuredMaxTokens,
            modelMaxTokens: getMaxTokens('openai', this.model),
        };
    }

    // Helper methods
    private async getAIResponseWithRetries(tools: any[]): Promise<any> {
        let attempts = 0;
        const MAX_ATTEMPTS = 3;

        // Add a log of tools size
        logger.debug(`Tools size in getAIResponseWithRetries: ${tools.length}`);

        while (attempts < MAX_ATTEMPTS) {
            attempts++;

            try {
                // Get formatted messages from message manager
                const formattedMessages = this.messageManager.getFormattedMessages();

                logger.silly(
                    `Message history (potentially compressed) in getAIResponseWithRetries: ${JSON.stringify(formattedMessages, null, 2)}`
                );

                // Directly count tokens and log
                const currentTokens = this.messageManager.getTokenCount();
                logger.debug(`Estimated tokens being sent to OpenAI: ${currentTokens}`);

                // Call OpenAI API
                const response = await this.openai.chat.completions.create({
                    model: this.model,
                    messages: formattedMessages,
                    tools: attempts === 1 ? tools : [], // Only offer tools on first attempt
                    tool_choice: attempts === 1 ? 'auto' : 'none', // Disable tool choice on retry
                });

                logger.silly(
                    'OPENAI CHAT COMPLETION RESPONSE: ',
                    JSON.stringify(response, null, 2)
                );

                // Get the response message
                const message = response.choices[0].message;
                if (!message) {
                    throw new Error('Received empty message from OpenAI API');
                }
                return message;
            } catch (error) {
                const apiError = error as any;
                logger.error(
                    `Error in OpenAI API call (Attempt ${attempts}/${MAX_ATTEMPTS}): ${apiError.message || JSON.stringify(apiError, null, 2)}`,
                    { status: apiError.status, headers: apiError.headers }
                );

                if (apiError.status === 400 && apiError.error?.code === 'context_length_exceeded') {
                    logger.warn(
                        `Context length exceeded. MessageManager compression might not be sufficient. Error details: ${JSON.stringify(apiError.error)}`
                    );
                }

                if (attempts >= MAX_ATTEMPTS) {
                    logger.error(
                        `Failed to get response from OpenAI after ${MAX_ATTEMPTS} attempts.`
                    );
                    throw error;
                }

                await new Promise((resolve) => setTimeout(resolve, 500 * attempts));
            }
        }

        throw new Error('Failed to get response after maximum retry attempts');
    }

    private formatToolsForOpenAI(tools: ToolSet): any[] {
        // Keep the existing implementation
        // Convert the ToolSet object to an array of tools in OpenAI's format
        return Object.entries(tools).map(([name, tool]) => {
            return {
                type: 'function',
                function: {
                    name,
                    description: tool.description,
                    parameters: tool.parameters,
                },
            };
        });
    }
}
