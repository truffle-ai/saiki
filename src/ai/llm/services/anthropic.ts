import Anthropic from '@anthropic-ai/sdk';
import { ClientManager } from '../../../client/manager.js';
import { ILLMService } from './types.js';
import { ToolSet } from '../../types.js';
import { logger } from '../../../utils/logger.js';
import { EventEmitter } from 'events';
import { MessageManager } from '../messages/manager.js';
import { AnthropicMessageFormatter } from '../messages/formatters/anthropic.js';
import { createTokenizer } from '../tokenizer/factory.js';
import { getMaxTokens } from '../tokenizer/utils.js';
import { SystemPromptBuilder } from '../../systemPrompt/SystemPromptBuilder.js';
import { PromptContext } from '../../systemPrompt/types.js';
import type { ContentBlock, TextBlock } from '@anthropic-ai/sdk/resources/messages';

/**
 * Anthropic implementation of LLMService
 */
export class AnthropicService implements ILLMService {
    private anthropic: Anthropic;
    private model: string;
    private clientManager: ClientManager;
    private messageManager: MessageManager;
    private eventEmitter: EventEmitter;
    private systemPromptBuilder?: SystemPromptBuilder;
    private promptContext?: PromptContext;

    constructor(
        clientManager: ClientManager,
        systemPrompt: string,
        apiKey: string,
        model?: string
    ) {
        this.model = model || 'claude-3-7-sonnet-20250219';
        this.anthropic = new Anthropic({ apiKey });
        this.clientManager = clientManager;

        const formatter = new AnthropicMessageFormatter();
        const tokenizer = createTokenizer('anthropic', this.model);

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

    /**
     * Accept a SystemPromptBuilder instance for modular system prompt support.
     */
    setSystemPromptBuilder(builder: SystemPromptBuilder): void {
        this.systemPromptBuilder = builder;
    }

    /**
     * Update the prompt context (message count, session, etc.)
     */
    updatePromptContext(ctx: PromptContext): void {
        this.promptContext = ctx;
    }

    getEventEmitter(): EventEmitter {
        return this.eventEmitter;
    }

    getAllTools(): Promise<any> {
        return this.clientManager.getAllTools();
    }

    /**
     * @deprecated Use setSystemPromptBuilder instead for modular system prompt support.
     */
    updateSystemContext(newSystemPrompt: string): void {
        this.messageManager.setSystemPrompt(newSystemPrompt);
    }

    async completeTask(userInput: string): Promise<string> {
        // Add user message to message manager
        this.messageManager.addUserMessage(userInput);

        // If using SystemPromptBuilder, rebuild and set system prompt
        if (this.systemPromptBuilder && this.promptContext) {
            const prompt = await this.systemPromptBuilder.buildPrompt(this.promptContext);
            this.messageManager.setSystemPrompt(prompt);
        }

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
                let messages = this.messageManager.getFormattedMessages();
                // Ensure all message content fields are arrays of content blocks
                messages = messages.map((msg) => {
                    if (typeof msg.content === 'string') {
                        return { ...msg, content: [{ type: 'text', text: msg.content }] };
                    }
                    return msg;
                });
                const systemPrompt = await this.messageManager.getFormattedSystemPrompt();

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

                function isTextBlock(block: ContentBlock): block is TextBlock {
                    return block.type === 'text';
                }

                for (const content of response.content) {
                    if (isTextBlock(content)) {
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
                        this.messageManager.addToolResult(toolUseId, toolName, {
                            error: errorMessage,
                        });

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
            modelMaxTokens: getMaxTokens('anthropic', this.model),
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
