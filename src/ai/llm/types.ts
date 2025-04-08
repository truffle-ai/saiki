import { Tool } from '../types.js';
import { ToolSet } from '../types.js';
import { EventEmitter } from 'events';

/**
 * Callbacks for LLM processing events
 */
export interface LLMCallbacks {
    // Called when a chunk of the response is received
    onChunk?: (chunk: string) => void;

    // Called when the LLM is processing/thinking
    onThinking?: () => void;

    // Called when a tool is about to be executed
    onToolCall?: (toolName: string, args: any) => void;

    // Called when a tool has returned a result
    onToolResult?: (toolName: string, result: any) => void;

    // Called when the LLM produces a response
    onResponse?: (response: string) => void;
}

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

/**
 * Core interface for LLM service implementations
 */
export interface ILLMService {
    // Primary method for handling a user interaction from start to finish
    completeTask(userInput: string, callbacks?: LLMCallbacks): Promise<string>;

    // Update the system message/context
    updateSystemContext(newSystemPrompt: string): void;

    // Clear conversation history
    resetConversation(): void;

    // Get all available tools
    getAllTools(): Promise<ToolSet>;

    // Get configuration information about the LLM service
    getConfig(): { provider: string; model: string } | { model: VercelLLM };
    
    // Get event emitter for subscribing to events
    getEventEmitter(): EventEmitter;
}

export type VercelLLM = any;
