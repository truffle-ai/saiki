import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { CoreMessage, generateText, LanguageModelV1, streamText } from 'ai';
import { z } from 'zod';
import { MCPClientManager } from '../../../client/manager.js';
import { ILLMService, LLMServiceConfig } from './types.js';
import { logger } from '../../../logger/index.js';
import { ToolSet } from '../../types.js';
import { ToolSet as VercelToolSet, jsonSchema } from 'ai';
import { MessageManager } from '../messages/manager.js';
import { getMaxTokensForModel } from '../registry.js';
import { ImageData } from '../messages/types.js';
import { ModelNotFoundError } from '../errors.js';
import type { SessionEventBus } from '../../../events/index.js';

/**
 * Vercel AI SDK implementation of LLMService
 * TODO: improve token counting logic across all LLM services - approximation isn't matching vercel actual token count properly
 */
export class VercelLLMService implements ILLMService {
    private model: LanguageModelV1;
    private provider: string;
    private clientManager: MCPClientManager;
    private messageManager: MessageManager;
    private sessionEventBus: SessionEventBus;
    private maxIterations: number;

    constructor(
        clientManager: MCPClientManager,
        model: LanguageModelV1,
        provider: string,
        sessionEventBus: SessionEventBus,
        messageManager: MessageManager,
        maxIterations: number = 10
    ) {
        this.model = model;
        this.provider = provider;
        this.maxIterations = maxIterations;
        this.clientManager = clientManager;
        this.sessionEventBus = sessionEventBus;
        this.messageManager = messageManager;

        logger.debug(
            `[VercelLLMService] Initialized for model: ${this.model.modelId}, provider: ${this.provider}, messageManager: ${this.messageManager}`
        );
    }

    getAllTools(): Promise<ToolSet> {
        return this.clientManager.getAllTools();
    }

    formatTools(tools: ToolSet): VercelToolSet {
        logger.debug(`Formatting tools for vercel`);
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

    async completeTask(userInput: string, imageData?: ImageData): Promise<string> {
        // Add user message, with optional image data
        logger.debug(
            `VercelLLMService: Adding user message: ${userInput} and imageData: ${imageData}`
        );
        await this.messageManager.addUserMessage(userInput, imageData);

        // Get all tools
        const tools: any = await this.clientManager.getAllTools();
        logger.silly(
            `[VercelLLMService] Tools before formatting: ${JSON.stringify(tools, null, 2)}`
        );

        const formattedTools = this.formatTools(tools);
        logger.silly(
            `[VercelLLMService] Formatted tools: ${JSON.stringify(formattedTools, null, 2)}`
        );

        let iterationCount = 0;
        let fullResponse = '';

        try {
            while (iterationCount < 1) {
                this.sessionEventBus.emit('llmservice:thinking');
                iterationCount++;
                logger.debug(`Iteration ${iterationCount}`);

                // Use the new method that implements proper flow: get system prompt, compress history, format messages
                const context = { clientManager: this.clientManager };
                const { formattedMessages, systemPrompt, tokensUsed } =
                    await this.messageManager.getFormattedMessagesWithCompression(context);

                logger.debug(
                    `Messages (potentially compressed): ${JSON.stringify(formattedMessages, null, 2)}`
                );
                logger.silly(`Tools: ${JSON.stringify(formattedTools, null, 2)}`);
                logger.debug(`Estimated tokens being sent to Vercel provider: ${tokensUsed}`);

                // Call LLM with properly formatted and compressed messages
                fullResponse = await this.generateText(
                    formattedMessages,
                    formattedTools,
                    this.maxIterations
                );
            }

            return (
                fullResponse ||
                'Reached maximum number of tool call iterations without a final response.'
            );
        } catch (error) {
            // Handle API errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error in Vercel LLM service execution: ${errorMessage}`, { error });
            // Hint for token overflow
            logger.warn(
                `Possible token overflow encountered. If due to exceeding model's token limit, configure 'maxTokens' in your LLMConfig.`
            );
            this.sessionEventBus.emit('llmservice:error', {
                error: error instanceof Error ? error : new Error(errorMessage),
                context: 'Vercel LLM service execution',
                recoverable: false,
            });
            return `Error processing request: ${errorMessage}`;
        }
    }

    async generateText(
        messages: CoreMessage[],
        tools: VercelToolSet,
        maxSteps: number = 50
    ): Promise<string> {
        let stepIteration = 0;
        let totalTokens = 0;

        const estimatedTokens = Math.ceil(JSON.stringify(messages, null, 2).length / 4);
        logger.debug(
            `vercel generateText:Generating text with messages (${estimatedTokens} estimated tokens)`
        );

        const response = await generateText({
            model: this.model,
            messages: messages,
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

                // Track token usage from each step
                if (step.usage) {
                    totalTokens += step.usage.totalTokens;
                }

                if (step.text) {
                    this.sessionEventBus.emit('llmservice:response', {
                        content: step.text,
                        model: this.model.modelId,
                        tokenCount: totalTokens > 0 ? totalTokens : undefined,
                    });
                }
                // Emit events based on step content (kept from original)
                if (step.toolCalls && step.toolCalls.length > 0) {
                    for (const toolCall of step.toolCalls) {
                        this.sessionEventBus.emit('llmservice:toolCall', {
                            toolName: toolCall.toolName,
                            args: toolCall.args,
                            callId: toolCall.toolCallId,
                        });
                    }
                }
                if (step.toolResults && step.toolResults.length > 0) {
                    for (const toolResult of step.toolResults as any) {
                        this.sessionEventBus.emit('llmservice:toolResult', {
                            toolName: toolResult.toolName,
                            result: toolResult.result,
                            callId: toolResult.toolCallId,
                            success: true,
                        });
                    }
                }
                // NOTE: Message manager additions are now handled after generateText completes
            },
            maxSteps: maxSteps,
        });

        // Parse and append each new InternalMessage from the formatter using MessageManager
        await this.messageManager.processLLMResponse(response);

        // Update MessageManager with actual token count for hybrid approach
        if (totalTokens > 0) {
            this.messageManager.updateActualTokenCount(totalTokens);
        }

        // Return the plain text of the response
        return response.text;
    }

    async processStream(
        messages: CoreMessage[],
        tools: VercelToolSet,
        maxSteps: number = 10
    ): Promise<string> {
        const stream = await this.streamText(messages, tools, maxSteps);
        let fullResponse = '';
        let totalTokens = 0;

        for await (const textPart of stream) {
            fullResponse += textPart;
            // this.sessionEventBus.emit('chunk', textPart);
        }

        // Add final assistant message, might not be needed
        await this.messageManager.addAssistantMessage(fullResponse);

        this.sessionEventBus.emit('llmservice:response', {
            content: fullResponse,
            model: this.model.modelId,
            tokenCount: totalTokens > 0 ? totalTokens : undefined,
        });
        return fullResponse;
    }

    // returns AsyncIterable<string> & ReadableStream<string>
    async streamText(
        messages: CoreMessage[],
        tools: VercelToolSet,
        maxSteps: number = 10
    ): Promise<any> {
        let stepIteration = 0;
        // use vercel's streamText with mcp
        const response = streamText({
            model: this.model,
            messages: messages,
            tools,
            onChunk: (chunk) => {
                logger.debug(`Chunk type: ${chunk.chunk.type}`);
                if (chunk.chunk.type === 'text-delta') {
                    this.sessionEventBus.emit('llmservice:chunk', {
                        content: chunk.chunk.textDelta,
                        isComplete: false,
                    });
                }
            },
            onError: (error) => {
                logger.error(`Error in streamText: ${JSON.stringify(error, null, 2)}`);
                this.sessionEventBus.emit('llmservice:error', {
                    error: error instanceof Error ? error : new Error(String(error)),
                    context: 'streamText',
                    recoverable: false,
                });
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

                // Process tool calls
                if (step.toolCalls && step.toolCalls.length > 0) {
                    // Don't add assistant message with tool calls to history
                    // Just emit the events
                    for (const toolCall of step.toolCalls) {
                        this.sessionEventBus.emit('llmservice:toolCall', {
                            toolName: toolCall.toolName,
                            args: toolCall.args,
                            callId: toolCall.toolCallId,
                        });
                    }
                }

                // Process tool results
                if (step.stepType === 'tool-result' && step.toolResults) {
                    for (const toolResult of step.toolResults as any) {
                        // Don't add tool results to message manager
                        // Just emit the events
                        this.sessionEventBus.emit('llmservice:toolResult', {
                            toolName: toolResult.toolName,
                            result: toolResult.result,
                            callId: toolResult.toolCallId,
                            success: true,
                        });
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

        logger.silly(`streamText response object: ${JSON.stringify(response, null, 2)}`);

        // Return the textStream part for processStream to iterate over
        return response.textStream;
    }

    /**
     * Get configuration information about the LLM service
     * @returns Configuration object with provider and model information
     */
    getConfig(): LLMServiceConfig {
        const configuredMaxTokens = this.messageManager.getMaxTokens();
        let modelMaxTokens: number;

        // Fetching max tokens from LLM registry - default to configured max tokens if not found
        // Max tokens may not be found if the model is supplied by user
        try {
            modelMaxTokens = getMaxTokensForModel(this.model.provider, this.model.modelId);
        } catch (error) {
            // if the model is not found in the LLM registry, log and default to configured max tokens
            if (error instanceof ModelNotFoundError) {
                modelMaxTokens = configuredMaxTokens;
                logger.debug(
                    `Could not find model ${this.model.modelId} in LLM registry to get max tokens. Using configured max tokens: ${configuredMaxTokens}.`
                );
                // for any other error, throw
            } else {
                throw error;
            }
        }
        return {
            router: 'vercel',
            provider: `${this.model.provider}`,
            model: this.model,
            configuredMaxTokens: configuredMaxTokens,
            modelMaxTokens,
        };
    }
}
