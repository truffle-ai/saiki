import { InternalMessage } from './types.js';
import { ITokenizer } from '../tokenizer/types.js';

// Approximation for message format overhead
const DEFAULT_OVERHEAD_PER_MESSAGE = 4;

/**
 * Counts the total tokens in an array of InternalMessages using a provided tokenizer.
 * Includes an estimated overhead per message.
 * 
 * NOTE: This function counts tokens on the raw InternalMessage history and has limitations:
 * 1. It does not account for provider-specific formatting (uses raw content).
 * 2. It ignores the token cost of images in multimodal messages (counts text only).
 * 3. The overhead is a fixed approximation.
 * For more accurate counting reflecting the final provider payload, use MessageManager.countTotalTokens().
 *
 * @param history The array of messages to count.
 * @param tokenizer The tokenizer instance to use for counting.
 * @param overheadPerMessage Optional overhead tokens per message. Defaults to 4.
 * @returns The total token count.
 * @throws Error if token counting fails within the tokenizer.
 */
export function countMessagesTokens(
    history: InternalMessage[],
    tokenizer: ITokenizer,
    overheadPerMessage: number = DEFAULT_OVERHEAD_PER_MESSAGE
): number {
    let total = 0;
    try {
        for (const message of history) {
            if (message.content) {
                if (typeof message.content === 'string') {
                    // Count string content directly
                    total += tokenizer.countTokens(message.content);
                } else if (Array.isArray(message.content)) {
                    // For multimodal array content, count only text parts
                    message.content.forEach(part => {
                        if (part.type === 'text' && typeof part.text === 'string') {
                            total += tokenizer.countTokens(part.text);
                        }
                        // Image tokens are ignored in this utility
                    });
                }
                // else: Handle other potential content types if necessary in the future
            }
            // Count tool calls
            if (message.toolCalls) {
                for (const call of message.toolCalls) {
                    if (call.function?.name) {
                        total += tokenizer.countTokens(call.function.name);
                    }
                    if (call.function?.arguments) {
                        total += tokenizer.countTokens(call.function.arguments);
                    }
                }
            }
            // Add overhead for the message itself
            total += overheadPerMessage;
        }
    } catch (error) {
        console.error('countMessagesTokens: Error counting tokens:', error);
        // Re-throw to indicate failure
        throw new Error(
            `Failed to count tokens: ${error instanceof Error ? error.message : String(error)}`
        );
    }
    return total;
}