import { ClientManager } from '../../client/manager.js';
import { LLMCallbacks, ILLMService } from './types.js';
import { logger } from '../../utils/logger.js';
import { streamText, generateText, CoreMessage } from 'ai';
import { VercelLLM } from './types.js';
import { ToolSet} from '../types.js';
import { ToolSet as VercelToolSet, jsonSchema } from 'ai';

/**
 * Vercel implementation of LLMService
 */
export class VercelLLMService implements ILLMService {
    // Model here maps to vercel AI model
    private model: VercelLLM;
    private maxTokens: number;
    private temperature: number;
    private clientManager: ClientManager;
    private messages: CoreMessage[] = [];
    private systemContext: string = '';

    constructor(clientManager: ClientManager, model: VercelLLM) {
        this.model = model;
        this.clientManager = clientManager;
    }

    getAllTools(): Promise<ToolSet> {
        return this.clientManager.getAllTools();
    }

    updateSystemContext(tools: ToolSet): void {
        const toolDescriptions = Object.entries(tools)
            .map(([toolName, tool]) => {
                let description = `- ${toolName}: ${tool.description || 'No description provided'}`;
                if (tool.parameters && Object.keys(tool.parameters).length > 0) {
                    description += '\n  Parameters:';
                    for (const [paramName, paramRaw] of Object.entries(tool.parameters)) {
                        const param = paramRaw as any;
                        description += `\n    - ${paramName}: ${param.description || 'No description'} ${param.type ? `(${param.type})` : ''}`;
                    }
                }
                return description;
            })
            .join('\n');

        this.systemContext = `You are Omega, a helpful AI assistant with access to the following tools:\n\n${toolDescriptions}\n\nUse these tools when appropriate to answer user queries. You can use multiple tools in sequence to solve complex problems. After each tool result, determine if you need more information or can provide a final answer.`;
    }

    formatTools(tools: ToolSet): VercelToolSet {
        logger.debug(`Formatting tools for vercel`)
        return Object.keys(tools).reduce<VercelToolSet>((acc, toolName) => {
            acc[toolName] = {
                description: tools[toolName].description,
                parameters: jsonSchema(tools[toolName].parameters as any),
                execute: async (args: any) => {
                    return await this.clientManager.executeTool(toolName, args);
                },
            };
            return acc;
        }, {});
    }

    async completeTask(userInput: string, callbacks?: LLMCallbacks): Promise<string> {
        // Prepend system context to first message or use standalone
        const effectiveUserInput =
            this.messages.length === 0 ? `${this.systemContext}\n\n${userInput}` : userInput;

        // Add user message
        this.messages.push({ role: 'user', content: effectiveUserInput });

        // Get all tools
        const tools: any = await this.clientManager.getAllTools();
         logger.silly(`[VercelLLMService] Tools before formatting: ${JSON.stringify(tools, null, 2)}`);

        const formattedTools = this.formatTools(tools);
        logger.silly(`[VercelLLMService] Formatted tools: ${JSON.stringify(formattedTools, null, 2)}`);

        // Maximum number of tool use iterations
        const MAX_ITERATIONS = 10;
        let iterationCount = 0;
        let fullResponse = '';

        //let stream: AsyncIterable<string> & ReadableStream<string>;
        let stream: any;
        try {
            while (iterationCount < 1) {
                callbacks?.onThinking?.();
                iterationCount++;
                logger.debug(`Iteration ${iterationCount}`);
                logger.debug(`Messages: ${JSON.stringify(this.messages, null, 2)}`);
                logger.silly(`Tools: ${JSON.stringify(formattedTools, null, 2)}`);
                
                fullResponse = await this.generateText(formattedTools, callbacks, MAX_ITERATIONS);
                
                //fullResponse = await this.processStream(tools, callbacks, MAX_ITERATIONS);
                // Notify thinking for next iteration
            }

            // If we reached max iterations
            // callbacks?.onResponse?.(fullResponse);
            return (
                fullResponse ||
                'Reached maximum number of tool call iterations without a final response.'
            );
        } catch (error) {
            // Handle API errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error in vercel llm service: ${error}`);

            return `Error: ${errorMessage}`;
        }
    }

    async generateText(
        tools: VercelToolSet,
        callbacks?: LLMCallbacks,
        maxSteps: number = 10
    ): Promise<string> {
        let stepIteration = 0;
        const response = await generateText({
            model: this.model,
            messages: this.messages,
            tools,
            onStepFinish: (step) => {
                logger.debug(`Step iteration: ${stepIteration}`);
                stepIteration++;
                logger.debug(`Step finished, step type: ${step.stepType}`);
                logger.debug(`Step finished, step text: ${step.text}`);
                logger.debug(
                    `Step finished, step tool calls: ${JSON.stringify(step.toolCalls, null, 2)}`
                );
                logger.debug(
                    `Step finished, step tool results: ${JSON.stringify(step.toolResults, null, 2)}`
                );

                if (step.stepType === 'tool-result') {
                    for (const toolResult of step.toolResults as any) {
                        callbacks?.onToolResult?.(toolResult.toolName, toolResult.result);
                    }
                }
                if (step.toolCalls) {
                    for (const toolCall of step.toolCalls) {
                        callbacks?.onToolCall?.(toolCall.toolName, toolCall.args);
                    }
                }
            },
            maxSteps: maxSteps,
        });

        const fullResponse = response.text;

        callbacks?.onResponse?.(fullResponse);

        this.messages.push({ role: 'assistant', content: fullResponse });

        return fullResponse;
    }

    async processStream(tools: VercelToolSet, callbacks?: LLMCallbacks, maxSteps: number = 10): Promise<string> {
        const stream = await this.streamText(tools, callbacks, maxSteps);
        let fullResponse = '';
        for await (const textPart of stream) {
            fullResponse += textPart;
            callbacks?.onChunk?.(textPart);
        }
        // callbacks?.onResponse?.(fullResponse);
        return fullResponse;
    }

    // returns AsyncIterable<string> & ReadableStream<string>
    async streamText(tools: VercelToolSet, callbacks?: LLMCallbacks, maxSteps: number = 10): Promise<any> {
        let stepIteration = 0;
        // use vercel's streamText with mcp
        const response = streamText({
            model: this.model,
            messages: this.messages,
            tools,
            onChunk: (chunk) => {
                logger.debug(`Chunk type: ${chunk.chunk.type}`);
            },
            onError: (error) => {
                logger.error(`Error in streamText: ${JSON.stringify(error, null, 2)}`);
            },
            onStepFinish: (step) => {
                logger.debug(`Step iteration: ${stepIteration}`);
                stepIteration++;
                logger.debug(`Step finished, step type: ${step.stepType}`);
                logger.debug(`Step finished, step text: ${step.text}`);
                logger.debug(
                    `Step finished, step tool calls: ${JSON.stringify(step.toolCalls, null, 2)}`
                );
                logger.debug(
                    `Step finished, step tool results: ${JSON.stringify(step.toolResults, null, 2)}`
                );

                if (step.stepType === 'tool-result') {
                    for (const toolResult of step.toolResults as any) {
                        callbacks?.onToolResult?.(toolResult.toolName, toolResult.result);
                    }
                }
                if (step.toolCalls) {
                    for (const toolCall of step.toolCalls) {
                        callbacks?.onToolCall?.(toolCall.toolName, toolCall.args);
                    }
                }
            },
            onFinish: (result) => {
                //logger.debug(`Stream finished: ${JSON.stringify(result, null, 2)}`);
                logger.debug(`Stream finished, result finishReason: ${result.finishReason}`);
                logger.debug(`Stream finished, result text: ${result.text}`);
                logger.debug(
                    `Stream finished, result tool calls: ${JSON.stringify(result.toolCalls, null, 2)}`
                );
                logger.debug(
                    `Stream finished, result tool results: ${JSON.stringify(
                        result.toolResults,
                        null,
                        2
                    )}`
                );
            },
            maxSteps: maxSteps,
            toolCallStreaming: true,
            // maxTokens: this.maxTokens,
            // temperature: this.temperature,
        });

        logger.silly(`Response: ${JSON.stringify(response, null, 2)}`);

        return response.textStream;

        // for await (const textPart of response.textStream) {
        //     fullResponse += textPart;
        //     console.log(textPart);
        // }
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
