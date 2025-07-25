import { validateModelFileSupport, validateFileSupport } from './registry.js';
import { logger } from '../../logger/index.js';

export interface FileValidationResult {
    isSupported: boolean;
    fileType?: string;
    error?: string;
}

export interface FileValidationConfig {
    provider: string;
    model?: string;
}

/**
 * Validates if a file is supported by the current LLM configuration.
 * Uses model-specific validation when available, falls back to provider-level.
 * @param config The LLM configuration containing provider and optional model
 * @param mimeType The MIME type of the file to validate
 * @returns Validation result with support status and error details
 */
export function validateFileForLLM(
    config: FileValidationConfig,
    mimeType: string
): FileValidationResult {
    try {
        let validation: FileValidationResult;

        // Try model-specific validation first, fall back to provider-level
        if (config.model) {
            validation = validateModelFileSupport(config.provider, config.model, mimeType);
        } else {
            validation = validateFileSupport(config.provider, mimeType);
        }

        return validation;
    } catch (error) {
        logger.error(`Error during file validation: ${error}`);
        return {
            isSupported: false,
            error: 'Failed to validate file support',
        };
    }
}

/**
 * Creates a standardized error response for file validation failures.
 * @param validation The validation result containing error details
 * @param config The LLM configuration for context
 * @returns Standardized error object
 */
export function createFileValidationError(
    validation: FileValidationResult,
    config: FileValidationConfig
) {
    return {
        error: validation.error || 'File type not supported by current LLM',
        provider: config.provider,
        model: config.model,
        fileType: validation.fileType,
    };
}
