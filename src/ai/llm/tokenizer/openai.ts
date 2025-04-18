import { ITokenizer, TokenizationError } from './types.js';
import { encoding_for_model, TiktokenModel } from 'tiktoken';

// List of model prefixes potentially unsupported by tiktoken or needing mapping
const UNSUPPORTED_PREFIXES: string[] = ['gpt-4.1-'];
const DEFAULT_MODEL: TiktokenModel = 'gpt-4o'; // Fallback model

/**
 * Fetches the appropriate TiktokenModel name, handling potential unsupported models.
 * @param model The initial model name string.
 * @returns A valid TiktokenModel name.
 */
function fetchTiktokenModel(model: string): TiktokenModel {
    for (const prefix of UNSUPPORTED_PREFIXES) {
        if (model.startsWith(prefix)) {
            console.warn(`Model '${model}' might not be directly supported by tiktoken. Using default '${DEFAULT_MODEL}'.`);
            return DEFAULT_MODEL;
        }
    }

    try {
        // Verify the model name is known to tiktoken
        encoding_for_model(model as TiktokenModel);
        return model as TiktokenModel;
    } catch (e) {
        // Fallback if encoding_for_model throws (likely an invalid/unsupported model name)
        console.warn(`Model '${model}' caused an error with tiktoken. Using default '${DEFAULT_MODEL}'. Error: ${e instanceof Error ? e.message : String(e)}`);
        return DEFAULT_MODEL;
    }
}

/**
 * Tokenizer for OpenAI models using the tiktoken library.
 */
export class OpenAITokenizer implements ITokenizer {
    private model: TiktokenModel;
    private encoding: any; // Tiktoken encoding instance

    /**
     * Initializes the tokenizer for a specific OpenAI model.
     * @param model The OpenAI model name (e.g., 'gpt-3.5-turbo', 'gpt-4')
     * @throws TokenizationError if tiktoken initialization fails after attempting fallback.
     */
    constructor(model: string) {
        try {
            this.model = fetchTiktokenModel(model);
            this.encoding = encoding_for_model(this.model);
        } catch (error) {
            throw new TokenizationError(
                `Failed to initialize tiktoken for model ${this.model} (derived from '${model}'): ${error instanceof Error ? error.message : String(error)}`
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
            console.error(`Tiktoken encoding failed for model ${this.model}:`, error);
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
