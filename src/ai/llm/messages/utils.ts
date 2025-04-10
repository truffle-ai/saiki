import { InternalMessage } from './types.js';
import { ITokenizer } from '../tokenizer/types.js';

// Approximation for message format overhead
const DEFAULT_OVERHEAD_PER_MESSAGE = 4;

/**
 * Counts the total tokens in an array of InternalMessages using a provided tokenizer.
 * Includes an estimated overhead per message.
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
                total += tokenizer.countTokens(message.content);
            }
            if (message.toolCalls) {
                for (const call of message.toolCalls) {
                    if (call.function?.name) {
                        // Check if function and name exist
                        total += tokenizer.countTokens(call.function.name);
                    }
                    if (call.function?.arguments) {
                        // Check if arguments exist
                        total += tokenizer.countTokens(call.function.arguments);
                    }
                }
            }
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
