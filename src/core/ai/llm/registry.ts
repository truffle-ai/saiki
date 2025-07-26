import { logger } from '../../logger/index.js';
import { LLMConfig } from '../../config/schemas.js';
import {
    CantInferProviderError,
    EffectiveMaxInputTokensError,
    ModelNotFoundError,
    ProviderNotFoundError,
} from './errors.js';
import { UnknownProviderError, UnknownModelError } from '@core/error/index.js';

export interface ModelInfo {
    name: string;
    maxInputTokens: number;
    default?: boolean;
    supportedFileTypes: SupportedFileType[]; // Required - every model must explicitly specify file support
    // Add other relevant metadata if needed, e.g., supported features, cost tier
}

export type SupportedFileType = 'audio' | 'pdf';

// Central MIME type to file type mapping
export const MIME_TYPE_TO_FILE_TYPE: Record<string, SupportedFileType> = {
    'application/pdf': 'pdf',
    'audio/mp3': 'audio',
    'audio/mpeg': 'audio',
    'audio/wav': 'audio',
    'audio/x-wav': 'audio',
    'audio/wave': 'audio',
    'audio/webm': 'audio',
    'audio/ogg': 'audio',
    'audio/m4a': 'audio',
    'audio/aac': 'audio',
};

// Helper function to get array of allowed MIME types
export function getAllowedMimeTypes(): string[] {
    return Object.keys(MIME_TYPE_TO_FILE_TYPE);
}

export interface ProviderInfo {
    models: ModelInfo[];
    supportedRouters: string[];
    baseURLSupport: 'none' | 'optional' | 'required'; // Cleaner single field
    supportedFileTypes: SupportedFileType[]; // Provider-level default, used when model doesn't specify
    // Add other provider-specific metadata if needed
}

/** Fallback when we cannot determine the model's input-token limit */
export const DEFAULT_MAX_INPUT_TOKENS = 128000;

export type LLMProvider =
    | 'openai'
    | 'openai-compatible'
    | 'anthropic'
    | 'google'
    | 'groq'
    | 'xai'
    | 'cohere';

// Central registry of supported LLM providers and their models
export const LLM_REGISTRY: Record<LLMProvider, ProviderInfo> = {
    openai: {
        models: [
            { name: 'gpt-4.1', maxInputTokens: 1047576, supportedFileTypes: ['pdf'] },
            {
                name: 'gpt-4.1-mini',
                maxInputTokens: 1047576,
                default: true,
                supportedFileTypes: ['pdf'],
            },
            { name: 'gpt-4.1-nano', maxInputTokens: 1047576, supportedFileTypes: ['pdf'] },
            { name: 'gpt-4o', maxInputTokens: 128000, supportedFileTypes: ['pdf'] },
            { name: 'gpt-4o-mini', maxInputTokens: 128000, supportedFileTypes: ['pdf'] },
            {
                name: 'gpt-4o-audio-preview',
                maxInputTokens: 128000,
                supportedFileTypes: ['pdf', 'audio'],
            },
            { name: 'o4-mini', maxInputTokens: 200000, supportedFileTypes: ['pdf'] },
            { name: 'o3', maxInputTokens: 200000, supportedFileTypes: ['pdf'] },
            { name: 'o3-mini', maxInputTokens: 200000, supportedFileTypes: ['pdf'] },
            { name: 'o1', maxInputTokens: 200000, supportedFileTypes: ['pdf'] },
        ],
        supportedRouters: ['vercel', 'in-built'],
        baseURLSupport: 'none',
        supportedFileTypes: [], // No defaults - models must explicitly specify support
    },
    'openai-compatible': {
        models: [], // Empty - accepts any model name for custom endpoints
        supportedRouters: ['vercel', 'in-built'],
        baseURLSupport: 'required',
        supportedFileTypes: [], // Unknown capabilities for custom endpoints
    },
    anthropic: {
        models: [
            { name: 'claude-4-opus-20250514', maxInputTokens: 200000, supportedFileTypes: ['pdf'] },
            {
                name: 'claude-4-sonnet-20250514',
                maxInputTokens: 200000,
                default: true,
                supportedFileTypes: ['pdf'],
            },
            {
                name: 'claude-3-7-sonnet-20250219',
                maxInputTokens: 200000,
                supportedFileTypes: ['pdf'],
            },
            {
                name: 'claude-3-5-sonnet-20240620',
                maxInputTokens: 200000,
                supportedFileTypes: ['pdf'],
            },
            {
                name: 'claude-3-haiku-20240307',
                maxInputTokens: 200000,
                supportedFileTypes: ['pdf'],
            },
            { name: 'claude-3-opus-20240229', maxInputTokens: 200000, supportedFileTypes: ['pdf'] },
            {
                name: 'claude-3-sonnet-20240229',
                maxInputTokens: 200000,
                supportedFileTypes: ['pdf'],
            },
        ],
        supportedRouters: ['vercel', 'in-built'],
        baseURLSupport: 'none',
        supportedFileTypes: [], // No defaults - models must explicitly specify support
    },
    google: {
        models: [
            {
                name: 'gemini-2.5-pro',
                maxInputTokens: 1048576,
                default: true,
                supportedFileTypes: ['pdf', 'audio'],
            },
            {
                name: 'gemini-2.5-flash',
                maxInputTokens: 1048576,
                supportedFileTypes: ['pdf', 'audio'],
            },
            {
                name: 'gemini-2.0-flash',
                maxInputTokens: 1048576,
                supportedFileTypes: ['pdf', 'audio'],
            },
            {
                name: 'gemini-2.0-flash-lite',
                maxInputTokens: 1048576,
                supportedFileTypes: ['pdf', 'audio'],
            },
            {
                name: 'gemini-1.5-pro-latest',
                maxInputTokens: 1048576,
                supportedFileTypes: ['pdf', 'audio'],
            },
            {
                name: 'gemini-1.5-flash-latest',
                maxInputTokens: 1048576,
                supportedFileTypes: ['pdf', 'audio'],
            },
        ],
        supportedRouters: ['vercel'],
        baseURLSupport: 'none',
        supportedFileTypes: [], // No defaults - models must explicitly specify support
    },
    // https://console.groq.com/docs/models
    groq: {
        models: [
            { name: 'gemma-2-9b-it', maxInputTokens: 8192, supportedFileTypes: [] },
            {
                name: 'llama-3.3-70b-versatile',
                maxInputTokens: 128000,
                default: true,
                supportedFileTypes: [],
            },
        ],
        supportedRouters: ['vercel'],
        baseURLSupport: 'none',
        supportedFileTypes: [], // Groq currently doesn't support file uploads
    },
    // https://docs.x.ai/docs/models
    xai: {
        models: [
            { name: 'grok-4', maxInputTokens: 256000, default: true, supportedFileTypes: [] },
            { name: 'grok-3', maxInputTokens: 131072, supportedFileTypes: [] },
            { name: 'grok-3-mini', maxInputTokens: 131072, supportedFileTypes: [] },
        ],
        supportedRouters: ['vercel'],
        baseURLSupport: 'none',
        supportedFileTypes: [], // XAI currently doesn't support file uploads
    },
    // https://docs.cohere.com/reference/models
    cohere: {
        models: [
            {
                name: 'command-a-03-2025',
                maxInputTokens: 256000,
                default: true,
                supportedFileTypes: [],
            },
            { name: 'command-r-plus', maxInputTokens: 128000, supportedFileTypes: [] },
            { name: 'command-r', maxInputTokens: 128000, supportedFileTypes: [] },
            { name: 'command', maxInputTokens: 4000, supportedFileTypes: [] },
            { name: 'command-light', maxInputTokens: 4000, supportedFileTypes: [] },
        ],
        supportedRouters: ['vercel'],
        baseURLSupport: 'none',
        supportedFileTypes: [], // Cohere currently doesn't support file uploads
    },
};

/**
 * Gets the default model for a given provider from the registry.
 * @param provider The name of the provider.
 * @returns The default model for the provider, or null if no default model is found.
 */
export function getDefaultModelForProvider(provider: string): string | null {
    const providerInfo = LLM_REGISTRY[provider.toLowerCase() as LLMProvider];
    return providerInfo ? providerInfo.models.find((m) => m.default)?.name || null : null;
}

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
    const providerInfo = LLM_REGISTRY[provider.toLowerCase() as LLMProvider];
    return providerInfo ? providerInfo.models.map((m) => m.name) : [];
}

/**
 * Retrieves the maximum input token limit for a given provider and model from the registry.
 * Throws an error if the provider or model is not found.
 * @param provider The name of the provider (e.g., 'openai', 'anthropic', 'google').
 * @param model The specific model name.
 * @returns The maximum input token limit for the model.
 * @throws {Error} If the provider or model is not found in the registry.
 */
export function getMaxInputTokensForModel(provider: string, model: string): number {
    const lowerProvider = provider?.toLowerCase();
    const lowerModel = model?.toLowerCase();

    const providerInfo = LLM_REGISTRY[lowerProvider as LLMProvider];
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

    logger.debug(`Found max tokens for ${provider}/${model}: ${modelInfo.maxInputTokens}`);
    return modelInfo.maxInputTokens;
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
    const providerInfo = LLM_REGISTRY[lowerProvider as LLMProvider];
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
 * Gets the supported routers for a given provider.
 * @param provider The name of the provider.
 * @returns An array of supported router names for the provider
 */
export function getSupportedRoutersForProvider(provider: string): string[] {
    const providerInfo = LLM_REGISTRY[provider.toLowerCase() as LLMProvider];
    return providerInfo ? providerInfo.supportedRouters : [];
}

/**
 * Checks if a provider supports custom baseURL.
 * @param provider The name of the provider.
 * @returns True if the provider supports custom baseURL, false otherwise.
 */
export function supportsBaseURL(provider: string): boolean {
    const providerInfo = LLM_REGISTRY[provider.toLowerCase() as LLMProvider];
    return providerInfo ? providerInfo.baseURLSupport !== 'none' : false; // Default to false for unknown providers
}

/**
 * Checks if a provider requires a custom baseURL.
 * @param provider The name of the provider.
 * @returns True if the provider requires a custom baseURL, false otherwise.
 */
export function requiresBaseURL(provider: string): boolean {
    const providerInfo = LLM_REGISTRY[provider.toLowerCase() as LLMProvider];
    return providerInfo ? providerInfo.baseURLSupport === 'required' : false;
}

/**
 * Checks if a provider accepts any model name (i.e., has empty models list).
 * @param provider The name of the provider.
 * @returns True if the provider accepts any model name, false otherwise.
 */
export function acceptsAnyModel(provider: string): boolean {
    const providerInfo = LLM_REGISTRY[provider.toLowerCase() as LLMProvider];
    return providerInfo ? providerInfo.models.length === 0 : false;
}

/**
 * Validates if a router name is valid.
 * @param router The router name to validate.
 * @returns True if the router is valid, false otherwise.
 */
export function isValidRouter(router: string): boolean {
    const validRouters = ['vercel', 'in-built'];
    return validRouters.includes(router);
}

/**
 * Validates if a provider exists in the registry.
 * @param provider The provider name to validate.
 * @returns True if the provider exists, false otherwise.
 */
export function isValidProvider(provider: string): boolean {
    return provider.toLowerCase() in LLM_REGISTRY;
}

/**
 * Gets the supported file types for a specific model.
 * @param provider The name of the provider.
 * @param model The name of the model.
 * @returns Array of supported file types for the model.
 * @throws {Error} If the provider or model is not found in the registry.
 */
export function getSupportedFileTypesForModel(
    provider: string,
    model: string
): SupportedFileType[] {
    const providerInfo = LLM_REGISTRY[provider as LLMProvider];
    if (!providerInfo) {
        logger.error(
            `Provider '${provider}' not found in LLM registry. Supported: ${Object.keys(LLM_REGISTRY).join(', ')}`
        );
        throw new UnknownProviderError(provider, Object.keys(LLM_REGISTRY));
    }

    // Special case: providers that accept any model name (e.g., openai-compatible)
    if (acceptsAnyModel(provider)) {
        return []; // Unknown capabilities for custom models - assume no file support for security
    }

    // Find the specific model
    const modelInfo = providerInfo.models.find((m) => m.name.toLowerCase() === model.toLowerCase());
    if (!modelInfo) {
        const availableModels = providerInfo.models.map((m) => m.name);
        throw new UnknownModelError(provider, model, availableModels);
    }

    return modelInfo.supportedFileTypes;
}

/**
 * Checks if a specific model supports a specific file type.
 * @param provider The name of the provider.
 * @param model The name of the model.
 * @param fileType The file type to check support for.
 * @returns True if the model supports the file type, false otherwise.
 */
export function modelSupportsFileType(
    provider: string,
    model: string,
    fileType: SupportedFileType
): boolean {
    const supportedTypes = getSupportedFileTypesForModel(provider, model);
    return supportedTypes.includes(fileType);
}

/**
 * Validates if file data is supported by a specific model.
 * @param provider The LLM provider name.
 * @param model The model name.
 * @param mimeType The MIME type of the file to validate.
 * @returns Object containing validation result and details.
 */
export function validateModelFileSupport(
    provider: string,
    model: string,
    mimeType: string
): {
    isSupported: boolean;
    fileType?: SupportedFileType;
    error?: string;
} {
    const fileType = MIME_TYPE_TO_FILE_TYPE[mimeType.toLowerCase()];
    if (!fileType) {
        return {
            isSupported: false,
            error: `Unsupported file type: ${mimeType}`,
        };
    }

    try {
        if (!modelSupportsFileType(provider, model, fileType)) {
            return {
                isSupported: false,
                fileType,
                error: `Model '${model}' (${provider}) does not support ${fileType} files`,
            };
        }

        return {
            isSupported: true,
            fileType,
        };
    } catch (error) {
        return {
            isSupported: false,
            fileType,
            error:
                error instanceof Error
                    ? error.message
                    : 'Unknown error validating model file support',
        };
    }
}

/**
 * Checks if a provider supports a specific router.
 * @param provider The name of the provider.
 * @param router The router name to check.
 * @returns True if the provider supports the router, false otherwise.
 */
export function isRouterSupportedForProvider(provider: string, router: string): boolean {
    const supportedRouters = getSupportedRoutersForProvider(provider);
    return supportedRouters.includes(router);
}

/**
 * Determines the effective maximum input token limit based on configuration.
 * Priority:
 * 1. Explicit `maxInputTokens` in config
 * 2. Registry lookup for known provider/model.
 *
 * @param config The validated LLM configuration.
 * @returns The effective maximum input token count for the LLM.
 * @throws {Error}
 * If `baseURL` is set but `maxInputTokens` is missing (indicating a Zod validation inconsistency).
 * Or if `baseURL` is not set, but model isn't found in registry.
 * TODO: make more readable
 */
export function getEffectiveMaxInputTokens(config: LLMConfig): number {
    const configuredMaxInputTokens = config.maxInputTokens;

    // Priority 1: Explicit config override or required value with baseURL
    if (configuredMaxInputTokens != null) {
        // Case 1a: baseURL is set. maxInputTokens is required and validated by Zod. Trust it.
        if (config.baseURL) {
            logger.debug(
                `Using maxInputTokens from configuration (with baseURL): ${configuredMaxInputTokens}`
            );
            return configuredMaxInputTokens;
        }

        // Case 1b: baseURL is NOT set, but maxInputTokens is provided (override).
        // Sanity-check against registry limits.
        try {
            const registryMaxInputTokens = getMaxInputTokensForModel(config.provider, config.model);
            if (configuredMaxInputTokens > registryMaxInputTokens) {
                logger.warn(
                    `Provided maxInputTokens (${configuredMaxInputTokens}) for ${config.provider}/${config.model} exceeds the known limit (${registryMaxInputTokens}) for model ${config.model}. Capping to registry limit.`
                );
                return registryMaxInputTokens;
            } else {
                logger.debug(
                    `Using valid maxInputTokens override from configuration: ${configuredMaxInputTokens} (Registry limit: ${registryMaxInputTokens})`
                );
                return configuredMaxInputTokens;
            }
        } catch (error: any) {
            // Handle registry lookup failures during override check
            if (error instanceof ProviderNotFoundError || error instanceof ModelNotFoundError) {
                logger.warn(
                    `Registry lookup failed during maxInputTokens override check for ${config.provider}/${config.model}: ${error.message}. ` +
                        `Proceeding with the provided maxInputTokens value (${configuredMaxInputTokens}), but it might be invalid.`
                );
                // Return the user's value, assuming Zod validation passed for provider/model existence initially.
                return configuredMaxInputTokens;
            } else {
                // Re-throw unexpected errors
                logger.error(
                    `Unexpected error during registry lookup for maxInputTokens override check: ${error}`
                );
                throw error;
            }
        }
    }

    // Priority 2: baseURL is set but maxInputTokens is missing - default to 128k tokens
    if (config.baseURL) {
        logger.warn(
            `baseURL is set but maxInputTokens is missing. Defaulting to ${DEFAULT_MAX_INPUT_TOKENS}. ` +
                `Provide 'maxInputTokens' in configuration to avoid default fallback.`
        );
        return DEFAULT_MAX_INPUT_TOKENS;
    }

    // Priority 3: Check if provider accepts any model (like openai-compatible)
    if (acceptsAnyModel(config.provider)) {
        logger.debug(
            `Provider ${config.provider} accepts any model, defaulting to ${DEFAULT_MAX_INPUT_TOKENS} tokens`
        );
        return DEFAULT_MAX_INPUT_TOKENS;
    }

    // Priority 4: No override, no baseURL - use registry.
    try {
        const registryMaxInputTokens = getMaxInputTokensForModel(config.provider, config.model);
        logger.debug(
            `Using maxInputTokens from registry for ${config.provider}/${config.model}: ${registryMaxInputTokens}`
        );
        return registryMaxInputTokens;
    } catch (error: any) {
        // Handle registry lookup failures gracefully (e.g., typo in validated config)
        if (error instanceof ProviderNotFoundError || error instanceof ModelNotFoundError) {
            // Log as error and throw a specific fatal error
            logger.error(
                `Registry lookup failed for ${config.provider}/${config.model}: ${error.message}. ` +
                    `Effective maxInputTokens cannot be determined.`
            );
            throw new EffectiveMaxInputTokensError(config.provider, config.model);
        } else {
            // Re-throw unexpected errors during registry lookup
            logger.error(`Unexpected error during registry lookup for maxInputTokens: ${error}`);
            throw error;
        }
    }
}
