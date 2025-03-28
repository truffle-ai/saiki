import { MCPClientManager } from '../../client/manager.js';
import { LLMCallbacks, ILLMService } from './types.js';
import { McpTool } from '../types.js';
import { ToolHelper } from './tool-helper.js';
import { logger } from '../../utils/logger.js';
import { streamText, generateText, CoreMessage } from 'ai';
import { VercelLLM } from './types.js';

/**
 * Vercel generic implementation of LLMService
 */
export class VercelLLMService implements ILLMService {
    // Model here maps to vercel AI model
    private model: VercelLLM;
    private maxTokens: number;
    private temperature: number;
    private toolHelper: ToolHelper;
    private messages: CoreMessage[] = [];
    private systemContext: string = '';

    constructor(mcpClientManager: MCPClientManager, model: VercelLLM) {
        this.model = model;
        this.toolHelper = new ToolHelper(mcpClientManager);
    }

    getAllTools(): Promise<any> {
        return this.toolHelper.getAllTools();
    }

    updateSystemContext(tools: McpTool[]): void {

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
        const tools: any = await this.toolHelper.getAllTools();
        logger.silly(`Tools: ${JSON.stringify(tools, null, 2)}`);

        // Notify thinking
        callbacks?.onThinking?.();

        // Maximum number of tool use iterations
        const MAX_ITERATIONS = 10;
        let iterationCount = 0;
        let fullResponse = '';

        try {
            while (iterationCount < 1) {
                iterationCount++;
                logger.debug(`Iteration ${iterationCount}`);

                logger.debug(`Messages: ${JSON.stringify(this.messages, null, 2)}`);

                // Use vercel's generateStream along with mcp
                const response = await streamText({
                    model: this.model,
                    messages: this.messages,
                    tools,
                    onChunk: (chunk) => {
                        logger.debug(`Chunk type: ${chunk.chunk.type}`);
                        logger.debug(`Chunk: ${JSON.stringify(chunk, null, 2)}`);
                    },
                    onError: (error) => {
                        logger.error(`Error in streamText: ${JSON.stringify(error, null, 2)}`);
                    },
                    onStepFinish: (step) => {
                        //logger.debug(`Step finished: ${JSON.stringify(step, null, 2)}`);
                        logger.debug(`Step finished, step type: ${JSON.stringify(step.stepType, null, 2)}`);
                        logger.debug(`Step finished, step text: ${JSON.stringify(step.text, null, 2)}`);
                        logger.debug(`Step finished, step tool calls: ${JSON.stringify(step.toolCalls, null, 2)}`);
                        logger.debug(`Step finished, step tool results: ${JSON.stringify(step.toolResults, null, 2)}`);
                    },
                    onFinish: (result) => {
                        //logger.debug(`Stream finished: ${JSON.stringify(result, null, 2)}`);
                        logger.debug(`Stream finished, result finishReason: ${result.finishReason}`);
                        logger.debug(`Stream finished, result text: ${result.text}`);
                        logger.debug(`Stream finished, result tool calls: ${JSON.stringify( result.toolCalls, null, 2)}`);
                        logger.debug(
                            `Stream finished, result tool results: ${JSON.stringify(
                                result.toolResults,
                                null,
                                2
                            )}`
                        );
                    },
                    maxSteps: MAX_ITERATIONS,
                    toolCallStreaming: true,
                    // maxTokens: this.maxTokens,
                    // temperature: this.temperature,
                });

                //logger.debug(`Response: ${JSON.stringify(response, null, 2)}`);

                for await (const textPart of response.textStream) {
                    fullResponse += textPart;
                    console.log(textPart);
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
    getConfig(): { model: VercelLLM } {
        return {
            model: this.model,
        };
    }
}
