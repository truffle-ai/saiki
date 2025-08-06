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
