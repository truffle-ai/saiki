import { InternalMessage } from './types.js';

export interface IMessageFormatter {
    /**
     * Formats the internal message history for a specific LLM provider API.
     * @param history The raw internal message history
     * @param systemPrompt The system prompt, if any
     * @returns The message history structured for the target API
     */
    format(history: Readonly<InternalMessage[]>, systemPrompt: string | null): any[];

    /**
     * Optional: Some formatters might need separate system prompt handling
     */
    getSystemPrompt?(systemPrompt: string | null): string | null | undefined;
} 