import { logger } from '../../../utils/logger.js';

const DEFAULT_TOKEN_LIMIT = 100000;

// Map of known model token limits by provider and model substring
const MODEL_TOKEN_LIMITS: Record<string, Record<string, number>> = {
    openai: {
        'gpt-4.1-nano': 1000000,
        'gpt-4.1-mini': 1000000,
        'gpt-4.1': 1000000,
        'gpt-4o-mini': 128000,
        'gpt-4o': 128000,
    },
    anthropic: {
        'claude-3-7-sonnet': 200000,
        'claude-3-5-haiku': 200000,
        'claude-3-5-sonnet': 200000,
        'claude-3-opus': 200000,
        'claude-3-sonnet': 200000,
        'claude-3-haiku': 200000,
    },
    google: {
        'gemini-2.5-pro': 1048576,
        'gemini-2.0-flash': 1048576,
        'gemini-2.0-flash-lite': 1048576,
        'gemini-1.5-pro': 2097152,
        'gemini-1.5-flash': 1048576,
    },
    // Add other providers here as needed
};

// Provider-specific default token limits
const PROVIDER_DEFAULTS: Record<string, number> = {
    openai: 128000,
    anthropic: 100000,
    google: 1048576,
};

/**
 * Normalizes the model name by removing known suffixes such as dates or version identifiers.
 * @param modelName The original model name.
 * @returns The normalized model name.
 */
function normalizeModelName(modelName: string): string {
    return modelName
        .toLowerCase()
        .replace(/[@-]\d{6,8}$/, '') // Removes suffixes like '-20250219' or '@20250219'
        .replace(/-\d{3}$/, ''); // Removes version suffixes like '-001'
}

/**
 * Retrieves the maximum token limit for a given provider and model.
 * @param provider The name of the provider (e.g., 'openai', 'anthropic', 'google').
 * @param model The specific model name.
 * @returns The maximum token limit for the model.
 */
export function getMaxTokens(provider: string, model: string): number {
    const lowerProvider = provider.toLowerCase();
    const normalizedModel = normalizeModelName(model);
    logger.debug(
        `getMaxTokens: provider: ${provider}, model: ${model}, normalizedModel: ${normalizedModel}`
    );

    const providerModels = MODEL_TOKEN_LIMITS[lowerProvider];
    if (providerModels) {
        // Sort model keys by length in descending order to match more specific names first
        const sortedModelKeys = Object.keys(providerModels).sort((a, b) => b.length - a.length);

        for (const modelKey of sortedModelKeys) {
            if (normalizedModel.includes(modelKey)) {
                logger.debug(
                    `getMaxTokens: found modelKey: ${modelKey}, limit: ${providerModels[modelKey]}`
                );
                return providerModels[modelKey];
            }
        }

        logger.warn(
            `Unknown ${provider} model: ${model}. Using default limit of ${
                PROVIDER_DEFAULTS[lowerProvider] ?? DEFAULT_TOKEN_LIMIT
            }.`
        );
        return PROVIDER_DEFAULTS[lowerProvider] ?? DEFAULT_TOKEN_LIMIT;
    }

    logger.warn(
        `Unknown provider: ${provider} for model: ${model}. Using default limit of ${DEFAULT_TOKEN_LIMIT}.`
    );
    return DEFAULT_TOKEN_LIMIT;
}
