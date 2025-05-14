import { InternalMessage } from '../types.js';

/**
 * Interface for converting internal message format to LLM provider-specific formats.
 * Each LLM provider requires a different message structure, and the formatter's job
 * is to handle these conversions while maintaining a consistent internal representation.
 */
export interface IMessageFormatter {
    /**
     * Formats the internal message history for a specific LLM provider API.
     * Transforms our standardized internal message format into the specific structure
     * required by the target LLM API.
     *
     * @param history The raw internal message history (read-only to prevent modifications)
     * @param systemPrompt The system prompt, if any
     * @returns The message history structured for the target API
     */
    format(history: Readonly<InternalMessage[]>, systemPrompt?: string | null): any[];

    /**
     * Parses raw LLM response into an array of InternalMessage objects.
     */
    parseResponse(response: any): InternalMessage[];

    /**
     * Optional method for handling system prompt separately.
     * Some LLM providers (like Anthropic) don't include the system prompt in the
     * messages array but pass it as a separate parameter.
     *
     * @param systemPrompt The system prompt to format
     * @returns The formatted system prompt or null/undefined if not needed
     */
    formatSystemPrompt?(systemPrompt: string | null): string | null | undefined;
}
