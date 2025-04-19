import { LanguageModelV1 } from 'ai';
import { EventEmitter } from 'events';
import { ToolSet } from '../../types.js';

/**
 * Core interface for LLM service implementations
 */
export interface ILLMService {
    // Primary method for handling a user interaction from start to finish
    completeTask(userInput: string): Promise<string>;

    // Clear conversation history
    resetConversation(): void;

    // Get all available tools
    getAllTools(): Promise<ToolSet>;

    // Get configuration information about the LLM service
    getConfig(): { provider: string; model: string } | { model: LanguageModelV1 };

    // Get event emitter for subscribing to events
    getEventEmitter(): EventEmitter;
}
