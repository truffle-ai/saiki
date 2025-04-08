import { ClientManager } from '../../client/manager.js';
import { ILLMService } from './types.js';
import { logger } from '../../utils/logger.js';
import { streamText, generateText, CoreMessage } from 'ai';
import { VercelLLM } from './types.js';
import { ToolSet} from '../types.js';
import { ToolSet as VercelToolSet, jsonSchema } from 'ai';
import { EventEmitter } from 'events';

/**
 * Vercel implementation of LLMService
 */
export class VercelLLMService implements ILLMService {
    private model: VercelLLM;
    private maxTokens: number;
    private temperature: number;
    private clientManager: ClientManager;
    private messages: CoreMessage[] = [];
    private systemContext: string = '';
    private eventEmitter: EventEmitter;

    constructor(
        clientManager: ClientManager, 
        model: VercelLLM,
        systemPrompt: string
    ) {
        this.model = model;
        this.clientManager = clientManager;
        this.eventEmitter = new EventEmitter();
        this.updateSystemContext(systemPrompt);
        logger.debug(`[VercelLLMService] System context: ${this.systemContext}`);
    }

    getEventEmitter(): EventEmitter {
        return this.eventEmitter;
    }

    getAllTools(): Promise<ToolSet> {
        return this.clientManager.getAllTools();
    }

    updateSystemContext(newSystemPrompt: string): void {
        this.systemContext = newSystemPrompt;
        // Check if the first message is a system message and update it, or add a new one
        if (this.messages.length > 0 && this.messages[0].role === 'system') {
            this.messages[0].content = newSystemPrompt;
        } else {
            this.messages.unshift({ role: 'system', content: newSystemPrompt });
        }
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

    async completeTask(userInput: string): Promise<string> {

        // Add user message
        this.messages.push({ role: 'user', content: userInput });

        // Get all tools
        const tools: any = await this.clientManager.getAllTools();
        logger.silly(`[VercelLLMService] Tools before formatting: ${JSON.stringify(tools, null, 2)}`);

        const formattedTools = this.formatTools(tools);
        logger.silly(`[VercelLLMService] Formatted tools: ${JSON.stringify(formattedTools, null, 2)}`);

        // Maximum number of tool use iterations
        const MAX_ITERATIONS = 10;
        let iterationCount = 0;
        let fullResponse = '';

        // let stream: AsyncIterable<string> & ReadableStream<string>;
        // let stream: any;
        try {
            while (iterationCount < 1) {
                this.eventEmitter.emit('thinking');
                iterationCount++;
                logger.debug(`Iteration ${iterationCount}`);
                logger.debug(`Messages: ${JSON.stringify(this.messages, null, 2)}`);
                logger.silly(`Tools: ${JSON.stringify(formattedTools, null, 2)}`);
                
                fullResponse = await this.generateText(formattedTools, MAX_ITERATIONS);
                // Change this to processStream to use streaming
                // fullResponse = await this.processStream(formattedTools, MAX_ITERATIONS);
            }

            return (
                fullResponse ||
                'Reached maximum number of tool call iterations without a final response.'
            );
        } catch (error) {
            // Handle API errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error in vercel llm service: ${error}`);
            this.eventEmitter.emit('error', error instanceof Error ? error : new Error(errorMessage));
            return `Error: ${errorMessage}`;
        }
    }

    async generateText(
        tools: VercelToolSet,
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
                        this.eventEmitter.emit('toolResult', toolResult.toolName, toolResult.result);
                    }
                }
                if (step.toolCalls) {
                    for (const toolCall of step.toolCalls) {
                        this.eventEmitter.emit('toolCall', toolCall.toolName, toolCall.args);
                    }
                }
            },
            maxSteps: maxSteps,
        });

        const fullResponse = response.text;

        this.eventEmitter.emit('response', fullResponse);
        this.messages.push({ role: 'assistant', content: fullResponse });

        return fullResponse;
    }

    async processStream(tools: VercelToolSet, maxSteps: number = 10): Promise<string> {
        const stream = await this.streamText(tools, maxSteps);
        let fullResponse = '';
        for await (const textPart of stream) {
            fullResponse += textPart;
            // this.eventEmitter.emit('chunk', textPart);
        }
        this.eventEmitter.emit('response', fullResponse);
        return fullResponse;
    }

    // returns AsyncIterable<string> & ReadableStream<string>
    async streamText(tools: VercelToolSet, maxSteps: number = 10): Promise<any> {
        let stepIteration = 0;
        // use vercel's streamText with mcp
        const response = streamText({
            model: this.model,
            messages: this.messages,
            tools,
            onChunk: (chunk) => {
                logger.debug(`Chunk type: ${chunk.chunk.type}`);
                if (chunk.chunk.type === 'text-delta') {
                    this.eventEmitter.emit('chunk', chunk.chunk.textDelta);
                }
            },
            onError: (error) => {
                logger.error(`Error in streamText: ${JSON.stringify(error, null, 2)}`);
                this.eventEmitter.emit('error', error instanceof Error ? error : new Error(String(error)));
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
                        this.eventEmitter.emit('toolResult', toolResult.toolName, toolResult.result);
                    }
                }
                if (step.toolCalls) {
                    for (const toolCall of step.toolCalls) {
                        this.eventEmitter.emit('toolCall', toolCall.toolName, toolCall.args);
                    }
                }
            },
            onFinish: (result) => {
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
            // maxTokens: this.maxTokens,
            // temperature: this.temperature,
        });

        logger.silly(`Response: ${JSON.stringify(response, null, 2)}`);

        return response.textStream;
    }

    resetConversation(): void {
        this.messages = [];
        this.eventEmitter.emit('conversationReset');
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
