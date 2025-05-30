import Anthropic from '@anthropic-ai/sdk';
import { MCPClientManager } from '../../../client/manager.js';
import { ILLMService, LLMServiceConfig } from './types.js';
import { ToolSet } from '../../types.js';
import { logger } from '../../../logger/index.js';
import { EventEmitter } from 'events';
import { MessageManager } from '../messages/manager.js';
import { getMaxTokensForModel } from '../registry.js';
import { ImageData } from '../messages/types.js';
import type { SessionEventBus } from '../../../events/index.js';

/**
 * Anthropic implementation of LLMService
 * Not actively maintained, so might be buggy or outdated
 */
export class AnthropicService implements ILLMService {
    private anthropic: Anthropic;
    private model: string;
    private clientManager: MCPClientManager;
    private messageManager: MessageManager;
    private sessionEventBus: SessionEventBus;
    private maxIterations: number;

    constructor(
        clientManager: MCPClientManager,
        anthropic: Anthropic,
        sessionEventBus: SessionEventBus,
        messageManager: MessageManager,
        model: string,
        maxIterations: number = 10
    ) {
        this.maxIterations = maxIterations;
        this.model = model;
        this.anthropic = anthropic;
        this.clientManager = clientManager;
        this.sessionEventBus = sessionEventBus;
        this.messageManager = messageManager;
    }

    getAllTools(): Promise<any> {
        return this.clientManager.getAllTools();
    }

    async completeTask(userInput: string, imageData?: ImageData): Promise<string> {
        // Add user message with optional image data
        await this.messageManager.addUserMessage(userInput, imageData);

        // Get all tools
        const rawTools = await this.clientManager.getAllTools();
        const formattedTools = this.formatToolsForClaude(rawTools);

        logger.silly(`Formatted tools: ${JSON.stringify(formattedTools, null, 2)}`);

        // Notify thinking
        this.sessionEventBus.emit('llmservice:thinking');

        let iterationCount = 0;
        let fullResponse = '';
        let totalTokens = 0;

        try {
            while (iterationCount < this.maxIterations) {
                iterationCount++;
                logger.debug(`Iteration ${iterationCount}`);

                // Use the new method that implements proper flow: get system prompt, compress history, format messages
                const context = { clientManager: this.clientManager };
                const { formattedMessages, systemPrompt, tokensUsed } =
                    await this.messageManager.getFormattedMessagesWithCompression(context);

                // For Anthropic, we need to get the formatted system prompt separately
                const formattedSystemPrompt =
                    await this.messageManager.getFormattedSystemPrompt(context);

                logger.debug(`Messages: ${JSON.stringify(formattedMessages, null, 2)}`);
                logger.debug(`Estimated tokens being sent to Anthropic: ${tokensUsed}`);

                const response = await this.anthropic.messages.create({
                    model: this.model,
                    messages: formattedMessages,
                    system: formattedSystemPrompt,
                    tools: formattedTools,
                    max_tokens: 4096,
                });

                // Track token usage
                if (response.usage) {
                    totalTokens += response.usage.input_tokens + response.usage.output_tokens;
                }

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
                    await this.messageManager.addAssistantMessage(textContent, formattedToolCalls);
                } else {
                    // Add regular assistant message
                    await this.messageManager.addAssistantMessage(textContent);
                }

                // If no tools were used, we're done
                if (toolUses.length === 0) {
                    fullResponse += textContent;

                    // Update MessageManager with actual token count for hybrid approach
                    if (totalTokens > 0) {
                        this.messageManager.updateActualTokenCount(totalTokens);
                    }

                    this.sessionEventBus.emit('llmservice:response', {
                        content: fullResponse,
                        model: this.model,
                        tokenCount: totalTokens > 0 ? totalTokens : undefined,
                    });
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
                    this.sessionEventBus.emit('llmservice:toolCall', {
                        toolName,
                        args,
                        callId: toolUseId,
                    });

                    // Execute tool
                    try {
                        const result = await this.clientManager.executeTool(toolName, args);

                        // Add tool result to message manager
                        await this.messageManager.addToolResult(toolUseId, toolName, result);

                        // Notify tool result
                        this.sessionEventBus.emit('llmservice:toolResult', {
                            toolName,
                            result,
                            callId: toolUseId,
                            success: true,
                        });
                    } catch (error) {
                        // Handle tool execution error
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        logger.error(`Tool execution error for ${toolName}: ${errorMessage}`);

                        // Add error as tool result
                        await this.messageManager.addToolResult(toolUseId, toolName, {
                            error: errorMessage,
                        });

                        this.sessionEventBus.emit('llmservice:toolResult', {
                            toolName,
                            result: { error: errorMessage },
                            callId: toolUseId,
                            success: false,
                        });
                    }
                }

                // Notify thinking for next iteration
                this.sessionEventBus.emit('llmservice:thinking');
            }

            // If we reached max iterations
            logger.warn(`Reached maximum iterations (${this.maxIterations}) for task.`);

            // Update MessageManager with actual token count for hybrid approach
            if (totalTokens > 0) {
                this.messageManager.updateActualTokenCount(totalTokens);
            }

            this.sessionEventBus.emit('llmservice:response', {
                content: fullResponse,
                model: this.model,
                tokenCount: totalTokens > 0 ? totalTokens : undefined,
            });
            return (
                fullResponse ||
                'Reached maximum number of tool call iterations without a final response.'
            );
        } catch (error) {
            // Handle API errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error in Anthropic service API call: ${errorMessage}`, { error });

            this.sessionEventBus.emit('llmservice:error', {
                error: error instanceof Error ? error : new Error(errorMessage),
                context: 'Anthropic API call',
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
        const modelMaxTokens = getMaxTokensForModel('anthropic', this.model);

        return {
            router: 'in-built',
            provider: 'anthropic',
            model: this.model,
            configuredMaxTokens: configuredMaxTokens,
            modelMaxTokens,
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
