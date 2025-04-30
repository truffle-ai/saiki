import Anthropic from '@anthropic-ai/sdk';
import { MCPClientManager } from '../../../client/manager.js';
import { ILLMService, LLMServiceConfig } from './types.js';
import { ToolSet } from '../../types.js';
import { logger } from '../../../utils/logger.js';
import { EventEmitter } from 'events';
import { MessageManager } from '../messages/manager.js';
import { getMaxTokensForModel } from '../registry.js';
import { ImageData } from '../messages/types.js';

/**
 * Anthropic implementation of LLMService
 */
export class AnthropicService implements ILLMService {
    private anthropic: Anthropic;
    private model: string;
    private clientManager: MCPClientManager;
    private messageManager: MessageManager;
    private eventEmitter: EventEmitter;
    private maxIterations: number;

    constructor(
        clientManager: MCPClientManager,
        anthropic: Anthropic,
        agentEventBus: EventEmitter,
        messageManager: MessageManager,
        model: string,
        maxIterations: number = 10
    ) {
        this.maxIterations = maxIterations;
        this.model = model;
        this.anthropic = anthropic;
        this.clientManager = clientManager;
        this.eventEmitter = agentEventBus;
        this.messageManager = messageManager;
    }

    getEventEmitter(): EventEmitter {
        return this.eventEmitter;
    }

    getAllTools(): Promise<any> {
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
        const formattedTools = this.formatToolsForClaude(rawTools);

        logger.silly(`Formatted tools: ${JSON.stringify(formattedTools, null, 2)}`);

        // Notify thinking
        this.eventEmitter.emit('llmservice:thinking');

        let iterationCount = 0;
        let fullResponse = '';

        try {
            while (iterationCount < this.maxIterations) {
                iterationCount++;
                logger.debug(`Iteration ${iterationCount}`);

                // Compute the system prompt and pass it to message manager to avoid duplicate computation
                const context = { clientManager: this.clientManager };
                const formattedSystemPrompt =
                    await this.messageManager.getFormattedSystemPrompt(context);
                const messages = await this.messageManager.getFormattedMessages(
                    context,
                    formattedSystemPrompt
                );

                logger.debug(`Messages: ${JSON.stringify(messages, null, 2)}`);

                const response = await this.anthropic.messages.create({
                    model: this.model,
                    messages: messages,
                    system: formattedSystemPrompt,
                    tools: formattedTools,
                    max_tokens: 4096,
                });

                // Extract text content and tool uses
                let textContent = '';
                const toolUses = [];

                for (const content of response.content) {
                    if (content.type === 'text') {
                        textContent += content.text;
                    } else if (content.type === 'tool_use') {
                        toolUses.push(content);
                    }
                }

                // Process assistant message
                if (toolUses.length > 0) {
                    // Transform all tool uses into the format expected by MessageManager
                    const formattedToolCalls = toolUses.map((toolUse) => ({
                        id: toolUse.id,
                        type: 'function' as const,
                        function: {
                            name: toolUse.name,
                            arguments: JSON.stringify(toolUse.input),
                        },
                    }));

                    // Add assistant message with all tool calls
                    this.messageManager.addAssistantMessage(textContent, formattedToolCalls);
                } else {
                    // Add regular assistant message
                    this.messageManager.addAssistantMessage(textContent);
                }

                // If no tools were used, we're done
                if (toolUses.length === 0) {
                    fullResponse += textContent;
                    this.eventEmitter.emit('llmservice:response', fullResponse);
                    return fullResponse;
                }

                // If text content exists, append it to the full response
                if (textContent) {
                    fullResponse += textContent + '\n';
                }

                // Handle tool uses
                for (const toolUse of toolUses) {
                    const toolName = toolUse.name;
                    const args = toolUse.input;
                    const toolUseId = toolUse.id;

                    // Notify tool call
                    this.eventEmitter.emit('llmservice:toolCall', toolName, args);

                    // Execute tool
                    try {
                        const result = await this.clientManager.executeTool(toolName, args);

                        // Add tool result to message manager
                        this.messageManager.addToolResult(toolUseId, toolName, result);

                        // Notify tool result
                        this.eventEmitter.emit('llmservice:toolResult', toolName, result);
                    } catch (error) {
                        // Handle tool execution error
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        logger.error(`Tool execution error for ${toolName}: ${errorMessage}`);

                        // Add error as tool result
                        this.messageManager.addToolResult(toolUseId, toolName, {
                            error: errorMessage,
                        });

                        this.eventEmitter.emit('llmservice:toolResult', toolName, {
                            error: errorMessage,
                        });
                    }
                }

                // Notify thinking for next iteration
                this.eventEmitter.emit('llmservice:thinking');
            }

            // If we reached max iterations
            logger.warn(`Reached maximum iterations (${this.maxIterations}) for task.`);
            this.eventEmitter.emit('llmservice:response', fullResponse);
            return (
                fullResponse ||
                'Reached maximum number of tool call iterations without a final response.'
            );
        } catch (error) {
            // Handle API errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error in Anthropic service API call: ${errorMessage}`, { error });

            this.eventEmitter.emit(
                'llmservice:error',
                error instanceof Error ? error : new Error(errorMessage)
            );
            return `Error processing request: ${errorMessage}`;
        }
    }

    resetConversation(): void {
        // Reset the message manager
        this.messageManager.reset();
        this.eventEmitter.emit('llmservice:conversationReset');
    }

    /**
     * Get configuration information about the LLM service
     * @returns Configuration object with provider and model information
     */
    getConfig(): LLMServiceConfig {
        const configuredMaxTokens = this.messageManager.getMaxTokens();

        return {
            provider: 'anthropic',
            model: this.model,
            configuredMaxTokens: configuredMaxTokens,
            modelMaxTokens: getMaxTokensForModel('anthropic', this.model),
        };
    }

    private formatToolsForClaude(tools: ToolSet): any[] {
        return Object.entries(tools).map(([toolName, tool]) => {
            const input_schema: { type: string; properties: any; required: string[] } = {
                type: 'object',
                properties: {},
                required: [],
            };

            // Map tool parameters to JSON Schema format
            if (tool.parameters) {
                // The actual parameters structure appears to be a JSON Schema object
                const jsonSchemaParams = tool.parameters as any;

                if (jsonSchemaParams.type === 'object' && jsonSchemaParams.properties) {
                    input_schema.properties = jsonSchemaParams.properties;
                    if (Array.isArray(jsonSchemaParams.required)) {
                        input_schema.required = jsonSchemaParams.required;
                    }
                } else {
                    logger.warn(
                        `Unexpected parameters format for tool ${toolName}:`,
                        jsonSchemaParams
                    );
                }
            } else {
                // Handle case where tool might have no parameters
                logger.debug(`Tool ${toolName} has no defined parameters.`);
            }

            return {
                name: toolName,
                description: tool.description,
                input_schema: input_schema,
            };
        });
    }
}
