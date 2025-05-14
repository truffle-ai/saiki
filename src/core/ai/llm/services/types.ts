import { LanguageModelV1 } from 'ai';
import { EventEmitter } from 'events';
import { ToolSet } from '../../types.js';
import { ImageData } from '../messages/types.js';

/**
 * Core interface for LLM service implementations
 */
export interface ILLMService {
    /**
     * Process a user's task (e.g., text input, potentially with image data)
     * and return the final AI response.
     * Handles potential tool calls and conversation management internally.
     *
     * @param userInput The primary text input from the user.
     * @param imageData Optional image data associated with the user input.
     * @returns A promise that resolves with the final text response from the AI.
     */
    completeTask(userInput: string, imageData?: ImageData): Promise<string>;

    // Clear conversation history
    resetConversation(): void;

    // Get all available tools
    getAllTools(): Promise<ToolSet>;

    // Get configuration information about the LLM service
    getConfig(): LLMServiceConfig;
}

/**
 * Configuration object returned by LLMService.getConfig()
 */
export type LLMServiceConfig = {
    router: string;
    provider: string;
    model: string | LanguageModelV1;
    configuredMaxTokens?: number | null;
    modelMaxTokens?: number | null;
    [key: string]: any;
};
