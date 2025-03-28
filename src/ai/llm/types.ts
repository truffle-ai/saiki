import { McpTool } from '../types.js';

/**
 * Callbacks for LLM processing events
 */
export interface LLMCallbacks {
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
 * Core interface for LLM service implementations
 */
export interface ILLMService {
    // Primary method for handling a user interaction from start to finish
    completeTask(userInput: string, callbacks?: LLMCallbacks): Promise<string>;

    // Update the system message/context with available tools
    updateSystemContext(tools: McpTool[]| any): void;

    // Clear conversation history
    resetConversation(): void;

    // Get all available tools
    getAllTools(): Promise<any>;

    // Get configuration information about the LLM service
    getConfig(): { provider: string; model: string } | { model: VercelLLM };
}

/**
 * Configuration for creating an LLM service
 */
export interface LLMConfig {
    provider: string;
    apiKey: string;
    model?: string;
    options?: Record<string, any>;
}

export type VercelLLM = any;