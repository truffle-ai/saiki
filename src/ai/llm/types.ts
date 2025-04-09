import { LanguageModelV1 } from 'ai';
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

