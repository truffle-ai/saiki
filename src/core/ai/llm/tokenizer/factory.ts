import { ITokenizer, TokenizationError } from './types.js';
import { OpenAITokenizer } from './openai.js';
import { AnthropicTokenizer } from './anthropic.js';
import { GoogleTokenizer } from './google.js';

/**
 * Creates the appropriate tokenizer for the specified provider and model
 * @param provider The LLM provider name (case-insensitive)
 * @param model The specific model name (used by some tokenizers)
 * @returns An appropriate tokenizer implementation
 * @throws TokenizationError if no implementation exists for the provider
 */
export function createTokenizer(provider: string, model: string): ITokenizer {
    switch (provider.toLowerCase()) {
        case 'openai':
            // OpenAI tokenizer might depend on the specific model
            return new OpenAITokenizer(model);
        case 'anthropic':
            // Anthropic tokenizer approximation doesn't depend on model currently
            return new AnthropicTokenizer();
        case 'google':
            return new GoogleTokenizer(model);
        // Add cases for other providers here
        default:
            throw new TokenizationError(
                `No tokenizer implementation available for provider: ${provider}`
            );
    }
}
