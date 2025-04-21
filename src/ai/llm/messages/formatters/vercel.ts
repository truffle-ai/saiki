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
                    
                    let toolResultPart: any; // Renamed for clarity

                    if (Array.isArray(msg.content) && msg.content[0]?.type === 'image') {
                        // Content is an image part array, use experimental_content
                        const imagePart = msg.content[0];

                        // Ensure the image data is base64 string as per ToolResultContent spec
                        let imageDataBase64: string;
                        if (typeof imagePart.image === 'string') {
                            // Assume it's already base64 or a data URL (Vercel might handle data URLs)
                            imageDataBase64 = imagePart.image;
                        } else if (imagePart.image instanceof Buffer) {
                            imageDataBase64 = imagePart.image.toString('base64');
                        } else if (imagePart.image instanceof Uint8Array) {
                            imageDataBase64 = Buffer.from(imagePart.image).toString('base64');
                        } else if (imagePart.image instanceof ArrayBuffer) {
                           imageDataBase64 = Buffer.from(imagePart.image).toString('base64');
                        } else if (imagePart.image instanceof URL) {
                           imageDataBase64 = imagePart.image.toString(); // Pass URL string
                        } else {
                            // Fallback or throw error if type is unexpected
                            console.warn('Unexpected image data type in Vercel formatter for tool result:', typeof imagePart.image);
                            imageDataBase64 = '[Unsupported image data type]';
                        }

                        toolResultPart = {
                            type: 'tool-result',
                            toolCallId: msg.toolCallId!,
                            toolName: msg.name!,
                            result: null, // Standard result is null when using experimental_content
                            experimental_content: [
                                {
                                    type: 'image',
                                    data: imageDataBase64, // Use the prepared base64 string
                                    mimeType: imagePart.mimeType,
                                },
                            ],
                        };
                    } else {
                        // Content is not an image part array, use the standard result field
                        toolResultPart = {
                            type: 'tool-result',
                            toolCallId: msg.toolCallId!,
                            toolName: msg.name!,
                            // Use msg.content directly (should be string or JSON-like)
                            // If it was previously stringified JSON, keep it that way.
                            // If it's already a serializable object, it should work.
                            result: msg.content,
                        };
                    }
                    
                    formatted.push({
                        role: 'tool', 
                        content: [ toolResultPart ], // Vercel expects tool results wrapped in a content array
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
