import OpenAI from 'openai';
import { ClientManager } from '../../client/manager.js';
import { ILLMService } from './types.js';
import { ToolSet } from '../types.js';
import { logger } from '../../utils/logger.js';
import { EventEmitter } from 'events';

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
    private conversationHistory: any[] = [];
    private systemPromptTemplate: string;
    private eventEmitter: EventEmitter;
    
    constructor(
        clientManager: ClientManager, 
        systemPrompt: string,
        apiKey: string, 
        model?: string,
    ) {
        this.model = model || 'gpt-4o-mini';
        this.openai = new OpenAI({ apiKey });
        this.clientManager = clientManager;
        this.systemPromptTemplate = systemPrompt || DETAILED_SYSTEM_PROMPT_TEMPLATE;

        // Initialize with system message
        this.conversationHistory = [{ role: 'system', content: this.systemPromptTemplate }];
        this.eventEmitter = new EventEmitter();
    }

    getEventEmitter(): EventEmitter {
        return this.eventEmitter;
    }

    getAllTools(): Promise<ToolSet> {
        return this.clientManager.getAllTools();
    }

    updateSystemContext(newSystemPrompt: string): void {
        this.systemPromptTemplate = newSystemPrompt;
        if (this.conversationHistory.length === 0) {
            this.conversationHistory.push({ role: 'system', content: this.systemPromptTemplate });
        } else {
            this.conversationHistory[0].content = this.systemPromptTemplate;
        }
    }

    async completeTask(userInput: string): Promise<string> {
        // Add user message to history
        this.conversationHistory.push({ role: 'user', content: userInput });

        // Get all tools
        const rawTools = await this.clientManager.getAllTools();
        const formattedTools = this.formatToolsForOpenAI(rawTools);

        logger.silly(`Formatted tools: ${JSON.stringify(formattedTools, null, 2)}`);

        // Notify thinking
        this.eventEmitter.emit('thinking');

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
                    this.eventEmitter.emit('response', responseText);
                    return responseText;
                }

                // Handle tool calls
                for (const toolCall of message.tool_calls) {
                    logger.debug(`Tool call initiated: ${JSON.stringify(toolCall, null, 2)}`);
                    const toolName = toolCall.function.name;
                    let args: any = {};

                    try {
                        args = JSON.parse(toolCall.function.arguments);
                    } catch (e) {
                        logger.error(`Error parsing arguments for ${toolName}:`, e);
                    }

                    // Notify tool call
                    this.eventEmitter.emit('toolCall', toolName, args);

                    // Execute tool
                    try {
                        const result = await this.clientManager.executeTool(toolName, args);

                        // Register tool result with proper error handling
                        this.registerToolResult(toolName, result, toolCall.id);

                        // Notify tool result
                        this.eventEmitter.emit('toolResult', toolName, result);
                    } catch (error) {
                        // Handle tool execution error
                        const errorMessage = error instanceof Error ? error.message : String(error);

                        // Register error result
                        this.registerToolResult(toolName, { error: errorMessage }, toolCall.id);

                        this.eventEmitter.emit('toolResult', toolName, { error: errorMessage });
                    }
                }

                // Ensure all tool calls have responses
                this.ensureAllToolCallsHaveResponses();

                // Validate the conversation structure
                const isValid = this.validateConversationStructure();
                if (!isValid) {
                    logger.error('Conversation structure is invalid. Attempting repair...');
                    this.repairConversationStructure();
                }

                // Notify thinking for next iteration
                this.eventEmitter.emit('thinking');
            }

            // If we reached max iterations, return the last message
            const lastMessage = this.conversationHistory.find(
                (msg) => msg.role === 'assistant' && msg.content
            );

            const finalResponse =
                lastMessage?.content || 'Task completed but reached maximum iterations.';
            this.eventEmitter.emit('response', finalResponse);
            return finalResponse;
        } catch (error) {
            // Handle API errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Error in OpenAI service:', errorMessage);

            // Add error message to conversation
            this.conversationHistory.push({
                role: 'assistant',
                content: `Error: ${errorMessage}`,
            });

            this.eventEmitter.emit('error', error instanceof Error ? error : new Error(errorMessage));
            return `Error: ${errorMessage}`;
        }
    }

    resetConversation(): void {
        // Keep only the system message
        this.conversationHistory = this.conversationHistory.slice(0, 1);
        this.eventEmitter.emit('conversationReset');
    }

    /**
     * Get configuration information about the LLM service
     * @returns Configuration object with provider and model information
     */
    getConfig(): { provider: string; model: string; [key: string]: any } {
        return {
            provider: 'openai',
            model: this.model,
        };
    }

    // Helper methods from AiService
    private async getAIResponseWithRetries(tools: any[]): Promise<any> {
        let attempts = 0;
        const MAX_ATTEMPTS = 3;

        // add a log of tools size
        logger.debug(`Tools size in getAIResponseWithRetries: ${tools.length}`);
        logger.silly(
            `Message history in getAIResponseWithRetries: ${JSON.stringify(this.conversationHistory, null, 2)}`
        );
        while (attempts < MAX_ATTEMPTS) {
            attempts++;

            try {
                // Call OpenAI API
                const response = await this.openai.chat.completions.create({
                    model: this.model,
                    messages: this.conversationHistory,
                    tools: attempts === 1 ? tools : [], // Only offer tools on first attempt
                    tool_choice: attempts === 1 ? 'auto' : 'none', // Disable tool choice on retry
                });

                logger.silly(
                    'OPENAI CHAT COMPLETION RESPONSE: ',
                    JSON.stringify(response, null, 2)
                );

                // Get the response message
                const responseMessage = response.choices[0].message;
                this.conversationHistory.push(responseMessage);

                return responseMessage;
            } catch (error) {
                // Handle specific OpenAI errors
                if (error.message && error.message.includes("not found in 'tool_calls'")) {
                    this.handleInvalidToolCallError(error);
                } else if (
                    error.message &&
                    error.message.includes('tool_call_ids did not have response messages')
                ) {
                    this.handleMissingToolResponseError(error);
                } else {
                    logger.error(
                        `Error in OpenAI service: ${error.message || JSON.stringify(error, null, 2)}`
                    );
                    // For other errors, if we're at max attempts, throw
                    if (attempts >= MAX_ATTEMPTS) {
                        throw error;
                    }
                }

                // For retry, simplify the conversation
                if (attempts < MAX_ATTEMPTS) {
                    this.simplifyConversationForRetry();
                }
            }
        }

        throw new Error('Failed to get response after multiple attempts');
    }

    private validateConversationStructure(): boolean {
        // Check that all tool calls have corresponding tool responses
        const toolCallIds = new Set<string>();
        const toolResponseIds = new Set<string>();

        // Gather all tool call IDs
        for (const message of this.conversationHistory) {
            if (message.role === 'assistant' && message.tool_calls) {
                for (const toolCall of message.tool_calls) {
                    toolCallIds.add(toolCall.id);
                }
            }
        }

        // Gather all tool response IDs
        for (const message of this.conversationHistory) {
            if (message.role === 'tool' && message.tool_call_id) {
                toolResponseIds.add(message.tool_call_id);
            }
        }

        // Check for any tool calls without responses
        for (const id of toolCallIds) {
            if (!toolResponseIds.has(id)) {
                logger.error(`Missing tool response for tool call ID: ${id}`);
                return false;
            }
        }

        // All validations passed
        return true;
    }

    private registerToolResult(toolName: string, result: any, toolCallId: string): void {
        // Format and add the tool result message to conversation history
        const toolResultMessage = {
            role: 'tool',
            tool_call_id: toolCallId,
            name: toolName,
            content: JSON.stringify(result || { error: 'Tool returned null or undefined' }),
        };

        // Add to conversation history
        this.conversationHistory.push(toolResultMessage);
    }

    private ensureAllToolCallsHaveResponses(): void {
        // Find all tool calls that need responses
        const pendingCalls = this.findPendingToolCalls();

        if (pendingCalls.length > 0) {
            // Add placeholder responses for all pending calls
            for (const call of pendingCalls) {
                this.conversationHistory.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    name: call.name,
                    content: JSON.stringify({
                        status: 'placeholder',
                        message: 'This tool call was acknowledged but not fully processed',
                    }),
                });
            }
        }
    }

    private handleInvalidToolCallError(error: any): void {
        // Extract the invalid tool call ID from the error message
        const invalidIdMatch = error.message.match(/'tool_call_id' of '([^']+)' not found/);
        if (!invalidIdMatch) {
            return;
        }

        const invalidId = invalidIdMatch[1];

        // Find and remove the invalid tool response
        for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
            const message = this.conversationHistory[i];
            if (message.role === 'tool' && message.tool_call_id === invalidId) {
                this.conversationHistory.splice(i, 1);
            }
        }
    }

    private handleMissingToolResponseError(error: any): void {
        // Extract the missing tool call ID from the error message
        const missingIdMatch = error.message.match(
            /tool_call_ids did not have response messages: ([a-zA-Z0-9_]+)/
        );
        if (!missingIdMatch) {
            return;
        }

        const missingId = missingIdMatch[1];

        // Add a placeholder response for this tool call
        this.conversationHistory.push({
            role: 'tool',
            tool_call_id: missingId,
            name: 'emergency_recovery',
            content: JSON.stringify({
                status: 'error_recovery',
                message: 'This tool call response was missing and has been auto-generated',
            }),
        });
    }

    private repairConversationStructure(): void {
        // Simple implementation - remove the last tool call sequence
        this.removeLastToolCallSequence();
    }

    private removeLastToolCallSequence(): void {
        // Find the last assistant message with tool calls
        let lastToolCallIndex = -1;
        for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
            const message = this.conversationHistory[i];
            if (
                message.role === 'assistant' &&
                message.tool_calls &&
                message.tool_calls.length > 0
            ) {
                lastToolCallIndex = i;
                break;
            }
        }

        if (lastToolCallIndex === -1) {
            return;
        }

        // Find all related tool responses
        const toolCallIds = this.conversationHistory[lastToolCallIndex].tool_calls.map(
            (tc) => tc.id
        );
        const relatedIndices: number[] = [lastToolCallIndex];

        for (let i = lastToolCallIndex + 1; i < this.conversationHistory.length; i++) {
            const message = this.conversationHistory[i];
            if (message.role === 'tool' && toolCallIds.includes(message.tool_call_id)) {
                relatedIndices.push(i);
            } else if (message.role === 'assistant') {
                // Stop at the next assistant message
                break;
            }
        }

        // Remove all related messages in reverse order to avoid index shifting
        for (let i = relatedIndices.length - 1; i >= 0; i--) {
            const index = relatedIndices[i];
            this.conversationHistory.splice(index, 1);
        }

        // Add a recovery message
        this.conversationHistory.push({
            role: 'assistant',
            content:
                "I ran into an issue processing the previous tool calls. Let's try a different approach.",
        });
    }

    private simplifyConversationForRetry(): void {
        // Get the last user message index
        let lastUserIndex = -1;
        for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
            if (this.conversationHistory[i].role === 'user') {
                lastUserIndex = i;
                break;
            }
        }

        if (lastUserIndex === -1) {
            return;
        }

        // Truncate the conversation after the user message
        this.conversationHistory = [
            ...this.conversationHistory.slice(0, lastUserIndex + 1),
            {
                role: 'assistant',
                content: "I'm working on your request. Let me think about this differently.",
            },
        ];
    }

    private findPendingToolCalls(): Array<{ id: string; name: string }> {
        const pendingCalls: Array<{ id: string; name: string }> = [];
        const respondedIds = new Set<string>();

        // First, collect all tool response IDs
        for (const message of this.conversationHistory) {
            if (message.role === 'tool' && message.tool_call_id) {
                respondedIds.add(message.tool_call_id);
            }
        }

        // Then find all tool calls that don't have responses
        for (const message of this.conversationHistory) {
            if (message.role === 'assistant' && message.tool_calls) {
                for (const toolCall of message.tool_calls) {
                    if (!respondedIds.has(toolCall.id)) {
                        pendingCalls.push({
                            id: toolCall.id,
                            name: toolCall.function.name,
                        });
                    }
                }
            }
        }

        return pendingCalls;
    }

    private formatToolsForOpenAI(tools: ToolSet): any[] {
        logger.debug(`Formatting tools for OpenAI: ${JSON.stringify(tools, null, 2)}`);
        return Object.entries(tools).map(([toolName, tool]) => {
            // Convert tool to OpenAI function format
            const parameters = {
                type: 'object',
                properties: {},
                required: [],
            };

            // Map tool parameters to JSON Schema format
            if (tool.parameters) {
                // Type assertion for parameters
                const jsonSchemaParams = tool.parameters as any;
                
                if (jsonSchemaParams.properties && typeof jsonSchemaParams.properties === 'object') {
                    // Extract parameters from the properties object in inputSchema
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
                                // Extract enum values if they exist
                                const enumMatch = paramType.match(/\[(.*?)\]/);
                                if (enumMatch) {
                                    paramEnum = enumMatch[1]
                                        .split(',')
                                        .map((v) => v.trim().replace(/["']/g, ''));
                                }
                            }
                        }

                        parameters.properties[name] = {
                            type: paramType,
                            description: param.description || `The ${name} parameter`,
                        };

                        // Add items property for array types (required by OpenAI's API)
                        if (paramType === 'array') {
                            // Use the items property from the original schema if it exists
                            if (param.items) {
                                parameters.properties[name].items = param.items;
                            } else {
                                // Default to array of strings if no items specification is provided
                                parameters.properties[name].items = { type: 'string' };
                            }
                        }

                        // Handle enums if present
                        if (paramEnum) {
                            parameters.properties[name].enum = paramEnum;
                        }
                    }

                    // Use the required array from inputSchema if it exists
                    if (Array.isArray(jsonSchemaParams.required)) {
                        parameters.required = [...jsonSchemaParams.required];
                    }
                }
            }

            logger.silly('AFTER FORMATTING TOOL FOR OPENAI');
            logger.silly(`Tool: ${toolName}`);
            logger.silly(`Description: ${tool.description}`);
            logger.silly(`Parameters: ${JSON.stringify(parameters)}`);

            return {
                type: 'function',
                function: {
                    name: toolName,
                    description: tool.description || `Tool for ${toolName}`,
                    parameters,
                },
            };
        });
    }
}
