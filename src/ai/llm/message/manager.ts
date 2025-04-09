import { IMessageFormatter } from './formatter.js';
import { InternalMessage } from './types.js';

/**
 * Manages conversation history and provides message formatting capabilities.
 * The MessageManager is responsible for:
 * - Storing and validating conversation messages
 * - Managing the system prompt
 * - Formatting messages for specific LLM providers through an injected formatter
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
     * Creates a new MessageManager instance
     * 
     * @param formatter Formatter implementation for the target LLM provider
     * @param systemPrompt Optional system prompt to initialize the conversation
     * @param maxTokens Optional maximum token limit for the conversation
     */
    constructor(
        formatter: IMessageFormatter,
        systemPrompt?: string,
        maxTokens?: number
    ) {
        this.formatter = formatter;
        if (systemPrompt) {
            this.setSystemPrompt(systemPrompt);
        }
        this.maxTokens = maxTokens ?? null;
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
                console.warn("MessageManager: Adding system message directly to history. Use setSystemPrompt instead.");
                if (typeof message.content !== 'string' || message.content.trim() === '') {
                    throw new Error("MessageManager: System message content must be a non-empty string.");
                }
                break;
            default:
                throw new Error(`MessageManager: Unknown message role: ${(message as any).role}`);
        }

        this.history.push(message);
        // TODO: Add pruning logic if maxTokens is exceeded (requires tokenizer)
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
     * Gets the conversation history formatted for the target LLM provider
     * Uses the injected formatter to convert internal messages to the provider's format
     * 
     * @returns Formatted messages ready to send to the LLM provider API
     * @throws Error if formatting fails
     */
    getFormattedMessages(): any[] {
        try {
            // Pass a read-only view of history to the formatter
            return this.formatter.format([...this.history], this.systemPrompt);
        } catch (error) {
            console.error("Error formatting messages:", error);
            throw new Error(`Failed to format messages: ${error}`);
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
} 