import { IMessageFormatter } from '../formatter.js';
import { InternalMessage } from '../types.js';
import { logger } from '../../../../utils/logger.js';

export class AnthropicFormatter implements IMessageFormatter {
    format(history: Readonly<InternalMessage[]>, systemPrompt: string | null): any[] {
        const formatted = [];
        
        // We need to track tool calls and their associated results
        const pendingToolCalls = new Map<string, {
            assistantMsg: any;
            index: number;
        }>();
        
        // Process messages in chronological order
        for (let i = 0; i < history.length; i++) {
            const msg = history[i];
            
            // Skip system messages
            if (msg.role === 'system') continue;
            
            // 1. Regular user message (not a tool result)
            if (msg.role === 'user' && !msg.toolCallId) {
                formatted.push({
                    role: 'user',
                    content: msg.content
                });
                continue;
            }
            
            // 2. Tool result - find its corresponding tool call and add both
            if (msg.role === 'tool' && msg.toolCallId) {
                const pendingCall = pendingToolCalls.get(msg.toolCallId);
                
                if (pendingCall) {
                    // Found matching tool call - add it first (if not already added)
                    if (pendingCall.assistantMsg) {
                        formatted.push(pendingCall.assistantMsg);
                        pendingCall.assistantMsg = null; // Mark as processed
                    }
                    
                    // Then add the tool result as a user message
                    formatted.push({
                        role: 'user',
                        content: [{
                            type: 'tool_result',
                            tool_use_id: msg.toolCallId,
                            content: msg.content!
                        }]
                    });
                    
                    // Remove from pending calls
                    pendingToolCalls.delete(msg.toolCallId);
                } else {
                    // This shouldn't normally happen
                    logger.warn(`Tool result found without matching tool call: ${msg.toolCallId}`);
                    formatted.push({
                        role: 'user',
                        content: [{
                            type: 'tool_result',
                            tool_use_id: msg.toolCallId!,
                            content: msg.content!
                        }]
                    });
                }
                continue;
            }
            
            // 3. Assistant message with tool calls
            if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
                // For each tool call in this message
                for (const toolCall of msg.toolCalls) {
                    // Prepare content array for this tool call
                    const contentArray = [];
                    
                    // Add text content if present
                    if (msg.content) {
                        contentArray.push({
                            type: 'text',
                            text: msg.content
                        });
                    }
                    
                    // Add this specific tool call
                    contentArray.push({
                        type: 'tool_use',
                        id: toolCall.id,
                        name: toolCall.function.name,
                        input: JSON.parse(toolCall.function.arguments)
                    });
                    
                    // Create assistant message with just this one tool call
                    const assistantMsg = {
                        role: 'assistant',
                        content: contentArray
                    };
                    
                    // Store as pending - we'll add it when we find its result
                    pendingToolCalls.set(toolCall.id, {
                        assistantMsg,
                        index: i
                    });
                }
                continue;
            }
            
            // 4. Regular assistant message (no tool calls)
            if (msg.role === 'assistant' && (!msg.toolCalls || msg.toolCalls.length === 0)) {
                formatted.push({
                    role: 'assistant',
                    content: msg.content
                });
                continue;
            }
        }
        
        // Add any remaining tool calls that never got their results
        // This generally shouldn't happen, but handle it just in case
        const remainingToolCalls = Array.from(pendingToolCalls.entries())
            .sort((a, b) => a[1].index - b[1].index);
            
        for (const [id, {assistantMsg}] of remainingToolCalls) {
            if (assistantMsg) {
                formatted.push(assistantMsg);
                logger.warn(`Tool call ${id} had no matching tool result`);
            }
        }
        
        return formatted;
    }

    getSystemPrompt(systemPrompt: string | null): string | null {
        // Anthropic uses system prompt as a separate parameter
        return systemPrompt;
    }
} 