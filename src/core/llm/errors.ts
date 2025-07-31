import { LLMProvider } from './registry.js';

export class ProviderNotFoundError extends Error {
    constructor(provider: LLMProvider) {
        super(`Provider '${provider}' not found in LLM registry.`);
        this.name = 'ProviderNotFoundError';
    }
}
export class ModelNotFoundError extends Error {
    constructor(provider: LLMProvider, model: string) {
        super(`Model '${model}' not found for provider '${provider}' in LLM registry.`);
        this.name = 'ModelNotFoundError';
    }
}

export class CantInferProviderError extends Error {
    constructor(model: string) {
        super(`Unrecognized model '${model}'. Could not infer provider.`);
        this.name = 'CantInferProviderError';
    }
}

// Custom error for when maxInputTokens cannot be determined
export class EffectiveMaxInputTokensError extends Error {
    constructor(provider: LLMProvider, model: string) {
        super(
            `Could not determine effective maxInputTokens for ${provider}/${model}. ` +
                `'maxInputTokens' was not provided in config, and the model was not found in the registry.`
        );
        this.name = 'EffectiveMaxInputTokensError';
    }
}
