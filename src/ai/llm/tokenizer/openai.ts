import { ITokenizer, TokenizationError } from './types.js';
import { encoding_for_model, TiktokenModel } from 'tiktoken';

/**
 * Tokenizer for OpenAI models using the tiktoken library.
 */
export class OpenAITokenizer implements ITokenizer {
    private model: TiktokenModel;
    private encoding: any; // Tiktoken encoding instance

    /**
     * Initializes the tokenizer for a specific OpenAI model.
     * @param model The OpenAI model name (e.g., 'gpt-3.5-turbo', 'gpt-4')
     * @throws TokenizationError if the model is not supported by tiktoken
     */
    constructor(model: string) {
        try {
            // Ensure the model is a valid TiktokenModel type
            this.model = model as TiktokenModel;
            this.encoding = encoding_for_model(this.model);
        } catch (error) {
            throw new TokenizationError(
                `Failed to initialize tiktoken for model ${model}: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Counts the tokens in the text using the specific model's encoding.
     * @param text Text content to count tokens for
     * @returns Number of tokens
     */
    countTokens(text: string): number {
        if (!text) return 0;
        try {
            const tokens = this.encoding.encode(text);
            return tokens.length;
        } catch (error) {
            // Handle potential errors during encoding, though less common
            console.error(`Tiktoken encoding failed for model ${this.model}:`, error);
            // Fallback or re-throw depending on desired behavior
            // For now, let's return 0 or throw a specific error
            throw new TokenizationError(`Encoding failed for text snippet.`);
        }
    }

    /**
     * Cleans up the tiktoken encoding instance when done.
     * Recommended by tiktoken library.
     */
    free(): void {
        if (this.encoding) {
            this.encoding.free();
        }
    }

    getProviderName(): string {
        return 'openai';
    }
}
