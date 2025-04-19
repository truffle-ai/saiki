import { IMessageFormatter } from './types.js';
import { InternalMessage } from '../types.js';

/**
 * Message formatter for OpenAI's Chat Completion API.
 *
 * Converts the internal message format to OpenAI's specific structure:
 * - System prompt is included in the messages array
 * - Tool calls use the tool_calls property with a structure matching OpenAI's API
 * - Tool results use the 'tool' role with tool_call_id and name
 */
export class OpenAIMessageFormatter implements IMessageFormatter {
    /**
     * Formats internal messages into OpenAI's Chat Completion API format
     *
     * @param history Array of internal messages to format
     * @returns Array of messages formatted for OpenAI's API
     */
    format(history: Readonly<InternalMessage[]>): any[] {
        const formatted = [];

        for (const msg of history) {
            switch (msg.role) {
                case 'system':
                    formatted.push({
                        role: 'system',
                        content: msg.content,
                    });
                    break;

                case 'user':
                    formatted.push({
                        role: 'user',
                        content: msg.content,
                    });
                    break;

                case 'assistant':
                    // Assistant messages may or may not have tool calls
                    if (msg.toolCalls && msg.toolCalls.length > 0) {
                        formatted.push({
                            role: 'assistant',
                            content: msg.content,
                            tool_calls: msg.toolCalls,
                        });
                    } else {
                        formatted.push({
                            role: 'assistant',
                            content: msg.content,
                        });
                    }
                    break;

                case 'tool':
                    // Tool results for OpenAI
                    formatted.push({
                        role: 'tool',
                        content: msg.content,
                        tool_call_id: msg.toolCallId,
                        name: msg.name,
                    });
                    break;
            }
        }

        return formatted;
    }

    /**
     * OpenAI handles system prompts in the messages array
     * This method returns null since the system prompt is already
     * included directly in the formatted messages.
     *
     * @returns null as OpenAI doesn't need a separate system prompt
     */
    formatSystemPrompt(systemPrompt: string): string {
        return systemPrompt;
    }
}
