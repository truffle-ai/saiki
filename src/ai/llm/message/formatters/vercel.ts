import { IMessageFormatter } from '../formatter.js';
import { InternalMessage } from '../types.js';

export class VercelFormatter implements IMessageFormatter {
    format(history: Readonly<InternalMessage[]>, systemPrompt: string | null): any[] {
        const formatted = [];

        // Add system message if present
        if (systemPrompt) {
            formatted.push({
                role: 'system',
                content: systemPrompt
            });
        }

        for (const msg of history) {
            switch (msg.role) {
                case 'user':
                case 'system':
                    formatted.push({
                        role: msg.role,
                        content: msg.content
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
                                arguments: msg.toolCalls[0].function.arguments
                            }
                        });
                    } else {
                        formatted.push({
                            role: 'assistant',
                            content: msg.content
                        });
                    }
                    break;

                case 'tool':
                    // Convert internal tool results to Vercel's expected format
                    formatted.push({
                        role: 'function',
                        name: msg.name!,
                        content: msg.content
                    });
                    break;
            }
        }

        return formatted;
    }

    // Vercel includes system prompt in the messages array
    getSystemPrompt(): null {
        return null;
    }
} 