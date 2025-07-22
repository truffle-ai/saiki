import { generateText, LanguageModelV1, streamText } from 'ai';
import { MCPManager } from '../../../client/manager.js';
import { ILLMService, LLMServiceConfig } from './types.js';
import { logger } from '../../../logger/index.js';
import { ToolSet } from '../../types.js';
import { ToolSet as VercelToolSet, jsonSchema } from 'ai';
import { ContextManager } from '../messages/manager.js';
import { getMaxInputTokensForModel } from '../registry.js';
import { ImageData } from '../messages/types.js';
import { ModelNotFoundError } from '../errors.js';
import type { SessionEventBus } from '../../../events/index.js';
import { ToolExecutionDeniedError } from '../../../client/tool-confirmation/errors.js';
import { PluginManager } from '../../../plugins/index.js';

/**
 * Vercel AI SDK implementation of LLMService
 * TODO: improve token counting logic across all LLM services - approximation isn't matching vercel actual token count properly
 */
export class VercelLLMService implements ILLMService {
    private model: LanguageModelV1;
    private provider: string;
    private mcpManager: MCPManager;
    private contextManager: ContextManager;
    private sessionEventBus: SessionEventBus;
    private maxIterations: number;
    private temperature: number | undefined;
    private maxOutputTokens: number | undefined;
    private readonly sessionId: string;
    private baseURL: string | undefined;
    private toolSupportCache: Map<string, boolean> = new Map();
    private pluginManager: PluginManager | undefined;
    private agentEventBus?: any;

    constructor(
        mcpManager: MCPManager,
        model: LanguageModelV1,
        provider: string,
        sessionEventBus: SessionEventBus,
        contextManager: ContextManager,
        maxIterations: number = 10,
        sessionId: string,
        temperature?: number,
        maxOutputTokens?: number,
        baseURL?: string,
        pluginManager?: PluginManager
    ) {
        this.model = model;
        this.provider = provider;
        this.maxIterations = maxIterations;
        this.mcpManager = mcpManager;
        this.sessionEventBus = sessionEventBus;
        this.contextManager = contextManager;
        this.temperature = temperature;
        this.maxOutputTokens = maxOutputTokens;
        this.sessionId = sessionId;
        this.baseURL = baseURL;
        this.pluginManager = pluginManager ?? undefined;

        logger.debug(
            `[VercelLLMService] Initialized for model: ${this.model.modelId}, provider: ${this.provider}, temperature: ${temperature}, maxOutputTokens: ${maxOutputTokens}`
        );
    }

    getAllTools(): Promise<ToolSet> {
        return this.mcpManager.getAllTools();
    }

    formatTools(tools: ToolSet): VercelToolSet {
        logger.debug(`Formatting tools for vercel`);
        return Object.keys(tools).reduce<VercelToolSet>((acc, toolName) => {
            const tool = tools[toolName];
            if (tool) {
                acc[toolName] = {
                    parameters: jsonSchema(tool.parameters as any),
                    execute: async (args: any) => {
                        try {
                            // Execute beforeToolCall hooks
                            if (this.pluginManager) {
                                const beforeResult = await this.pluginManager.executeHook(
                                    'beforeToolCall',
                                    this.sessionId,
                                    this.sessionEventBus,
                                    {
                                        toolName,
                                        args,
                                        sessionId: this.sessionId,
                                        sessionEventBus: this.sessionEventBus,
                                        agentEventBus: undefined as any, // Will be set by plugin manager
                                        logger,
                                        mcpManager: this.mcpManager,
                                        promptManager: undefined as any, // Will be set by plugin manager
                                        stateManager: undefined as any, // Will be set by plugin manager
                                    },
                                    args
                                );

                                if (!beforeResult.success) {
                                    logger.error(
                                        `beforeToolCall hook failed: ${beforeResult.error?.message}`
                                    );
                                    return {
                                        error: beforeResult.error?.message || 'Plugin hook failed',
                                    };
                                }

                                // Use modified args if provided
                                if (beforeResult.result !== undefined) {
                                    args = beforeResult.result;
                                }
                            }

                            // Execute the tool
                            const result = await this.mcpManager.executeTool(
                                toolName,
                                args,
                                this.sessionId
                            );

                            // Execute afterToolCall hooks
                            if (this.pluginManager) {
                                const afterResult = await this.pluginManager.executeHook(
                                    'afterToolCall',
                                    this.sessionId,
                                    this.sessionEventBus,
                                    {
                                        toolName,
                                        args,
                                        result,
                                        success: true,
                                        sessionId: this.sessionId,
                                        sessionEventBus: this.sessionEventBus,
                                        agentEventBus: undefined as any, // Will be set by plugin manager
                                        logger,
                                        mcpManager: this.mcpManager,
                                        promptManager: undefined as any, // Will be set by plugin manager
                                        stateManager: undefined as any, // Will be set by plugin manager
                                    },
                                    result
                                );

                                if (!afterResult.success) {
                                    logger.error(
                                        `afterToolCall hook failed: ${afterResult.error?.message}`
                                    );
                                }

                                // Use modified result if provided
                                return afterResult.result !== undefined
                                    ? afterResult.result
                                    : result;
                            }

                            return result;
                        } catch (err: any) {
                            // Execute afterToolCall hooks for error cases
                            if (this.pluginManager) {
                                await this.pluginManager.executeHook(
                                    'afterToolCall',
                                    this.sessionId,
                                    this.sessionEventBus,
                                    {
                                        toolName,
                                        args,
                                        result: err,
                                        success: false,
                                        sessionId: this.sessionId,
                                        sessionEventBus: this.sessionEventBus,
                                        agentEventBus: undefined as any, // Will be set by plugin manager
                                        logger,
                                        mcpManager: this.mcpManager,
                                        promptManager: undefined as any, // Will be set by plugin manager
                                        stateManager: undefined as any, // Will be set by plugin manager
                                    },
                                    err
                                );
                            }

                            if (err instanceof ToolExecutionDeniedError) {
                                return { error: err.message, denied: true };
                            }
                            // Other failures
                            const message = err instanceof Error ? err.message : String(err);
                            return { error: message };
                        }
                    },
                    ...(tool.description && { description: tool.description }),
                };
            }
            return acc;
        }, {});
    }

    private async validateToolSupport(): Promise<boolean> {
        const modelKey = `${this.provider}:${this.model.modelId}`;

        // Check cache first
        if (this.toolSupportCache.has(modelKey)) {
            return this.toolSupportCache.get(modelKey)!;
        }

        // Only test tool support for providers using custom baseURL endpoints
        // Built-in providers without baseURL have known tool support
        if (!this.baseURL) {
            logger.debug(`Skipping tool validation for ${modelKey} - no custom baseURL`);
            // Assume built-in providers support tools
            this.toolSupportCache.set(modelKey, true);
            return true;
        }

        logger.debug(`Testing tool support for custom endpoint model: ${modelKey}`);

        // Create a minimal test tool
        const testTool = {
            test_tool: {
                parameters: jsonSchema({
                    type: 'object',
                    properties: {},
                    additionalProperties: false,
                }),
                execute: async () => ({ result: 'test' }),
            },
        };

        try {
            // Make a minimal generateText call with tools to test support
            await generateText({
                model: this.model,
                messages: [{ role: 'user', content: 'Hello' }],
                tools: testTool,
                maxSteps: 1,
            });

            // If we get here, tools are supported
            this.toolSupportCache.set(modelKey, true);
            logger.debug(`Model ${modelKey} supports tools`);
            return true;
        } catch (error: any) {
            if (error.message.includes('does not support tools')) {
                this.toolSupportCache.set(modelKey, false);
                logger.debug(`Model ${modelKey} does not support tools`);
                return false;
            }
            // Other errors - assume tools are supported and let the actual call handle it
            logger.debug(
                `Tool validation error for ${modelKey}, assuming supported: ${error.message}`
            );
            this.toolSupportCache.set(modelKey, true);
            return true;
        }
    }

    async completeTask(
        userInput: string,
        imageData?: ImageData,
        stream?: boolean
    ): Promise<string> {
        // Add user message, with optional image data
        logger.debug(
            `VercelLLMService: Adding user message: ${userInput} and imageData: ${imageData}`
        );
        await this.contextManager.addUserMessage(userInput, imageData);

        // Get all tools
        const tools = await this.mcpManager.getAllTools();
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
                const context = { mcpManager: this.mcpManager };
                const {
                    formattedMessages,
                    systemPrompt: _systemPrompt,
                    tokensUsed,
                } = await this.contextManager.getFormattedMessagesWithCompression(context);

                logger.silly(
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

        // Check if model supports tools and adjust accordingly
        const supportsTools = await this.validateToolSupport();
        const effectiveTools = supportsTools ? tools : {};

        if (!supportsTools && Object.keys(tools).length > 0) {
            logger.debug(
                `Model ${this.model.modelId} does not support tools, using empty tools object for generation`
            );
        }

        const response = await generateText({
            model: this.model,
            messages: messages,
            tools: effectiveTools,
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
                if (step.usage?.totalTokens !== undefined) {
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

        // Parse and append each new InternalMessage from the formatter using ContextManager
        await this.contextManager.processLLMResponse(response);

        // Update ContextManager with actual token count for hybrid approach
        if (totalTokens > 0) {
            this.contextManager.updateActualTokenCount(totalTokens);
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

        // Check if model supports tools and adjust accordingly
        const supportsTools = await this.validateToolSupport();
        const effectiveTools = supportsTools ? tools : {};

        if (!supportsTools && Object.keys(tools).length > 0) {
            logger.debug(
                `Model ${this.model.modelId} does not support tools, using empty tools object for streaming`
            );
        }

        // use vercel's streamText
        const response = streamText({
            model: this.model,
            messages: messages,
            tools: effectiveTools,
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

                // Track token usage from each step as fallback for providers that don't report final usage
                if (step.usage?.totalTokens !== undefined) {
                    totalTokens += step.usage.totalTokens;
                    logger.debug(
                        `Step ${stepIteration} tokens: ${step.usage.totalTokens}, running total: ${totalTokens}`
                    );
                }

                // Emit response event for step text (without token count until final)
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

                // Use final result usage if available (authoritative), otherwise keep accumulated count
                // Some providers may not report final usage, so we maintain both approaches:
                // 1. Accumulate step tokens as fallback (done in onStepFinish above)
                // 2. Use final result tokens if provided (more accurate for providers that support it)
                if (result.usage && result.usage.totalTokens !== undefined) {
                    const accumulatedTokens = totalTokens;
                    totalTokens = result.usage.totalTokens;
                    logger.debug(
                        `Token count - Accumulated: ${accumulatedTokens}, Final result: ${totalTokens}`
                    );
                } else {
                    logger.debug(
                        `Using accumulated token count: ${totalTokens} (no final usage provided)`
                    );
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

        // Process the LLM response through ContextManager using the new stream method
        await this.contextManager.processLLMStreamResponse(response);

        // Update ContextManager with actual token count for hybrid approach
        if (totalTokens > 0) {
            logger.debug(`Stream finished, updating actual token count: ${totalTokens}`);
            this.contextManager.updateActualTokenCount(totalTokens);
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
        const configuredMaxTokens = this.contextManager.getMaxInputTokens();
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
