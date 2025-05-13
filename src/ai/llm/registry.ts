import { logger } from '../../utils/logger.js';
import { LLMConfig } from '../../config/schemas.js';
import {
    CantInferProviderError,
    EffectiveMaxTokensError,
    ModelNotFoundError,
    ProviderNotFoundError,
} from './errors.js';

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
            { name: 'gemini-2.5-pro-exp-03-25', maxTokens: 1048576 },
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
        throw new ProviderNotFoundError(provider);
    }

    const modelInfo = providerInfo.models.find((m) => m.name.toLowerCase() === lowerModel);
    if (!modelInfo) {
        const supportedModels = getSupportedModels(lowerProvider).join(', ');
        logger.error(
            `Model '${model}' not found for provider '${provider}' in LLM registry. Supported models: ${supportedModels}`
        );
        throw new ModelNotFoundError(provider, model);
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
    return providerInfo.models.some((m) => m.name.toLowerCase() === lowerModel);
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
    throw new CantInferProviderError(model);
}

/**
 * Returns a flat array of all supported model names from all providers.
 */
export function getAllSupportedModels(): string[] {
    return Object.values(LLM_REGISTRY).flatMap((info) => info.models.map((m) => m.name));
}

/**
 * Determines the effective maximum token limit based on configuration.
 * Priority:
 * 1. Explicit `maxTokens` in config (handles `baseURL` case implicitly via Zod validation).
 * 2. Registry lookup for known provider/model.
 *
 * @param config The validated LLM configuration.
 * @returns The effective maximum token count.
 * @throws {Error}
 * If `baseURL` is set but `maxTokens` is missing (indicating a Zod validation inconsistency).
 * Or if `baseURL` is not set, but model isn't found in registry.
 * TODO: make more readable
 */
export function getEffectiveMaxTokens(config: LLMConfig): number {
    // Priority 1: Explicit config override or required value with baseURL
    if (config.maxTokens != null) {
        // Case 1a: baseURL is set. maxTokens is required and validated by Zod. Trust it.
        if (config.baseURL) {
            logger.debug(`Using maxTokens from configuration (with baseURL): ${config.maxTokens}`);
            return config.maxTokens;
        }

        // Case 1b: baseURL is NOT set, but maxTokens is provided (override).
        // Sanity-check against registry limits.
        try {
            const registryMaxTokens = getMaxTokensForModel(config.provider, config.model);
            if (config.maxTokens > registryMaxTokens) {
                logger.warn(
                    `Provided maxTokens (${config.maxTokens}) for ${config.provider}/${config.model} exceeds the registry limit (${registryMaxTokens}). Capping to registry limit.`
                );
                return registryMaxTokens;
            } else {
                logger.debug(
                    `Using valid maxTokens override from configuration: ${config.maxTokens} (Registry limit: ${registryMaxTokens})`
                );
                return config.maxTokens;
            }
        } catch (error: any) {
            // Handle registry lookup failures during override check
            if (error instanceof ProviderNotFoundError || error instanceof ModelNotFoundError) {
                logger.warn(
                    `Registry lookup failed during maxTokens override check for ${config.provider}/${config.model}: ${error.message}. ` +
                        `Proceeding with the provided maxTokens value (${config.maxTokens}), but it might be invalid.`
                );
                // Return the user's value, assuming Zod validation passed for provider/model existence initially.
                return config.maxTokens;
            } else {
                // Re-throw unexpected errors
                logger.error(
                    `Unexpected error during registry lookup for maxTokens override check: ${error}`
                );
                throw error; // Or potentially throw EffectiveMaxTokensError if stricter handling is needed.
            }
        }
    }

    // Priority 2: baseURL is set but maxTokens is missing - indicates validation inconsistency
    if (config.baseURL) {
        const errMsg =
            "Internal Error: Configuration validation inconsistency - 'baseURL' is set but 'maxTokens' is missing. 'maxTokens' is required when 'baseURL' is specified.";
        logger.error(errMsg);
        // This state should ideally be prevented by Zod. Throw indicates a validation setup error.
        throw new Error(errMsg);
    }

    // Priority 3: No override, no baseURL - use registry.
    try {
        const registryMaxTokens = getMaxTokensForModel(config.provider, config.model);
        logger.debug(
            `Using maxTokens from registry for ${config.provider}/${config.model}: ${registryMaxTokens}`
        );
        return registryMaxTokens;
    } catch (error: any) {
        // Handle registry lookup failures gracefully (e.g., typo in validated config)
        if (error instanceof ProviderNotFoundError || error instanceof ModelNotFoundError) {
            // Log as error and throw a specific fatal error
            logger.error(
                `Registry lookup failed for ${config.provider}/${config.model}: ${error.message}. ` +
                    `Effective maxTokens cannot be determined.`
            );
            throw new EffectiveMaxTokensError(config.provider, config.model);
        } else {
            // Re-throw unexpected errors during registry lookup
            logger.error(`Unexpected error during registry lookup for maxTokens: ${error}`);
            throw error;
        }
    }
}
