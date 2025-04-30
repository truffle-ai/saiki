import { logger } from '../../utils/logger.js';

export interface ModelInfo {
    name: string;
    maxTokens: number;
    // Add other relevant metadata if needed, e.g., supported features, cost tier
}

export interface ProviderInfo {
    name: string;
    models: ModelInfo[];
    defaultRouter?: string; // Optional: specify a default router if different
    // Add other provider-specific metadata if needed
}

// Central registry of supported LLM providers and their models
export const LLM_REGISTRY: Record<string, ProviderInfo> = {
    openai: {
        name: 'openai',
        models: [
            { name: 'gpt-4o-mini', maxTokens: 16384 },
            { name: 'gpt-4o', maxTokens: 128000 },
            { name: 'gpt-4-turbo', maxTokens: 128000 },
            { name: 'gpt-4', maxTokens: 8192 },
            { name: 'gpt-3.5-turbo', maxTokens: 16385 },
            { name: 'gpt-4.1-mini', maxTokens: 1000000 },
        ],
        defaultRouter: 'vercel',
    },
    anthropic: {
        name: 'anthropic',
        models: [
            { name: 'claude-3-5-sonnet-20240620', maxTokens: 200000 },
            { name: 'claude-3-opus-20240229', maxTokens: 200000 },
            { name: 'claude-3-sonnet-20240229', maxTokens: 200000 },
            { name: 'claude-3-haiku-20240307', maxTokens: 200000 },
            { name: 'claude-3-7-sonnet', maxTokens: 200000 },
        ],
        defaultRouter: 'vercel',
    },
    google: {
        name: 'google',
        models: [
            { name: 'gemini-1.5-pro-latest', maxTokens: 1048576 },
            { name: 'gemini-1.5-flash-latest', maxTokens: 1048576 },
            { name: 'gemini-pro', maxTokens: 32768 },
            { name: 'gemini-2.5-pro', maxTokens: 1048576 },
            { name: 'gemini-2.0-flash', maxTokens: 1048576 },
            { name: 'gemini-2.0-flash-lite', maxTokens: 1048576 },
        ],
        defaultRouter: 'vercel',
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
 * Gets the maximum tokens allowed for a specific model.
 * @param provider The name of the provider.
 * @param model The name of the model.
 * @returns The maximum token count, or null if the model or provider is not found.
 */
export function getMaxTokensForModel(provider: string, model: string): number | null {
    const providerInfo = LLM_REGISTRY[provider.toLowerCase()];
    if (!providerInfo) {
        logger.warn(`Provider '${provider}' not found in LLM registry.`);
        return null;
    }
    const modelInfo = providerInfo.models.find((m) => m.name === model.toLowerCase());
    if (!modelInfo) {
        logger.warn(`Model '${model}' not found for provider '${provider}' in LLM registry.`);
        return null;
    }
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