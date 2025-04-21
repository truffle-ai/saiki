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
                        // Format according to CoreAssistantMessage with ToolCallPart(s)
                        // See: https://sdk.vercel.ai/docs/reference/ai-sdk-core/core-message#coreassistantmessage
                        const contentParts: any[] = [];

                        // Add text part if content exists
                        if (msg.content) {
                            contentParts.push({ type: 'text', text: msg.content });
                        }

                        // Add tool_call parts
                        for (const toolCall of msg.toolCalls) {
                            contentParts.push({
                                type: 'tool-call',
                                toolCallId: toolCall.id,
                                toolName: toolCall.function.name,
                                // Ensure args are parsed if they are a string, otherwise pass as is
                                // The SDK expects args as an object
                                args: typeof toolCall.function.arguments === 'string'
                                        ? JSON.parse(toolCall.function.arguments)
                                        : toolCall.function.arguments,
                            });
                        }

                        formatted.push({
                            role: 'assistant',
                            content: contentParts,
                            // Remove deprecated function_call
                        });
                    } else {
                        // Standard assistant message without tool calls
                        formatted.push({
                            role: 'assistant',
                            content: msg.content, // Should be string | null
                        });
                    }
                    break;

                case 'tool':
                    // Convert internal tool results to Vercel's expected 'tool' role format
                    // See: https://sdk.vercel.ai/docs/reference/ai-sdk-core/core-message#coretoolmessage
                    formatted.push({
                        role: 'tool', // Use 'tool' role instead of 'function'
                        content: [
                            // Vercel expects tool results wrapped in a content array
                            {
                                type: 'tool-result',
                                toolCallId: msg.toolCallId!,
                                toolName: msg.name!,
                                result: msg.content, // Assuming msg.content is the stringified result
                            },
                        ],
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
