import Anthropic from '@anthropic-ai/sdk';
import { ClientManager } from '../../../client/manager.js';
import { ILLMService } from '../types.js';
import { ToolSet } from '../../types.js';
import { logger } from '../../../utils/logger.js';
import { EventEmitter } from 'events';
import { MessageManager } from '../message/manager.js';
import { AnthropicFormatter } from '../message/formatters/anthropic.js';

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
        
        // Initialize MessageManager with AnthropicFormatter
        const formatter = new AnthropicFormatter();
        this.messageManager = new MessageManager(formatter, systemPrompt);
        
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
                        
                        // Add error as tool result
                        this.messageManager.addToolResult(toolUseId, toolName, { error: errorMessage });

                        this.eventEmitter.emit('toolResult', toolName, { error: errorMessage });
                    }
                }

                // Notify thinking for next iteration
                this.eventEmitter.emit('thinking');
            }

            // If we reached max iterations
            this.eventEmitter.emit('response', fullResponse);
            return (
                fullResponse ||
                'Reached maximum number of tool call iterations without a final response.'
            );
        } catch (error) {
            // Handle API errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error in Anthropic service: ${errorMessage}`);

            this.eventEmitter.emit(
                'error',
                error instanceof Error ? error : new Error(errorMessage)
            );
            return `Error: ${errorMessage}`;
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
        return {
            provider: 'anthropic',
            model: this.model,
        };
    }

    // needs refactor
    private formatToolsForClaude(tools: ToolSet): any[] {
        // Convert the ToolSet object to an array of tools
        // ToolSet is an object where keys are tool names and values are Tool objects
        return Object.entries(tools).map(([toolName, tool]) => {
            // Create input_schema structure (same as parameters in OpenAI)
            const input_schema = {
                type: 'object',
                properties: {},
                required: [],
            };

            // Map tool parameters to JSON Schema format
            if (tool.parameters) {
                // The actual parameters structure appears to be a JSON Schema object
                // which doesn't match the simple ToolParameters interface
                const jsonSchemaParams = tool.parameters as any;

                if (
                    jsonSchemaParams.properties &&
                    typeof jsonSchemaParams.properties === 'object'
                ) {
                    // Extract parameters from the properties object
                    for (const [name, paramRaw] of Object.entries(jsonSchemaParams.properties)) {
                        // Type assertion to make TypeScript happy
                        const param = paramRaw as any;
                        let paramType = param.type || 'string';
                        let paramEnum = undefined;

                        // Handle type conversion
                        if (typeof paramType === 'string') {
                            if (paramType.includes('number')) paramType = 'number';
                            else if (paramType.includes('boolean')) paramType = 'boolean';
                            else if (paramType.includes('array')) paramType = 'array';
                            else if (paramType.includes('enum')) {
                                paramType = 'string';
                                if (param.enum && Array.isArray(param.enum)) {
                                    paramEnum = param.enum;
                                }
                            } else paramType = 'string';
                        }

                        // Add to input_schema properties
                        (input_schema.properties as any)[name] = {
                            type: paramType,
                            description: param.description || `Parameter ${name}`,
                        };

                        // Add enum values if present
                        if (paramEnum) {
                            (input_schema.properties as any)[name].enum = paramEnum;
                        }

                        // Check if required
                        if (
                            jsonSchemaParams.required &&
                            Array.isArray(jsonSchemaParams.required) &&
                            jsonSchemaParams.required.includes(name)
                        ) {
                            (input_schema.required as string[]).push(name);
                        }
                    }
                }
            }

            // Format the tool for Claude
            return {
                name: toolName,
                description: tool.description || `Execute the ${toolName} tool`,
                input_schema,
            };
        });
    }
}
