import { logger } from '../../../utils/logger.js';

/**
 * Attempts to determine the LLM provider based on the model name string.
 * @param model The model name (e.g., 'gpt-3.5-turbo', 'claude-3-opus-20240229')
 * @returns The inferred provider name ('openai', 'anthropic', etc.) or 'unknown'
 */
export function getProviderFromModel(model: string): string {
    const lowerModel = model.toLowerCase();

    if (lowerModel.startsWith('gpt-')) {
        return 'openai';
    }
    if (lowerModel.startsWith('claude-')) {
        return 'anthropic';
    }
    if (lowerModel.startsWith('gemini-')) {
        return 'google';
    }
    if (lowerModel.startsWith('grok-')) {
        return 'grok';
    }
    // Add more provider checks here as needed

    logger.warn(`Could not determine provider for model: ${model}. Defaulting to 'unknown'.`);
    return 'unknown';
}

/**
 * Gets the approximate maximum context window size (in tokens) for a given model.
 * Uses known values for common models and provides defaults.
 * @param provider The LLM provider name (e.g., 'openai', 'anthropic')
 * @param model The specific model name
 * @returns The maximum token limit for the model's context window
 */
export function getMaxTokens(provider: string, model: string): number {
    const lowerProvider = provider.toLowerCase();
    const lowerModel = model.toLowerCase();

    switch (lowerProvider) {
        case 'openai':
            // Based on OpenAI documentation (as of early 2024)
            // Includes input and output tokens
            if (lowerModel.includes('gpt-4-turbo')) return 128000;
            if (lowerModel.includes('gpt-4-32k')) return 32768;
            if (lowerModel.includes('gpt-4')) return 8192; // Standard gpt-4
            if (lowerModel.includes('gpt-3.5-turbo-16k')) return 16385;
            if (lowerModel.includes('gpt-3.5-turbo')) return 4096; // Older default, use newer if possible
            // Add newer models like gpt-4o when confirmed
            logger.warn(`Unknown OpenAI model: ${model}. Using default limit of 4096.`);
            return 4096; // Default for older gpt-3.5

        case 'anthropic':
            // Based on Anthropic documentation (as of early 2024)
            // Claude models often have larger context windows
            // Note: Actual usable context might be slightly less
            if (lowerModel.includes('claude-3-opus')) return 200000; // Around 200k
            if (lowerModel.includes('claude-3-sonnet')) return 200000; // Around 200k
            if (lowerModel.includes('claude-3-haiku')) return 200000; // Around 200k
            if (lowerModel.includes('claude-2.1')) return 200000; // Around 200k
            if (lowerModel.includes('claude-2.0')) return 100000; // Around 100k
            if (lowerModel.includes('claude-instant-1')) return 100000; // Around 100k
            logger.warn(`Unknown Anthropic model: ${model}. Using default limit of 100000.`);
            return 100000; // Default for older Claude

        // Add cases for other providers here

        default:
            logger.warn(
                `Unknown provider: ${provider} for model: ${model}. Using default limit of 4000.`
            );
            return 4000; // A conservative default
    }
}

// Example of potential future helper logic for specific providers if needed
// export function getOpenAIMaxTokens(model: string): number { ... }
// export function getAnthropicMaxTokens(model: string): number { ... }
