import { logger } from '../../utils/logger.js';

export interface ModelInfo {
    name: string;
    maxTokens: number;
    // Add other relevant metadata if needed, e.g., supported features, cost tier
}

export interface ProviderInfo {
    models: ModelInfo[];
    // Add other provider-specific metadata if needed
}

// Central registry of supported LLM providers and their models
export const LLM_REGISTRY: Record<string, ProviderInfo> = {
    openai: {
        models: [
            { name: 'gpt-4.1', maxTokens: 1047576 },
            { name: 'gpt-4.1-mini', maxTokens: 1047576 },
            { name: 'gpt-4.1-nano', maxTokens: 1047576 },
            { name: 'gpt-4o', maxTokens: 128000 },
            { name: 'gpt-4o-mini', maxTokens: 128000 },
            { name: 'o4-mini', maxTokens: 200000 },
            { name: 'o3', maxTokens: 200000 },
            { name: 'o3-mini', maxTokens: 200000 },
            { name: 'o1', maxTokens: 200000 },
        ],
    },
    anthropic: {
        models: [
            { name: 'claude-3-7-sonnet-20250219', maxTokens: 200000 },
            { name: 'claude-3-5-sonnet-20240620', maxTokens: 200000 },
            { name: 'claude-3-haiku-20240307', maxTokens: 200000 },
            { name: 'claude-3-opus-20240229', maxTokens: 200000 },
            { name: 'claude-3-sonnet-20240229', maxTokens: 200000 },
        ],
    },
    google: {
        models: [
            { name: 'gemini-2.5-pro-exp-03-25', maxTokens: 1048576 }, // vercel accepts this name
            { name: 'gemini-2.0-flash', maxTokens: 1048576 },
            { name: 'gemini-2.0-flash-lite', maxTokens: 1048576 },
            { name: 'gemini-1.5-pro-latest', maxTokens: 1048576 },
            { name: 'gemini-1.5-flash-latest', maxTokens: 1048576 },
        ],
    },
    // Add other providers like Groq, Cohere, etc., as needed
};

/**
 * Gets the list of supported providers.
 * @returns An array of supported provider names.
 */
export function getSupportedProviders(): string[] {
    return Object.keys(LLM_REGISTRY);
}

/**
 * Gets the list of supported models for a given provider.
 * @param provider The name of the provider.
 * @returns An array of supported model names for the provider, or an empty array if the provider is not found.
 */
export function getSupportedModels(provider: string): string[] {
    const providerInfo = LLM_REGISTRY[provider.toLowerCase()];
    return providerInfo ? providerInfo.models.map((m) => m.name) : [];
}

/**
 * Retrieves the maximum token limit for a given provider and model from the registry.
 * Throws an error if the provider or model is not found.
 * @param provider The name of the provider (e.g., 'openai', 'anthropic', 'google').
 * @param model The specific model name.
 * @returns The maximum token limit for the model.
 * @throws {Error} If the provider or model is not found in the registry.
 */
export function getMaxTokensForModel(provider: string, model: string): number {
    const lowerProvider = provider?.toLowerCase();
    const lowerModel = model?.toLowerCase();

    const providerInfo = LLM_REGISTRY[lowerProvider];
    if (!providerInfo) {
        const supportedProviders = getSupportedProviders().join(', ');
        logger.error(
            `Provider '${provider}' not found in LLM registry. Supported: ${supportedProviders}`
        );
        throw new Error(
            `Provider '${provider}' not found in LLM registry. Supported providers are: ${supportedProviders}`
        );
    }

    const modelInfo = providerInfo.models.find((m) => m.name.toLowerCase() === lowerModel);
    if (!modelInfo) {
        const supportedModels = getSupportedModels(lowerProvider).join(', ');
        logger.error(
            `Model '${model}' not found for provider '${provider}' in LLM registry. Supported models: ${supportedModels}`
        );
        throw new Error(
            `Model '${model}' not found for provider '${provider}' in LLM registry. Supported models for '${provider}' are: ${supportedModels}`
        );
    }

    logger.debug(`Found max tokens for ${provider}/${model}: ${modelInfo.maxTokens}`);
    return modelInfo.maxTokens;
}

/**
 * Validates if a provider and model combination is supported.
 * @param provider The provider name.
 * @param model The model name.
 * @returns True if the combination is valid, false otherwise.
 */
export function isValidProviderModel(provider?: string, model?: string): boolean {
    if (!provider || !model) {
        // If either is missing, we consider it valid at this level
        // (the refine function in Zod handles the both-or-neither case)
        return true;
    }
    const lowerProvider = provider.toLowerCase();
    const lowerModel = model.toLowerCase();
    const providerInfo = LLM_REGISTRY[lowerProvider];
    if (!providerInfo) {
        return false;
    }
    return providerInfo.models.some((m) => m.name === lowerModel);
}

/**
 * Infers the LLM provider from the model name by searching the registry.
 * Matches the model name (case-insensitive) against all registered models.
 * Returns the provider name if found, or 'unknown' if not found.
 *
 * @param model The model name (e.g., 'gpt-4o-mini', 'claude-3-7-sonnet-20250219')
 * @returns The inferred provider name ('openai', 'anthropic', etc.), or 'unknown' if no match is found.
 */
export function getProviderFromModel(model: string): string {
    const lowerModel = model.toLowerCase();
    for (const [provider, info] of Object.entries(LLM_REGISTRY)) {
        if (info.models.some((m) => m.name.toLowerCase() === lowerModel)) {
            return provider;
        }
    }
    throw new Error(`Unrecognized model '${model}'. Could not infer provider.`);
}

/**
 * Returns a flat array of all supported model names from all providers.
 */
export function getAllSupportedModels(): string[] {
    return Object.values(LLM_REGISTRY).flatMap((info) => info.models.map((m) => m.name));
}
