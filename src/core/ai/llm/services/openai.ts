import OpenAI from 'openai';
import { MCPClientManager } from '../../../client/manager.js';
import { ILLMService, LLMServiceConfig } from './types.js';
import { ToolSet } from '../../types.js';
import { logger } from '../../../logger/index.js';
import { MessageManager } from '../messages/manager.js';
import { getMaxTokensForModel } from '../registry.js';
import { ImageData } from '../messages/types.js';
import { ModelNotFoundError } from '../errors.js';
import type { TypedEventEmitter } from '../../../events/index.js';

/**
 * OpenAI implementation of LLMService
 */
export class OpenAIService implements ILLMService {
    private openai: OpenAI;
    private model: string;
    private clientManager: MCPClientManager;
    private messageManager: MessageManager;
    private eventEmitter: TypedEventEmitter;
    private maxIterations: number;

    constructor(
        clientManager: MCPClientManager,
        openai: OpenAI,
        agentEventBus: TypedEventEmitter,
        messageManager: MessageManager,
        model: string,
        maxIterations: number = 10
    ) {
        this.maxIterations = maxIterations;
        this.model = model;
        this.openai = openai;
        this.clientManager = clientManager;
        this.eventEmitter = agentEventBus;
        this.messageManager = messageManager;
    }

    getAllTools(): Promise<ToolSet> {
        return this.clientManager.getAllTools();
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

        let iterationCount = 0;

        try {
            while (iterationCount < this.maxIterations) {
                iterationCount++;

                // Attempt to get a response, with retry logic
                const message = await this.getAIResponseWithRetries(formattedTools);

                // If there are no tool calls, we're done
                if (!message.tool_calls || message.tool_calls.length === 0) {
                    const responseText = message.content || '';

                    // Add assistant message to history
                    this.messageManager.addAssistantMessage(responseText);

                    // Emit final response
                    this.eventEmitter.emit('llmservice:response', {
                        content: responseText,
                        model: this.model,
                    });
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
                    this.eventEmitter.emit('llmservice:toolCall', {
                        toolName,
                        args,
                        callId: toolCall.id,
                    });

                    // Execute tool
                    try {
                        const result = await this.clientManager.executeTool(toolName, args);

                        // Add tool result to message manager
                        this.messageManager.addToolResult(toolCall.id, toolName, result);

                        // Notify tool result
                        this.eventEmitter.emit('llmservice:toolResult', {
                            toolName,
                            result,
                            callId: toolCall.id,
                            success: true,
                        });
                    } catch (error) {
                        // Handle tool execution error
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        logger.error(`Tool execution error for ${toolName}: ${errorMessage}`);

                        // Add error as tool result
                        this.messageManager.addToolResult(toolCall.id, toolName, {
                            error: errorMessage,
                        });

                        this.eventEmitter.emit('llmservice:toolResult', {
                            toolName,
                            result: { error: errorMessage },
                            callId: toolCall.id,
                            success: false,
                        });
                    }
                }

                // Notify thinking for next iteration
                this.eventEmitter.emit('llmservice:thinking');
            }

            // If we reached max iterations, return a message
            logger.warn(`Reached maximum iterations (${this.maxIterations}) for task.`);
            const finalResponse = 'Task completed but reached maximum tool call iterations.';
            this.messageManager.addAssistantMessage(finalResponse);

            // Emit final response
            this.eventEmitter.emit('llmservice:response', {
                content: finalResponse,
                model: this.model,
            });
            return finalResponse;
        } catch (error) {
            // Handle API errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error in OpenAI service API call: ${errorMessage}`, { error });
            // Hint for token overflow
            logger.warn(
                `If this error is due to token overflow, consider configuring 'maxTokens' in your LLMConfig.`
            );
            this.eventEmitter.emit('llmservice:error', {
                error: error instanceof Error ? error : new Error(errorMessage),
                context: 'OpenAI API call',
                recoverable: false,
            });
            return `Error processing request: ${errorMessage}`;
        }
    }

    /**
     * Get configuration information about the LLM service
     * @returns Configuration object with provider and model information
     */
    getConfig(): LLMServiceConfig {
        const configuredMaxTokens = this.messageManager.getMaxTokens();
        let modelMaxTokens: number;

        // Fetching max tokens from LLM registry - default to configured max tokens if not found
        // Max tokens may not be found if the model is supplied by user
        try {
            modelMaxTokens = getMaxTokensForModel('openai', this.model);
        } catch (error) {
            // if the model is not found in the LLM registry, log and default to configured max tokens
            if (error instanceof ModelNotFoundError) {
                modelMaxTokens = configuredMaxTokens;
                logger.debug(
                    `Could not find model ${this.model} in LLM registry to get max tokens. Using configured max tokens: ${configuredMaxTokens}.`
                );
                // for any other error, throw
            } else {
                throw error;
            }
        }

        return {
            router: 'in-built',
            provider: 'openai',
            model: this.model,
            configuredMaxTokens,
            modelMaxTokens,
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
                const formattedMessages = await this.messageManager.getFormattedMessages({
                    clientManager: this.clientManager,
                });

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
