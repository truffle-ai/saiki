import { IMessageFormatter } from './formatters/types.js';
import { InternalMessage, ImageData } from './types.js';
import { ITokenizer } from '../tokenizer/types.js';
import { ICompressionStrategy } from './compression/types.js';
import { MiddleRemovalStrategy } from './compression/middle-removal.js';
import { OldestRemovalStrategy } from './compression/oldest-removal.js';
import { logger } from '../../../utils/logger.js';
import { getImageData, countMessagesTokens } from './utils.js';
import { DynamicContributorContext } from '../../systemPrompt/types.js';
import { PromptManager } from '../../systemPrompt/manager.js';

/**
 * Manages conversation history and provides message formatting capabilities.
 * The MessageManager is responsible for:
 * - Storing and validating conversation messages
 * - Managing the system prompt
 * - Formatting messages for specific LLM providers through an injected formatter
 * - Optionally counting tokens using a provided tokenizer
 * - Applying compression strategies sequentially if token limits are exceeded
 * - Providing access to conversation history
 */
export class MessageManager {
    /**
     * Internal storage for conversation messages
     */
    private history: InternalMessage[] = [];

    /**
     * PromptManager used for the conversation
     */
    private promptManager: PromptManager;

    /**
     * Formatter used to convert internal messages to LLM-specific format
     */
    private formatter: IMessageFormatter;

    /**
     * Maximum number of tokens allowed in the conversation (if specified)
     */
    private maxTokens: number;

    /**
     * Tokenizer used for counting tokens and enabling compression (if specified)
     */
    private tokenizer: ITokenizer;

    /**
     * The sequence of compression strategies to apply when maxTokens is exceeded.
     * The order in this array matters, as strategies are applied sequentially until
     * the token count is within the limit.
     */
    private compressionStrategies: ICompressionStrategy[];

    /**
     * Creates a new MessageManager instance
     *
     * @param formatter Formatter implementation for the target LLM provider
     * @param promptManager PromptManager instance for the conversation
     * @param maxTokens Maximum token limit for the conversation history. Triggers compression if exceeded and a tokenizer is provided.
     * @param tokenizer Tokenizer implementation used for counting tokens and enabling compression.
     * @param compressionStrategies Optional array of compression strategies to apply sequentially when maxTokens is exceeded. Defaults to [MiddleRemoval, OldestRemoval]. Order matters.
     */
    constructor(
        formatter: IMessageFormatter,
        promptManager: PromptManager,
        maxTokens: number,
        tokenizer: ITokenizer,
        compressionStrategies: ICompressionStrategy[] = [
            new MiddleRemovalStrategy(),
            new OldestRemovalStrategy(),
        ]
    ) {
        if (!promptManager) throw new Error('promptManager is required');
        if (maxTokens == null) throw new Error('maxTokens is required');
        if (!tokenizer) throw new Error('tokenizer is required');
        this.formatter = formatter;
        this.promptManager = promptManager;
        this.maxTokens = maxTokens;
        this.tokenizer = tokenizer;
        this.compressionStrategies = compressionStrategies;
    }

    /**
     * Returns the current token count of the conversation history.
     * @returns The number of tokens in the current history
     */
    getTokenCount(): number {
        return countMessagesTokens(this.history, this.tokenizer);
    }

    /**
     * Returns the configured maximum number of tokens for the conversation.
     */
    getMaxTokens(): number {
        return this.maxTokens;
    }

    /**
     * Assembles and returns the current system prompt by invoking the PromptManager.
     */
    async getSystemPrompt(context: DynamicContributorContext): Promise<string> {
        const prompt = await this.promptManager.build(context);
        logger.debug(`[SystemPrompt] Built system prompt:\n${prompt}`);
        return prompt;
    }

    /**
     * Gets the raw conversation history
     * Returns a defensive copy to prevent modification
     *
     * @returns A read-only copy of the conversation history
     */
    getHistory(): Readonly<InternalMessage[]> {
        return [...this.history];
    }

    /**
     * Adds a message to the conversation history.
     * Performs validation based on message role and required fields.
     * Note: Compression based on token limits is applied lazily when calling `getFormattedMessages`, not immediately upon adding.
     *
     * @param message The message to add to the history
     * @throws Error if message validation fails
     */
    addMessage(message: InternalMessage): void {
        // Validation based on role
        if (!message.role) {
            throw new Error('MessageManager: Message must have a role.');
        }

        switch (message.role) {
            case 'user':
                if (
                    // Allow array content for user messages
                    !(Array.isArray(message.content) && message.content.length > 0) &&
                    (typeof message.content !== 'string' || message.content.trim() === '')
                ) {
                    throw new Error(
                        'MessageManager: User message content should be a non-empty string or a non-empty array of parts.'
                    );
                }
                // Optional: Add validation for the structure of array parts if needed
                break;
            case 'assistant':
                // Content can be null if toolCalls are present, but one must exist
                if (
                    message.content === null &&
                    (!message.toolCalls || message.toolCalls.length === 0)
                ) {
                    throw new Error(
                        'MessageManager: Assistant message must have content or toolCalls.'
                    );
                }
                if (message.toolCalls) {
                    if (
                        !Array.isArray(message.toolCalls) ||
                        message.toolCalls.some(
                            (tc) => !tc.id || !tc.function?.name || !tc.function?.arguments
                        )
                    ) {
                        throw new Error(
                            'MessageManager: Invalid toolCalls structure in assistant message.'
                        );
                    }
                }
                break;
            case 'tool':
                if (!message.toolCallId || !message.name || message.content === null) {
                    throw new Error(
                        'MessageManager: Tool message missing required fields (toolCallId, name, content).'
                    );
                }
                break;
            case 'system':
                // System messages should ideally be handled via setSystemPrompt
                logger.warn(
                    'MessageManager: Adding system message directly to history. Use setSystemPrompt instead.'
                );
                if (typeof message.content !== 'string' || message.content.trim() === '') {
                    throw new Error(
                        'MessageManager: System message content must be a non-empty string.'
                    );
                }
                break;
            default:
                throw new Error(`MessageManager: Unknown message role: ${(message as any).role}`);
        }

        this.history.push(message);
        // Note: Compression is currently handled lazily in getFormattedMessages
    }

    /**
     * Convenience method to add a user message to the conversation
     *
     * @param content The user message content
     * @throws Error if content is empty or not a string
     */
    addUserMessage(textContent: string, imageData?: ImageData): void {
        if (typeof textContent !== 'string' || textContent.trim() === '') {
            throw new Error('addUserMessage: Content must be a non-empty string.');
        }
        const messageParts: InternalMessage['content'] = imageData
            ? [
                  { type: 'text', text: textContent },
                  { type: 'image', image: imageData.image, mimeType: imageData.mimeType },
              ]
            : [{ type: 'text', text: textContent }];
        this.addMessage({ role: 'user', content: messageParts });
    }

    /**
     * Adds an assistant message to the conversation
     * Can include tool calls if the assistant is requesting tool execution
     *
     * @param content The assistant's response text (can be null if only tool calls)
     * @param toolCalls Optional tool calls requested by the assistant
     * @throws Error if neither content nor toolCalls are provided
     */
    addAssistantMessage(content: string | null, toolCalls?: InternalMessage['toolCalls']): void {
        // Validate that either content or toolCalls is provided
        if (content === null && (!toolCalls || toolCalls.length === 0)) {
            throw new Error('addAssistantMessage: Must provide content or toolCalls.');
        }
        // Further validation happens within addMessage
        this.addMessage({ role: 'assistant', content, toolCalls });
    }

    /**
     * Adds a tool result message to the conversation
     *
     * @param toolCallId ID of the tool call this result is responding to
     * @param name Name of the tool that executed
     * @param result The result returned by the tool
     * @throws Error if required parameters are missing
     */
    addToolResult(toolCallId: string, name: string, result: any): void {
        if (!toolCallId || !name) {
            throw new Error('addToolResult: toolCallId and name are required.');
        }

        // Simplest image detection: if result has an 'image' field, treat as ImagePart
        let content: InternalMessage['content'];
        if (result && typeof result === 'object' && 'image' in result) {
            // Use shared helper to get base64/URL
            const imagePart = result as {
                image: string | Uint8Array | Buffer | ArrayBuffer | URL;
                mimeType?: string;
            };
            content = [
                {
                    type: 'image',
                    image: getImageData(imagePart),
                    mimeType: imagePart.mimeType,
                },
            ];
        } else if (typeof result === 'string') {
            content = result;
        } else if (Array.isArray(result)) {
            // Assume array of parts already
            content = result;
        } else {
            // Fallback: stringify all other values
            content = JSON.stringify(result ?? '');
        }

        this.addMessage({ role: 'tool', content, toolCallId, name });
    }

    /**
     * Sets the system prompt for the conversation
     *
     * @param prompt The system prompt text
     */
    setSystemPrompt(prompt: string): void {
        // This method is no longer used with systemPromptContributors
    }

    /**
     * Gets the conversation history formatted for the target LLM provider.
     * Applies compression strategies sequentially if the manager is configured with a `maxTokens` limit
     * and a `tokenizer`, and the current token count exceeds the limit. Compression happens *before* formatting.
     * Uses the injected formatter to convert internal messages (potentially compressed) to the provider's format.
     *
     * @param context The DynamicContributorContext for system prompt contributors and formatting
     * @param systemPrompt (Optional) Precomputed system prompt string. If provided, it will be used instead of recomputing the system prompt. Useful for avoiding duplicate computation when both the formatted messages and the raw system prompt are needed in the same request.
     * @returns Formatted messages ready to send to the LLM provider API
     * @throws Error if formatting or compression fails critically
     */
    async getFormattedMessages(
        context: DynamicContributorContext,
        systemPrompt?: string
    ): Promise<any[]> {
        // Apply compression if needed *before* formatting
        this.compressHistoryIfNeeded();

        try {
            // Use pre-computed system prompt if provided
            const prompt = systemPrompt ?? (await this.getSystemPrompt(context));
            return this.formatter.format([...this.history], prompt);
        } catch (error) {
            logger.error('Error formatting messages:', error);
            throw new Error(
                `Failed to format messages: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Gets the system prompt formatted for the target LLM provider
     * Some providers handle system prompts differently
     *
     * @returns Formatted system prompt or null/undefined based on formatter implementation
     * @throws Error if formatting fails
     */
    async getFormattedSystemPrompt(
        context: DynamicContributorContext
    ): Promise<string | null | undefined> {
        try {
            const systemPrompt = await this.getSystemPrompt(context);
            return this.formatter.formatSystemPrompt?.(systemPrompt);
        } catch (error) {
            console.error('Error getting formatted system prompt:', error);
            throw new Error(`Failed to get formatted system prompt: ${error}`);
        }
    }

    /**
     * Resets the conversation history
     * Does not reset the system prompt
     */
    reset(): void {
        this.history = [];
        // Note: We don't reset the system prompt as it's usually fixed for a service
    }

    /**
     * Checks if history compression is needed based on token count and applies strategies.
     */
    private compressHistoryIfNeeded(): void {
        let currentTotalTokens: number = this.getTokenCount();
        logger.debug(`MessageManager: Checking if history compression is needed.`);
        // If counting failed or we are within limits, do nothing
        if (currentTotalTokens <= this.maxTokens) {
            logger.debug(
                `MessageManager: History compression not needed. Current token count: ${currentTotalTokens}, Max tokens: ${this.maxTokens}`
            );
            return;
        }

        logger.info(
            `MessageManager: History exceeds token limit (${currentTotalTokens} > ${this.maxTokens}). Applying compression strategies sequentially.`
        );

        const initialLength = this.history.length;

        // Iterate through the configured compression strategies
        for (const strategy of this.compressionStrategies) {
            const strategyName = strategy.constructor.name; // Get the class name for logging
            logger.debug(`MessageManager: Applying ${strategyName}...`);

            try {
                // Pass a copy of the history to avoid potential side effects within the strategy
                // The strategy should return the new, potentially compressed, history
                this.history = strategy.compress([...this.history], this.tokenizer, this.maxTokens);
            } catch (error) {
                logger.error(`MessageManager: Error applying ${strategyName}:`, error);
                // Decide if we should stop or try the next strategy. Let's stop for now.
                break;
            }

            // Recalculate tokens after applying the strategy
            currentTotalTokens = this.getTokenCount();
            const messagesRemoved = initialLength - this.history.length;

            // If counting failed or we are now within limits, stop applying strategies
            if (currentTotalTokens <= this.maxTokens) {
                logger.debug(
                    `MessageManager: Compression successful after ${strategyName}. New count: ${currentTotalTokens}, messages removed: ${messagesRemoved}`
                );
                break;
            }
        }
    }

    /**
     * Parses a raw LLM response, converts it into internal messages and adds them to the history.
     *
     * @param response The response from the LLM provider
     */
    processLLMResponse(response: any): void {
        const msgs = this.formatter.parseResponse(response) ?? [];
        msgs.forEach((m) => this.addMessage(m));
    }
}
