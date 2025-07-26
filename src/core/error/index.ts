/**
 * Custom error class for when a requested provider is not found.
 * @class UnknownProviderError
 * @extends {Error}
 */
export class UnknownProviderError extends Error {
    /**
     * Creates an instance of UnknownProviderError.
     * @param {string} provider The name of the provider that was not found.
     * @param {string[]} [availableProviders] An optional list of available provider names to suggest to the user.
     */
    constructor(provider: string, availableProviders?: string[]) {
        // Construct the error message. If availableProviders are provided, include them in the message.
        const message = availableProviders
            ? `Provider '${provider}' not found. Available providers: ${availableProviders.join(', ')}`
            : `Provider '${provider}' not found`;

        super(message);

        // Set the name of the error to the class name for easier identification.
        this.name = 'UnknownProviderError';
    }
}

/**
 * Custom error class for when a requested model is not found within a specific provider.
 * @class UnknownModelError
 * @extends {Error}
 */
export class UnknownModelError extends Error {
    /**
     * Creates an instance of UnknownModelError.
     * @param {string} provider The name of the provider where the model was searched.
     * @param {string} model The name of the model that was not found.
     * @param {string[]} [availableModels] An optional list of available model names to suggest to the user.
     */
    constructor(provider: string, model: string, availableModels?: string[]) {
        // Construct the error message, including available models if provided.
        const message = availableModels
            ? `Model '${model}' not found in provider '${provider}'. Available models: ${availableModels.join(', ')}`
            : `Model '${model}' not found in provider '${provider}'`;

        super(message);

        // Set the name of the error.
        this.name = 'UnknownModelError';
    }
}

/**
 * Custom error class for when validation of data fails.
 * @class ValidationError
 * @extends {Error}
 */
export class ValidationError extends Error {
    /**
     * Creates an instance of ValidationError.
     * @param {string} message The validation failure message.
     * @param {string} [field] The name of the field that failed validation.
     */
    constructor(
        message: string,
        public readonly field?: string
    ) {
        super(message);

        // Set the name of the error.
        this.name = 'ValidationError';
    }
}

/**
 * Custom error class for issues related to configuration.
 * @class ConfigurationError
 * @extends {Error}
 */
export class ConfigurationError extends Error {
    /**
     * Creates an instance of ConfigurationError.
     * @param {string} message The configuration error message.
     * @param {string} [configPath] An optional path to the configuration file where the error occurred.
     */
    constructor(
        message: string,
        public readonly configPath?: string
    ) {
        super(message);

        // Set the name of the error.
        this.name = 'ConfigurationError';
    }
}
