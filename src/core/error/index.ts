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
 * Abstract base class for all configuration-related errors.
 * Provides a common structure for errors that occur during configuration loading or parsing,
 * including an optional `configPath` to indicate which file caused the issue.
 */
export abstract class ConfigurationError extends Error {
    /**
     * Creates an instance of ConfigurationError.
     * @param message - A human-readable description of the error.
     * @param configPath - Optional. The path to the configuration file related to the error.
     */
    constructor(
        message: string,
        public readonly configPath?: string
    ) {
        super(message); // Call the parent Error constructor with the message.
        // Set the name of the error to the name of the concrete class that extends ConfigurationError.
        // This makes error identification easier (e.g., "ConfigFileNotFoundError").
        this.name = this.constructor.name;
    }
}

/**
 * Error thrown when a required configuration file is not found at the specified path.
 */
export class ConfigFileNotFoundError extends ConfigurationError {
    /**
     * Creates an instance of ConfigFileNotFoundError.
     * @param configPath - The path to the configuration file that was not found.
     */
    constructor(configPath: string) {
        super(`Configuration file not found: ${configPath}`, configPath);
    }
}

/**
 * Error thrown when there's a problem reading the content of a configuration file.
 * This could be due to permissions, file corruption, or other I/O issues.
 */
export class ConfigFileReadError extends ConfigurationError {
    /**
     * Creates an instance of ConfigFileReadError.
     * @param configPath - The path to the configuration file that could not be read.
     * @param cause - A string describing the underlying reason for the read failure (e.g., "Permission denied").
     */
    constructor(configPath: string, cause: string) {
        super(`Failed to read configuration file: ${cause}`, configPath);
    }
}

/**
 * Error thrown when the content of a configuration file cannot be parsed correctly (e.g., invalid YAML syntax).
 */
export class ConfigParseError extends ConfigurationError {
    /**
     * Creates an instance of ConfigParseError.
     * @param configPath - The path to the configuration file that failed to parse.
     * @param cause - A string detailing the parsing error (e.g., "YAMLException: bad indentation").
     */
    constructor(configPath: string, cause: string) {
        super(`Failed to parse YAML configuration: ${cause}`, configPath);
    }
}

/**
 * Error thrown when there's an issue with environment variable expansion within the configuration.
 * This can happen if a required environment variable is missing or if its expansion fails.
 */
export class ConfigEnvVarError extends ConfigurationError {
    /**
     * Creates an instance of ConfigEnvVarError.
     * @param configPath - The path to the configuration file where the environment variable issue occurred.
     * @param envVar - The name of the environment variable that caused the error.
     * @param cause - Optional. A string describing the specific reason for the expansion failure (e.g., "not defined").
     */
    constructor(
        configPath: string,
        public readonly envVar: string, // Public readonly property for the specific environment variable
        cause?: string
    ) {
        // Construct a specific message based on whether a cause is provided.
        const message = cause
            ? `Failed to expand environment variable '${envVar}': ${cause}`
            : `Environment variable '${envVar}' is required but not set`;
        super(message, configPath);
    }
}

/**
 * Error thrown when the loaded configuration fails a defined validation rule.
 * This indicates that the configuration is syntactically correct but semantically invalid.
 */
export class ConfigValidationError extends ConfigurationError {
    /**
     * Creates an instance of ConfigValidationError.
     * @param configPath - The path to the configuration file that failed validation.
     * @param field - The specific field within the configuration that failed validation.
     * @param validationError - A string describing why the field's value is invalid.
     */
    constructor(
        configPath: string,
        public readonly field: string, // Public readonly property for the specific field that failed validation
        public readonly validationError: string // Public readonly property for the specific validation error message
    ) {
        super(`Configuration validation failed for '${field}': ${validationError}`, configPath);
    }
}

/**
 * Custom error class for when there's a failure to write a configuration file.
 * Extends the abstract `ConfigurationError` base class.
 */
export class ConfigFileWriteError extends ConfigurationError {
    /**
     * Creates an instance of `ConfigFileWriteError`.
     * @param configPath - The path to the configuration file that could not be written.
     * @param cause - A string describing the underlying reason for the write failure (e.g., permissions, disk full).
     */
    constructor(configPath: string, cause: string) {
        super(`Failed to write configuration file '${configPath}': ${cause}`, configPath);
        this.name = 'ConfigFileWriteError'; // Explicitly set the name for clarity, though base constructor does this.
    }
}
