/**
 * Agent subscriber interface for listening to agent events
 */
export interface AgentSubscriber {
    // Called when the LLM is processing/thinking
    onThinking?(): void;

    // Called when a chunk of the response is received
    onChunk?(text: string): void;

    // Called when a tool is about to be executed
    onToolCall?(toolName: string, args: any): void;

    // Called when a tool has returned a result
    onToolResult?(toolName: string, result: any): void;

    // Called when the LLM produces a response
    onResponse?(text: string): void;

    // Called when an error occurs
    onError?(error: Error): void;

    // Called when the conversation is reset
    onConversationReset?(): void;
}
