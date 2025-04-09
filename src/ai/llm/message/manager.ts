import { IMessageFormatter } from './formatter.js';
import { InternalMessage } from './types.js';

export class MessageManager {
    private history: InternalMessage[] = [];
    private systemPrompt: string | null = null;
    private formatter: IMessageFormatter;
    private maxTokens: number | null = null;

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

    // Message management methods
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

    addUserMessage(content: string): void {
        if (typeof content !== 'string' || content.trim() === '') {
            throw new Error("addUserMessage: Content must be a non-empty string.");
        }
        this.addMessage({ role: 'user', content });
    }

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

    // System prompt management
    setSystemPrompt(prompt: string): void {
        this.systemPrompt = prompt;
    }

    getSystemPrompt(): string | null {
        return this.systemPrompt;
    }

    // Formatted message access
    getFormattedMessages(): any[] {
        try {
            // Pass a read-only view of history to the formatter
            return this.formatter.format([...this.history], this.systemPrompt);
        } catch (error) {
            console.error("Error formatting messages:", error);
            throw new Error(`Failed to format messages: ${error}`);
        }
    }

    getFormattedSystemPrompt(): string | null | undefined {
        try {
            // Check if the formatter implements getSystemPrompt and call it
            return this.formatter.getSystemPrompt?.(this.systemPrompt);
        } catch (error) {
            console.error("Error getting formatted system prompt:", error);
            throw new Error(`Failed to get formatted system prompt: ${error}`);
        }
    }

    // Conversation management
    reset(): void {
        this.history = [];
        // Note: We don't reset the system prompt as it's usually fixed for a service
    }

    // Access to message history
    getHistory(): Readonly<InternalMessage[]> {
        return [...this.history];
    }
} 