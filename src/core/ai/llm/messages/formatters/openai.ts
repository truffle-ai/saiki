import { IMessageFormatter } from './types.js';
import { InternalMessage } from '../types.js';
import { getImageData } from '../utils.js';

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
     * @param systemPrompt System prompt to include at the beginning of messages
     * @returns Array of messages formatted for OpenAI's API
     */
    format(history: Readonly<InternalMessage[]>, systemPrompt: string | null): any[] {
        const formatted = [];

        // Add system message if provided
        if (systemPrompt) {
            formatted.push({
                role: 'system',
                content: systemPrompt,
            });
        }

        for (const msg of history) {
            switch (msg.role) {
                case 'system':
                    // We already handled the systemPrompt, but if there are additional
                    // system messages in the history, add them
                    formatted.push({
                        role: 'system',
                        content: msg.content,
                    });
                    break;

                case 'user':
                    formatted.push({
                        role: 'user',
                        content: this.formatUserContent(msg.content),
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
    formatSystemPrompt(): null {
        return null;
    }

    /**
     * Parses OpenAI API response into internal message objects.
     */
    parseResponse(response: any): InternalMessage[] {
        const internal: InternalMessage[] = [];
        if (!response.choices || !Array.isArray(response.choices)) return internal;
        for (const choice of response.choices) {
            const msg = (choice as any).message;
            if (!msg || !msg.role) continue;
            const role = msg.role as InternalMessage['role'];
            // Assistant messages
            if (role === 'assistant') {
                const content = msg.content ?? null;
                // Handle tool calls if present
                if (msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
                    const calls = msg.tool_calls.map((call: any) => ({
                        id: call.id,
                        type: 'function' as const,
                        function: {
                            name: call.function.name,
                            arguments: call.function.arguments,
                        },
                    }));
                    internal.push({ role: 'assistant', content, toolCalls: calls });
                } else {
                    internal.push({ role: 'assistant', content });
                }
            }
            // Tool result messages
            else if (role === 'tool') {
                internal.push({
                    role: 'tool',
                    content: msg.content!,
                    toolCallId: msg.tool_call_id!,
                    name: msg.name!,
                });
            }
            // User or system messages (rare in responses)
            else if (role === 'user' || role === 'system') {
                if (msg.content) {
                    internal.push({ role, content: msg.content });
                }
            }
        }
        return internal;
    }

    // Helper to format user message parts (text + image) into chat API shape
    private formatUserContent(content: InternalMessage['content']): any {
        if (!Array.isArray(content)) {
            return content;
        }
        return content
            .map((part) => {
                if (part.type === 'text') {
                    return { type: 'text', text: part.text };
                }
                if (part.type === 'image') {
                    const raw = getImageData(part);
                    const url =
                        raw.startsWith('http://') ||
                        raw.startsWith('https://') ||
                        raw.startsWith('data:')
                            ? raw
                            : `data:${part.mimeType || 'application/octet-stream'};base64,${raw}`;
                    return { type: 'image_url', image_url: { url } };
                }
                return null;
            })
            .filter(Boolean);
    }
}
