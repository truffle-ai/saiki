import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { CoreMessage, generateText, LanguageModelV1, streamText } from 'ai';
import { z } from 'zod';
import { MCPManager } from '../../../client/manager.js';
import { ILLMService, LLMServiceConfig } from './types.js';
import { logger } from '../../../logger/index.js';
import { ToolSet } from '../../types.js';
import { ToolSet as VercelToolSet, jsonSchema } from 'ai';
import { MessageManager } from '../messages/manager.js';
import { getMaxInputTokensForModel } from '../registry.js';
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
    private clientManager: MCPManager;
    private messageManager: MessageManager;
    private sessionEventBus: SessionEventBus;
    private maxIterations: number;
    private temperature: number | undefined;
    private maxOutputTokens: number | undefined;

    constructor(
        clientManager: MCPManager,
        model: LanguageModelV1,
        provider: string,
        sessionEventBus: SessionEventBus,
        messageManager: MessageManager,
        maxIterations: number = 10,
        temperature?: number,
        maxOutputTokens?: number
    ) {
        this.model = model;
        this.provider = provider;
        this.maxIterations = maxIterations;
        this.clientManager = clientManager;
        this.sessionEventBus = sessionEventBus;
        this.messageManager = messageManager;
        this.temperature = temperature;
        this.maxOutputTokens = maxOutputTokens;

        logger.debug(
            `[VercelLLMService] Initialized for model: ${this.model.modelId}, provider: ${this.provider}, temperature: ${temperature}, maxOutputTokens: ${maxOutputTokens}`
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

    async completeTask(
        userInput: string,
        imageData?: ImageData,
        stream: boolean = false
    ): Promise<string> {
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

                // Both methods now return strings and handle message processing internally
                if (stream) {
                    fullResponse = await this.streamText(
                        formattedMessages,
                        formattedTools,
                        this.maxIterations
                    );
                } else {
                    fullResponse = await this.generateText(
                        formattedMessages,
                        formattedTools,
                        this.maxIterations
                    );
                }
            }

            return (
                fullResponse ||
                'Reached maximum number of tool call iterations without a final response.'
            );
        } catch (error) {
            // Handle API errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error in Vercel LLM service execution: ${errorMessage}`, { error });
            this.sessionEventBus.emit('llmservice:error', {
                error: error instanceof Error ? error : new Error(errorMessage),
                context: 'Vercel LLM service execution',
                recoverable: false,
            });
            return `Error processing request: ${errorMessage}`;
        }
    }

    async generateText(
        messages: any[],
        tools: VercelToolSet,
        maxSteps: number = 50
    ): Promise<string> {
        let stepIteration = 0;
        let totalTokens = 0;

        const estimatedTokens = Math.ceil(JSON.stringify(messages, null, 2).length / 4);
        logger.debug(
            `vercel generateText:Generating text with messages (${estimatedTokens} estimated tokens)`
        );

        const temperature = this.temperature;
        const maxTokens = this.maxOutputTokens;

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
            ...(maxTokens && { maxTokens }),
            ...(temperature !== undefined && { temperature }),
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

    // Updated streamText to behave like generateText - returns string and handles message processing internally
    async streamText(
        messages: any[],
        tools: VercelToolSet,
        maxSteps: number = 10
    ): Promise<string> {
        let stepIteration = 0;
        let totalTokens = 0;

        const temperature = this.temperature;
        const maxTokens = this.maxOutputTokens;

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

                // Track token usage from each step
                if (step.usage) {
                    totalTokens += step.usage.totalTokens;
                }

                // Emit response event for step text (same as generateText)
                if (step.text) {
                    this.sessionEventBus.emit('llmservice:response', {
                        content: step.text,
                        model: this.model.modelId,
                        tokenCount: totalTokens > 0 ? totalTokens : undefined,
                    });
                }

                // Process tool calls (same as generateText)
                if (step.toolCalls && step.toolCalls.length > 0) {
                    for (const toolCall of step.toolCalls) {
                        this.sessionEventBus.emit('llmservice:toolCall', {
                            toolName: toolCall.toolName,
                            args: toolCall.args,
                            callId: toolCall.toolCallId,
                        });
                    }
                }

                // Process tool results (same condition as generateText)
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

                // Get final token count from result
                if (result.usage) {
                    logger.debug(
                        `Stream finished, result usage: ${JSON.stringify(result.usage, null, 2)}`
                    );
                    totalTokens = result.usage.totalTokens;
                }
            },
            maxSteps: maxSteps,
            ...(maxTokens && { maxTokens }),
            ...(temperature !== undefined && { temperature }),
        });

        // Consume the stream to get the final text
        let fullResponse = '';
        for await (const textPart of response.textStream) {
            fullResponse += textPart;
        }

        // Process the LLM response through MessageManager using the new stream method
        await this.messageManager.processLLMStreamResponse(response);

        // Update MessageManager with actual token count for hybrid approach
        if (totalTokens > 0) {
            logger.debug(`Stream finished, updating actual token count: ${totalTokens}`);
            this.messageManager.updateActualTokenCount(totalTokens);
        }

        // Emit final response event with token count
        this.sessionEventBus.emit('llmservice:response', {
            content: fullResponse,
            model: this.model.modelId,
            tokenCount: totalTokens > 0 ? totalTokens : undefined,
        });

        logger.silly(`streamText response object: ${JSON.stringify(response, null, 2)}`);

        // Return the final text string (same as generateText)
        return fullResponse;
    }

    /**
     * Get configuration information about the LLM service
     * @returns Configuration object with provider and model information
     */
    getConfig(): LLMServiceConfig {
        const configuredMaxTokens = this.messageManager.getMaxInputTokens();
        let modelMaxInputTokens: number;

        // Fetching max tokens from LLM registry - default to configured max tokens if not found
        // Max tokens may not be found if the model is supplied by user
        try {
            modelMaxInputTokens = getMaxInputTokensForModel(
                this.model.provider,
                this.model.modelId
            );
        } catch (error) {
            // if the model is not found in the LLM registry, log and default to configured max tokens
            if (error instanceof ModelNotFoundError) {
                modelMaxInputTokens = configuredMaxTokens;
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
            configuredMaxInputTokens: configuredMaxTokens,
            modelMaxInputTokens: modelMaxInputTokens,
        };
    }
}
