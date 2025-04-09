import Anthropic from '@anthropic-ai/sdk';
import { ClientManager } from '../../../client/manager.js';
import { ILLMService } from './types.js';
import { ToolSet } from '../../types.js';
import { logger } from '../../../utils/logger.js';
import { EventEmitter } from 'events';
import { MessageManager } from '../message/manager.js';
import { AnthropicFormatter } from '../message/formatters/anthropic.js';
import { TokenizerFactory } from '../tokenizer/factory.js';
import { getMaxTokens } from '../tokenizer/utils.js';
import { LLMCallbacks } from '../types.js';

/**
 * Anthropic implementation of LLMService
 */
export class AnthropicService implements ILLMService {
    private anthropic: Anthropic;
    private model: string;
    private clientManager: ClientManager;
    private messageManager: MessageManager;
    private eventEmitter: EventEmitter;

    constructor(
        clientManager: ClientManager,
        systemPrompt: string,
        apiKey: string,
        model?: string
    ) {
        this.model = model || 'claude-3-7-sonnet-20250219';
        this.anthropic = new Anthropic({ apiKey });
        this.clientManager = clientManager;
        
        const formatter = new AnthropicFormatter();
        
        const tokenizer = TokenizerFactory.createTokenizer('anthropic', this.model);

        const rawMaxTokens = getMaxTokens('anthropic', this.model);
        const maxTokensWithMargin = Math.floor(rawMaxTokens * 0.9); 

        this.messageManager = new MessageManager(
            formatter, 
            systemPrompt, 
            maxTokensWithMargin, 
            tokenizer
        );
        
        this.eventEmitter = new EventEmitter();
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

    async completeTask(userInput: string): Promise<string> {
        // Add user message to message manager
        this.messageManager.addUserMessage(userInput);

        // Get all tools
        const rawTools = await this.clientManager.getAllTools();
        const formattedTools = this.formatToolsForClaude(rawTools);

        logger.silly(`Formatted tools: ${JSON.stringify(formattedTools, null, 2)}`);

        // Notify thinking
        this.eventEmitter.emit('thinking');

        // Maximum number of tool use iterations
        const MAX_ITERATIONS = 10;
        let iterationCount = 0;
        let fullResponse = '';

        try {
            while (iterationCount < MAX_ITERATIONS) {
                iterationCount++;
                logger.debug(`Iteration ${iterationCount}`);

                // Get formatted messages from message manager
                const messages = this.messageManager.getFormattedMessages();
                const systemPrompt = this.messageManager.getFormattedSystemPrompt();
                
                logger.debug(`Messages: ${JSON.stringify(messages, null, 2)}`);

                const response = await this.anthropic.messages.create({
                    model: this.model,
                    messages: messages,
                    system: systemPrompt,
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
                    const formattedToolCalls = toolUses.map(toolUse => ({
                        id: toolUse.id,
                        type: 'function' as const,
                        function: {
                            name: toolUse.name,
                            arguments: JSON.stringify(toolUse.input)
                        }
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
                    this.eventEmitter.emit('response', fullResponse);
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
                    this.eventEmitter.emit('toolCall', toolName, args);

                    // Execute tool
                    try {
                        const result = await this.clientManager.executeTool(toolName, args);
                        
                        // Add tool result to message manager
                        this.messageManager.addToolResult(toolUseId, toolName, result);

                        // Notify tool result
                        this.eventEmitter.emit('toolResult', toolName, result);
                    } catch (error) {
                        // Handle tool execution error
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        logger.error(`Tool execution error for ${toolName}: ${errorMessage}`);
                        
                        // Add error as tool result
                        this.messageManager.addToolResult(toolUseId, toolName, { error: errorMessage });

                        this.eventEmitter.emit('toolResult', toolName, { error: errorMessage });
                    }
                }

                // Notify thinking for next iteration
                this.eventEmitter.emit('thinking');
            }

            // If we reached max iterations
            logger.warn(`Reached maximum iterations (${MAX_ITERATIONS}) for task.`);
            this.eventEmitter.emit('response', fullResponse);
            return (
                fullResponse ||
                'Reached maximum number of tool call iterations without a final response.'
            );
        } catch (error) {
            // Handle API errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error in Anthropic service API call: ${errorMessage}`, { error });

            this.eventEmitter.emit(
                'error',
                error instanceof Error ? error : new Error(errorMessage)
            );
            return `Error processing request: ${errorMessage}`;
        }
    }

    resetConversation(): void {
        // Reset the message manager
        this.messageManager.reset();
        this.eventEmitter.emit('conversationReset');
    }

    /**
     * Get configuration information about the LLM service
     * @returns Configuration object with provider and model information
     */
    getConfig(): { provider: string; model: string; [key: string]: any } {
        const configuredMaxTokens = (this.messageManager as any).maxTokens;
        return {
            provider: 'anthropic',
            model: this.model,
            configuredMaxTokens: configuredMaxTokens,
            modelMaxTokens: getMaxTokens('anthropic', this.model)
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
                    logger.warn(`Unexpected parameters format for tool ${toolName}:`, jsonSchemaParams);
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
