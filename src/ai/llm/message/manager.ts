import { IMessageFormatter } from './formatter.js';
import { InternalMessage } from './types.js';
import { ITokenizer } from '../tokenizer/tokenizer.js';

// Consider adding a proper logger instance later
const logger = console; 

/**
 * Manages conversation history and provides message formatting capabilities.
 * The MessageManager is responsible for:
 * - Storing and validating conversation messages
 * - Managing the system prompt
 * - Formatting messages for specific LLM providers through an injected formatter
 * - Optionally counting tokens and applying compression strategies if limits are exceeded
 * - Providing access to conversation history
 */
export class MessageManager {
    /**
     * Internal storage for conversation messages
     */
    private history: InternalMessage[] = [];
    
    /**
     * System prompt used for the conversation
     */
    private systemPrompt: string | null = null;
    
    /**
     * Formatter used to convert internal messages to LLM-specific format
     */
    private formatter: IMessageFormatter;
    
    /**
     * Maximum number of tokens allowed in the conversation (if specified)
     */
    private maxTokens: number | null = null;

    /**
     * Tokenizer used for counting tokens and enabling compression (if specified)
     */
    private tokenizer: ITokenizer | null = null;

    /**
     * Creates a new MessageManager instance
     * 
     * @param formatter Formatter implementation for the target LLM provider
     * @param systemPrompt Optional system prompt to initialize the conversation
     * @param maxTokens Optional maximum token limit for the conversation. Compression requires a tokenizer.
     * @param tokenizer Optional tokenizer implementation. Required for token counting and compression.
     */
    constructor(
        formatter: IMessageFormatter,
        systemPrompt?: string,
        maxTokens?: number,
        tokenizer?: ITokenizer
    ) {
        this.formatter = formatter;
        if (systemPrompt) {
            this.setSystemPrompt(systemPrompt);
        }
        this.maxTokens = maxTokens ?? null;
        this.tokenizer = tokenizer ?? null;

        // Warning if max tokens set but no tokenizer
        if (this.maxTokens && !this.tokenizer) {
            logger.warn("MessageManager: maxTokens is set but no tokenizer provided. Token limit cannot be enforced, and compression is disabled.");
        }
    }

    /**
     * Adds a message to the conversation history
     * Performs validation based on message role and required fields
     * 
     * @param message The message to add to the history
     * @throws Error if message validation fails
     */
    addMessage(message: InternalMessage): void {
        // Validation based on role
        if (!message.role) {
            throw new Error("MessageManager: Message must have a role.");
        }

        switch (message.role) {
            case 'user':
                if (typeof message.content !== 'string' || message.content.trim() === '') {
                    throw new Error("MessageManager: User message content should be a non-empty string.");
                }
                break;
            case 'assistant':
                // Content can be null if toolCalls are present, but one must exist
                if (message.content === null && (!message.toolCalls || message.toolCalls.length === 0)) {
                    throw new Error("MessageManager: Assistant message must have content or toolCalls.");
                }
                if (message.toolCalls) {
                    if (!Array.isArray(message.toolCalls) || message.toolCalls.some(tc => !tc.id || !tc.function?.name || !tc.function?.arguments)) {
                        throw new Error("MessageManager: Invalid toolCalls structure in assistant message.");
                    }
                }
                break;
            case 'tool':
                if (!message.toolCallId || !message.name || message.content === null) {
                    throw new Error("MessageManager: Tool message missing required fields (toolCallId, name, content).");
                }
                break;
            case 'system':
                // System messages should ideally be handled via setSystemPrompt
                logger.warn("MessageManager: Adding system message directly to history. Use setSystemPrompt instead.");
                if (typeof message.content !== 'string' || message.content.trim() === '') {
                    throw new Error("MessageManager: System message content must be a non-empty string.");
                }
                break;
            default:
                throw new Error(`MessageManager: Unknown message role: ${(message as any).role}`);
        }

        this.history.push(message);
        // Note: Compression is now handled lazily in getFormattedMessages
    }

    /**
     * Convenience method to add a user message to the conversation
     * 
     * @param content The user message content
     * @throws Error if content is empty or not a string
     */
    addUserMessage(content: string): void {
        if (typeof content !== 'string' || content.trim() === '') {
            throw new Error("addUserMessage: Content must be a non-empty string.");
        }
        this.addMessage({ role: 'user', content });
    }

    /**
     * Adds an assistant message to the conversation
     * Can include tool calls if the assistant is requesting tool execution
     * 
     * @param content The assistant's response text (can be null if only tool calls)
     * @param toolCalls Optional tool calls requested by the assistant
     * @throws Error if neither content nor toolCalls are provided
     */
    addAssistantMessage(
        content: string | null,
        toolCalls?: InternalMessage['toolCalls']
    ): void {
        // Validate that either content or toolCalls is provided
        if (content === null && (!toolCalls || toolCalls.length === 0)) {
            throw new Error("addAssistantMessage: Must provide content or toolCalls.");
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
            throw new Error("addToolResult: toolCallId and name are required.");
        }
        // Ensure content is always a string for the internal message
        const content = (result === undefined || result === null) 
                         ? '' 
                         : typeof result === 'string' ? result : JSON.stringify(result);
        this.addMessage({ role: 'tool', content, toolCallId, name });
    }

    /**
     * Sets the system prompt for the conversation
     * 
     * @param prompt The system prompt text
     */
    setSystemPrompt(prompt: string): void {
        this.systemPrompt = prompt;
    }

    /**
     * Retrieves the current system prompt
     * 
     * @returns The system prompt or null if not set
     */
    getSystemPrompt(): string | null {
        return this.systemPrompt;
    }

    /**
     * Counts total tokens in current conversation including system prompt.
     * Requires a tokenizer to be configured.
     * @returns Total token count or null if no tokenizer is available.
     */
    countTotalTokens(): number | null {
        if (!this.tokenizer) return null;
        
        let total = 0;
        const overheadPerMessage = 4; // Approximation for message format overhead

        try {
            // Count system prompt
            if (this.systemPrompt) {
                total += this.tokenizer.countTokens(this.systemPrompt);
            }
            
            // Count each message
            for (const message of this.history) {
                if (message.content) {
                    total += this.tokenizer.countTokens(message.content);
                }
                
                // Count tool calls if present
                if (message.toolCalls) {
                    for (const call of message.toolCalls) {
                        total += this.tokenizer.countTokens(call.function.name);
                        // Ensure arguments exist and are strings before counting
                        if (call.function.arguments) {
                           total += this.tokenizer.countTokens(call.function.arguments);
                        }
                    }
                }
                 // Add overhead for each message structure
                 total += overheadPerMessage;
            }

        } catch (error) {
            logger.error("MessageManager: Error counting tokens:", error);
            // Decide on error handling: return null, throw, or return current total?
            // Returning null indicates counting failed.
            return null; 
        }
        
        return total;
    }

    /**
     * Gets the conversation history formatted for the target LLM provider.
     * Applies compression strategies if a tokenizer and maxTokens are set, 
     * and the current token count exceeds the limit.
     * Uses the injected formatter to convert internal messages to the provider's format.
     * 
     * @returns Formatted messages ready to send to the LLM provider API
     * @throws Error if formatting or compression fails critically
     */
    getFormattedMessages(): any[] {
        // Apply compression if needed *before* formatting
        this.compressHistoryIfNeeded();
        
        try {
            // Pass a read-only view of the potentially compressed history to the formatter
            return this.formatter.format([...this.history], this.systemPrompt);
        } catch (error) {
            logger.error("Error formatting messages:", error);
            throw new Error(`Failed to format messages: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Gets the system prompt formatted for the target LLM provider
     * Some providers handle system prompts differently
     * 
     * @returns Formatted system prompt or null/undefined based on formatter implementation
     * @throws Error if formatting fails
     */
    getFormattedSystemPrompt(): string | null | undefined {
        try {
            // Check if the formatter implements getSystemPrompt and call it
            return this.formatter.getSystemPrompt?.(this.systemPrompt);
        } catch (error) {
            console.error("Error getting formatted system prompt:", error);
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
     * Gets the raw conversation history
     * Returns a defensive copy to prevent modification
     * 
     * @returns A read-only copy of the conversation history
     */
    getHistory(): Readonly<InternalMessage[]> {
        return [...this.history];
    }

    // --- Private Compression Methods ---

    /**
     * Checks if history compression is needed based on token count and applies strategies.
     */
    private compressHistoryIfNeeded(): void {
        // Compression requires both maxTokens and a tokenizer
        if (!this.maxTokens || !this.tokenizer) return;
        
        let currentTotalTokens = this.countTotalTokens();
        logger.debug(`MessageManager: Checking if history compression is needed.`);        
        // If counting failed or we are within limits, do nothing
        if (currentTotalTokens === null || currentTotalTokens <= this.maxTokens) {
            logger.debug(`MessageManager: History compression not needed. Current token count: ${currentTotalTokens}, Max tokens: ${this.maxTokens}`);
            return;
        }
        
        logger.debug(`MessageManager: History exceeds token limit (${currentTotalTokens} > ${this.maxTokens}). Applying compression.`);

        const initialLength = this.history.length;
        
        // Strategy 1: Remove messages from the middle
        this.applyMiddleRemovalCompression();
        
        // Recalculate tokens after first strategy
        currentTotalTokens = this.countTotalTokens();
        if (currentTotalTokens !== null && currentTotalTokens <= this.maxTokens) {
            logger.debug(`MessageManager: Compression (Middle Removal) successful. New count: ${currentTotalTokens}, Messages removed: ${initialLength - this.history.length}`);
            return; 
        }
        
        // If still over limit (or counting failed again), apply more aggressive pruning
        if (currentTotalTokens === null || currentTotalTokens > this.maxTokens) {
            if (currentTotalTokens !== null) { // Log only if we know we're still over
                 logger.debug(`MessageManager: Still over limit (${currentTotalTokens} > ${this.maxTokens}). Applying oldest removal.`);
            }
            this.applyOldestRemovalCompression();
        }

        // Final check and logging
        currentTotalTokens = this.countTotalTokens();
        if (currentTotalTokens !== null && currentTotalTokens <= this.maxTokens) {
             logger.debug(`MessageManager: Compression (Oldest Removal) successful. New count: ${currentTotalTokens}, Total messages removed: ${initialLength - this.history.length}`);
        } else if (currentTotalTokens !== null) {
             logger.warn(`MessageManager: Compression finished, but still over token limit (${currentTotalTokens} > ${this.maxTokens}). History length: ${this.history.length}`);
        } else {
            logger.error("MessageManager: Token counting failed after compression.");
        }
    }
    
    /**
     * Compression Strategy 1: Remove messages from the middle of the conversation.
     * Preserves the first few messages (system context) and the most recent messages (current context).
     */
    private applyMiddleRemovalCompression(): void {
        if (!this.maxTokens || !this.tokenizer) return; // Should not happen if called from compressHistoryIfNeeded

        const preserveStart = 4; // Keep the first ~2 exchanges (adjust as needed)
        const preserveEnd = 5;   // Keep the last ~2-3 exchanges (adjust as needed)
        const minLengthForMiddleRemoval = preserveStart + preserveEnd + 1; // Need at least one message to remove in the middle

        if (this.history.length < minLengthForMiddleRemoval) {
            logger.debug("MessageManager: History too short for middle removal strategy.");
            return; // Not enough messages to apply this strategy meaningfully
        }
        
        // Start removing from the oldest message *after* the initial preserved block
        let removalIndex = preserveStart; 
        
        while (this.history.length >= minLengthForMiddleRemoval) {
            const currentTokens = this.countTotalTokens();
            // Stop if we are within limits or counting failed
            if (currentTokens === null || currentTokens <= this.maxTokens) break;
            // Stop if removing this message would merge the start and end preservation blocks
            if (removalIndex >= this.history.length - preserveEnd) break; 

            // Remove the message at the current removal index
            this.history.splice(removalIndex, 1);
            // Do NOT increment removalIndex, as the next message slides into its place.
        }
    }
    
    /**
     * Compression Strategy 2: Remove the oldest messages (after the system prompt).
     * This is a more aggressive approach used if middle removal isn't enough.
     */
    private applyOldestRemovalCompression(): void {
         if (!this.maxTokens || !this.tokenizer) return; // Safety check

         const minMessagesToKeep = 4; // Always keep at least the last few messages (adjust as needed)

         while (this.history.length > minMessagesToKeep) {
             const currentTokens = this.countTotalTokens();
             // Stop if we are within limits or counting failed
             if (currentTokens === null || currentTokens <= this.maxTokens) break;

             // Remove the oldest message (index 0)
             this.history.shift(); 
         }
    }
} 