import { logger } from '../utils/logger.js';

const MODEL_PREFIX_TO_PROVIDER: Record<string, string> = {
    'gpt-': 'openai',
    'claude-': 'anthropic',
    'gemini-': 'google',
    'grok-': 'grok',
    // Add more as needed
};

/**
 * Infers the LLM provider from the model name using a prefix-to-provider map.
 * Matches the start of the model name against known prefixes for extensibility.
 *
 * @param model The model name (e.g., 'gpt-4o-mini', 'claude-3-7-sonnet-20250219')
 * @returns The inferred provider name ('openai', 'anthropic', etc.), or 'unknown' if no match is found.
 */
export function getProviderFromModel(model: string): string {
    const lowerModel = model.toLowerCase();
    for (const prefix in MODEL_PREFIX_TO_PROVIDER) {
        if (lowerModel.startsWith(prefix)) {
            return MODEL_PREFIX_TO_PROVIDER[prefix];
        }
    }
    logger.warn(`Could not determine provider for model: ${model}. Defaulting to 'unknown'.`);
    return 'unknown';
}
