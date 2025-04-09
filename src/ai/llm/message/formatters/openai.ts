import { IMessageFormatter } from '../formatter.js';
import { InternalMessage } from '../types.js';

export class OpenAIFormatter implements IMessageFormatter {
    format(history: Readonly<InternalMessage[]>, systemPrompt: string | null): any[] {
        const formatted = [];
        
        // Add system message if provided
        if (systemPrompt) {
            formatted.push({
                role: 'system',
                content: systemPrompt
            });
        }
        
        for (const msg of history) {
            switch(msg.role) {
                case 'system':
                    // We already handled the systemPrompt, but if there are additional
                    // system messages in the history, add them
                    formatted.push({
                        role: 'system',
                        content: msg.content
                    });
                    break;
                    
                case 'user':
                    formatted.push({
                        role: 'user',
                        content: msg.content
                    });
                    break;
                    
                case 'assistant':
                    // Assistant messages may or may not have tool calls
                    if (msg.toolCalls && msg.toolCalls.length > 0) {
                        formatted.push({
                            role: 'assistant',
                            content: msg.content,
                            tool_calls: msg.toolCalls
                        });
                    } else {
                        formatted.push({
                            role: 'assistant',
                            content: msg.content
                        });
                    }
                    break;
                    
                case 'tool':
                    // Tool results for OpenAI
                    formatted.push({
                        role: 'tool',
                        content: msg.content,
                        tool_call_id: msg.toolCallId,
                        name: msg.name
                    });
                    break;
            }
        }
        
        return formatted;
    }
    
    // OpenAI includes the system prompt in the messages array
    getSystemPrompt(): null {
        return null;
    }
} 