export class ProviderNotFoundError extends Error {
    constructor(provider: string) {
        super(`Provider '${provider}' not found in LLM registry.`);
        this.name = 'ProviderNotFoundError';
    }
}
export class ModelNotFoundError extends Error {
    constructor(provider: string, model: string) {
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

// Custom error for when maxTokens cannot be determined
export class EffectiveMaxTokensError extends Error {
    constructor(provider: string, model: string) {
        super(
            `Could not determine effective maxTokens for ${provider}/${model}. ` +
                `'maxTokens' was not provided in config, and the model was not found in the registry.`
        );
        this.name = 'EffectiveMaxTokensError';
    }
}
