import Anthropic from '@anthropic-ai/sdk';
import { ClientManager } from '../../client/manager.js';
import { LLMCallbacks, LLMService } from './types.js';
import { McpTool } from '../types.js';
import { ToolHelper } from './tool-helper.js';
import { logger } from '../../utils/logger.js';

/**
 * Anthropic implementation of LLMService
 */
export class AnthropicService implements LLMService {
    private anthropic: Anthropic;
    private model: string;
    private toolHelper: ToolHelper;
    private messages: any[] = [];
    private systemContext: string = '';

    constructor(clientManager: ClientManager, apiKey: string, model?: string, _options?: any) {
        this.model = model || 'claude-3-7-sonnet-20250219';
        this.anthropic = new Anthropic({ apiKey });
        this.toolHelper = new ToolHelper(clientManager);
    }

    updateSystemContext(tools: McpTool[]): void {
        // Create a system context string for Anthropic modles
        // They don't use a system message like OpenAI,
        // but we can prepend this to the first user message

        const toolDescriptions = tools
            .map((tool) => {
                let description = `- ${tool.name}: ${tool.description || 'No description provided'}`;
                if (tool.parameters && Object.keys(tool.parameters).length > 0) {
                    description += '\n  Parameters:';
                    for (const [paramName, param] of Object.entries(tool.parameters)) {
                        description += `\n    - ${paramName}: ${param.description || 'No description'} ${param.type ? `(${param.type})` : ''}`;
                    }
                }
                return description;
            })
            .join('\n');

        this.systemContext = `You are Omega, a helpful AI assistant with access to the following tools:\n\n${toolDescriptions}\n\nUse these tools when appropriate to answer user queries. You can use multiple tools in sequence to solve complex problems. After each tool result, determine if you need more information or can provide a final answer.`;
    }

    async completeTask(userInput: string, callbacks?: LLMCallbacks): Promise<string> {
        // Prepend system context to first message or use standalone
        const effectiveUserInput =
            this.messages.length === 0 ? `${this.systemContext}\n\n${userInput}` : userInput;

        // Add user message
        this.messages.push({ role: 'user', content: effectiveUserInput });

        // Get all tools
        const rawTools = await this.toolHelper.getAllTools();
        const formattedTools = this.formatToolsForClaude(rawTools);

        logger.silly(`Formatted tools: ${JSON.stringify(formattedTools, null, 2)}`);

        // Notify thinking
        callbacks?.onThinking?.();

        // Maximum number of tool use iterations
        const MAX_ITERATIONS = 10;
        let iterationCount = 0;
        let fullResponse = '';

        try {
            while (iterationCount < MAX_ITERATIONS) {
                iterationCount++;
                logger.debug(`Iteration ${iterationCount}`);

                logger.debug(`Messages: ${JSON.stringify(this.messages, null, 2)}`);

                const response = await this.anthropic.messages.create({
                    model: this.model,
                    messages: this.messages,
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

                // Add response to the conversation
                this.messages.push({
                    role: 'assistant',
                    content: response.content,
                });

                // If no tools were used, we're done
                if (toolUses.length === 0) {
                    fullResponse += textContent;
                    callbacks?.onResponse?.(fullResponse);
                    return fullResponse;
                }

                // If text content exists, append it to the full response
                if (textContent) {
                    fullResponse += textContent + '\n';
                }

                // Handle tool uses
                const toolResults = [];

                for (const toolUse of toolUses) {
                    const toolName = toolUse.name;
                    const args = toolUse.input;
                    const toolUseId = toolUse.id; // Capture the tool use ID

                    // Notify tool call
                    callbacks?.onToolCall?.(toolName, args);

                    // Execute tool
                    try {
                        const result = await this.toolHelper.executeTool(toolName, args);
                        toolResults.push({ toolName, result, toolUseId }); // Store the ID with the result

                        // Notify tool result
                        callbacks?.onToolResult?.(toolName, result);
                    } catch (error) {
                        // Handle tool execution error
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        toolResults.push({ toolName, error: errorMessage, toolUseId }); // Store the ID with the error

                        callbacks?.onToolResult?.(toolName, { error: errorMessage });
                    }
                }

                // Add tool results as a single user message with properly formatted tool_result objects
                if (toolResults.length > 0) {
                    // Helper function to extract text from tool results
                    const extractTextContent = (result: any): string => {
                        // If it's a string, return as-is
                        if (typeof result === 'string') {
                            return result;
                        }

                        // Check for the specific structure {"content":[{"type":"text","text":"..."}]}
                        if (result && Array.isArray(result.content)) {
                            // Extract all text entries and join them
                            const textEntries = result.content
                                .filter((item) => item.type === 'text' && item.text)
                                .map((item) => item.text);

                            if (textEntries.length > 0) {
                                return textEntries.join('\n');
                            }
                        }

                        // For other object structures, stringify them
                        return JSON.stringify(result);
                    };

                    const contentArray = toolResults.map(
                        ({ toolName, result, error, toolUseId }) => {
                            const resultValue = error
                                ? `Error: ${error}`
                                : extractTextContent(result);

                            return {
                                type: 'tool_result',
                                tool_use_id: toolUseId,
                                content: resultValue,
                            };
                        }
                    );

                    this.messages.push({
                        role: 'user',
                        content: contentArray,
                    });
                }

                // Notify thinking for next iteration
                callbacks?.onThinking?.();
            }

            // If we reached max iterations
            callbacks?.onResponse?.(fullResponse);
            return (
                fullResponse ||
                'Reached maximum number of tool call iterations without a final response.'
            );
        } catch (error) {
            // Handle API errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error in Anthropic service: ${errorMessage}`);

            return `Error: ${errorMessage}`;
        }
    }

    resetConversation(): void {
        // Clear all messages
        this.messages = [];
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

    private formatToolsForClaude(tools: McpTool[]): any[] {
        return tools.map((tool) => {
            // Create input_schema structure (same as parameters in OpenAI)
            const input_schema = {
                type: 'object',
                properties: {},
                required: [],
            };

            // Map tool parameters to JSON Schema format
            if (
                tool.parameters &&
                tool.parameters.properties &&
                typeof tool.parameters.properties === 'object'
            ) {
                // Extract parameters from the properties object
                for (const [name, param] of Object.entries(tool.parameters.properties)) {
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

                    input_schema.properties[name] = {
                        type: paramType,
                        description: param.description || `The ${name} parameter`,
                    };

                    // Add items property for array types
                    if (paramType === 'array') {
                        // Use the items property from the original schema if it exists
                        if (param.items) {
                            input_schema.properties[name].items = param.items;
                        } else {
                            // Default to array of strings if no items specification is provided
                            input_schema.properties[name].items = { type: 'string' };
                        }
                    }

                    // Handle enums if present
                    if (paramEnum) {
                        input_schema.properties[name].enum = paramEnum;
                    }
                }

                // Use the required array from inputSchema if it exists
                if (Array.isArray(tool.parameters.required)) {
                    input_schema.required = [...tool.parameters.required];
                }
            }

            logger.silly('AFTER FORMATTING TOOL FOR ANTHROPIC');
            logger.silly(`Tool: ${tool.name}`);
            logger.silly(`Description: ${tool.description}`);
            logger.silly(`Input Schema: ${JSON.stringify(input_schema)}`);

            // Return in Anthropic's expected format
            return {
                name: tool.name,
                description: tool.description || `Tool for ${tool.name}`,
                input_schema: input_schema,
            };
        });
    }
}
