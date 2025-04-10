import { IMessageFormatter } from './types.js';
import { InternalMessage } from '../types.js';

/**
 * Message formatter for Vercel AI SDK.
 *
 * Converts the internal message format to Vercel's specific structure:
 * - System prompt is included in the messages array
 * - Tool calls use function_call property instead of tool_calls
 * - Tool results use the 'function' role instead of 'tool'
 *
 * Note: Vercel's implementation is different from OpenAI's standard,
 * particularly in its handling of function calls and responses.
 */
export class VercelMessageFormatter implements IMessageFormatter {
    /**
     * Formats internal messages into Vercel AI SDK format
     *
     * @param history Array of internal messages to format
     * @param systemPrompt System prompt to include at the beginning of messages
     * @returns Array of messages formatted for Vercel's API
     */
    format(history: Readonly<InternalMessage[]>, systemPrompt: string | null): any[] {
        const formatted = [];

        // Add system message if present
        if (systemPrompt) {
            formatted.push({
                role: 'system',
                content: systemPrompt,
            });
        }

        for (const msg of history) {
            switch (msg.role) {
                case 'user':
                case 'system':
                    formatted.push({
                        role: msg.role,
                        content: msg.content,
                    });
                    break;

                case 'assistant':
                    if (msg.toolCalls && msg.toolCalls.length > 0) {
                        // Vercel expects function_call for tool calls
                        formatted.push({
                            role: 'assistant',
                            content: msg.content,
                            function_call: {
                                name: msg.toolCalls[0].function.name,
                                arguments: msg.toolCalls[0].function.arguments,
                            },
                        });
                    } else {
                        formatted.push({
                            role: 'assistant',
                            content: msg.content,
                        });
                    }
                    break;

                case 'tool':
                    // Convert internal tool results to Vercel's expected format
                    formatted.push({
                        role: 'function',
                        name: msg.name!,
                        content: msg.content,
                    });
                    break;
            }
        }

        return formatted;
    }

    /**
     * Vercel handles system prompts in the messages array
     * This method returns null since the system prompt is already
     * included directly in the formatted messages.
     *
     * @returns null as Vercel doesn't need a separate system prompt
     */
    getSystemPrompt(): null {
        return null;
    }
}
