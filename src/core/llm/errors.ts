import { LLMProvider } from './registry.js';

/**
 * Custom error class for when a requested provider is not found.
 */
export class UnknownProviderError extends Error {
    constructor(provider: string, availableProviders?: string[]) {
        const message = availableProviders
            ? `Provider '${provider}' not found. Available providers: ${availableProviders.join(', ')}`
            : `Provider '${provider}' not found`;

        super(message);
        this.name = 'UnknownProviderError';
    }
}

/**
 * Custom error class for when a requested model is not found within a specific provider.
 */
export class UnknownModelError extends Error {
    constructor(provider: string, model: string, availableModels?: string[]) {
        const message = availableModels
            ? `Model '${model}' not found in provider '${provider}'. Available models: ${availableModels.join(', ')}`
            : `Model '${model}' not found in provider '${provider}'`;

        super(message);
        this.name = 'UnknownModelError';
    }
}

export class CantInferProviderError extends Error {
    constructor(model: string) {
        super(`Unrecognized model '${model}'. Could not infer provider.`);
        this.name = 'CantInferProviderError';
    }
}

export class EffectiveMaxInputTokensError extends Error {
    constructor(provider: LLMProvider, model: string) {
        super(
            `Could not determine effective maxInputTokens for ${provider}/${model}. ` +
                `'maxInputTokens' was not provided in config, and the model was not found in the registry.`
        );
        this.name = 'EffectiveMaxInputTokensError';
    }
}
