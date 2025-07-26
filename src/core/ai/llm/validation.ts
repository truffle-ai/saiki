import { validateModelFileSupport, getAllowedMimeTypes } from './registry.js';
import { logger } from '../../logger/index.js';
import type { ImageData, FileData } from './messages/types.js';
import { ValidationError } from '@core/error/index.js';

export interface InputValidationResult {
    isValid: boolean;
    errors: string[];
    fileValidation?: {
        isSupported: boolean;
        fileType?: string;
        error?: string;
    };
    imageValidation?: {
        isSupported: boolean;
        error?: string;
    };
}

export interface ValidationLLMConfig {
    provider: string;
    model?: string;
}

/**
 * Input interface for comprehensive validation
 */
export interface ValidationInput {
    text?: string;
    imageData?: ImageData | undefined;
    fileData?: FileData | undefined;
}

/**
 * Validates all inputs (text, image, file) against LLM capabilities and security requirements.
 * This is the single entry point for all input validation.
 * @param input The input data to validate (text, image, file)
 * @param config The LLM configuration (provider and model)
 * @returns Comprehensive validation result
 */
export function validateInputForLLM(
    input: ValidationInput,
    config: ValidationLLMConfig
): InputValidationResult {
    const errors: string[] = [];
    let fileValidation: InputValidationResult['fileValidation'];
    let imageValidation: InputValidationResult['imageValidation'];

    try {
        // Validate file data if provided
        if (input.fileData) {
            fileValidation = validateFileInput(input.fileData, config);
            if (!fileValidation.isSupported) {
                errors.push(fileValidation.error || 'File type not supported by current LLM');
            }
        }

        // Validate image data if provided
        if (input.imageData) {
            imageValidation = validateImageInput(input.imageData, config);
            if (!imageValidation.isSupported) {
                errors.push(imageValidation.error || 'Image format not supported by current LLM');
            }
        }

        // Basic text validation (could be extended)
        if (input.text && input.text.length === 0) {
            errors.push('Text input cannot be empty');
        }

        return {
            isValid: errors.length === 0,
            errors,
            ...(fileValidation && { fileValidation }),
            ...(imageValidation && { imageValidation }),
        };
    } catch (error) {
        logger.error(
            `Error during input validation: ${error instanceof Error ? error.message : String(error)}`
        );
        throw new ValidationError('Failed to validate input', 'input');
    }
}

/**
 * Validates file input including security checks and model capability validation.
 * @param fileData The file data to validate
 * @param config The LLM configuration
 * @returns File validation result
 */
function validateFileInput(
    fileData: FileData,
    config: ValidationLLMConfig
): NonNullable<InputValidationResult['fileValidation']> {
    // Security validation: file size check (max 50MB for base64)
    if (typeof fileData.data === 'string' && fileData.data.length > 67108864) {
        return {
            isSupported: false,
            error: 'File size too large (max 50MB)',
        };
    }

    // Security validation: MIME type allowlist
    const allowedMimeTypes = getAllowedMimeTypes();
    if (!allowedMimeTypes.includes(fileData.mimeType)) {
        return {
            isSupported: false,
            error: 'Unsupported file type',
        };
    }

    // Security validation: base64 format check
    if (typeof fileData.data === 'string') {
        // Enhanced base64 validation: ensures proper length and padding
        const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
        if (!base64Regex.test(fileData.data) || fileData.data.length % 4 !== 0) {
            return {
                isSupported: false,
                error: 'Invalid file data format',
            };
        }
    }

    // Model-specific capability validation (only if model is specified)
    if (config.model) {
        return validateModelFileSupport(config.provider, config.model, fileData.mimeType);
    }

    // If no model specified, we cannot validate capabilities
    return {
        isSupported: false,
        error: 'Model must be specified for file capability validation',
    };
}

/**
 * Validates image input (placeholder for future image validation logic).
 * @param _imageData The image data to validate
 * @param _config The LLM configuration
 * @returns Image validation result
 */
function validateImageInput(
    _imageData: ImageData,
    _config: ValidationLLMConfig
): NonNullable<InputValidationResult['imageValidation']> {
    // For now, assume images are supported (existing behavior)
    // This can be expanded later with proper image capability validation
    return {
        isSupported: true,
    };
}

/**
 * Creates a standardized error response for input validation failures.
 * @param validation The validation result containing error details
 * @param config The LLM configuration for context
 * @returns Standardized error object
 */
export function createInputValidationError(
    validation: InputValidationResult,
    config: ValidationLLMConfig
) {
    return {
        error: validation.errors.join('; '),
        provider: config.provider,
        model: config.model,
        fileType: validation.fileValidation?.fileType,
        details: {
            fileValidation: validation.fileValidation,
            imageValidation: validation.imageValidation,
        },
    };
}

// Removed deprecated legacy functions - no backward compatibility needed
