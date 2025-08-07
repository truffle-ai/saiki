import { validateModelFileSupport, getAllowedMimeTypes, LLMProvider } from './registry.js';
import { logger } from '../logger/index.js';
import type { ImageData, FileData } from '../context/types.js';
import { Result, ok, fail } from '../utils/result.js';
import { Issue, ErrorScope, ErrorType } from '@core/errors/types.js';
import { LLMErrorCode } from './error-codes.js';

// TOOD: Refactor/simplify this file
export interface ValidationLLMConfig {
    provider: LLMProvider;
    model?: string;
}

export interface ValidationContext {
    provider?: string;
    model?: string | undefined;
    fileSize?: number;
    maxFileSize?: number;
    filename?: string | undefined;
    mimeType?: string;
    fileType?: string | undefined;
    suggestedAction?: string;
}

export interface ValidationData {
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

/**
 * Input interface for comprehensive validation
 */
export interface ValidationInput {
    text?: string;
    imageData?: ImageData | undefined;
    fileData?: FileData | undefined;
}

// Security constants
const MAX_FILE_SIZE = 67108864; // 64MB in base64 format
const MAX_IMAGE_SIZE = 20971520; // 20MB

/**
 * Validates all inputs (text, image, file) against LLM capabilities and security requirements.
 * This is the single entry point for all input validation using pure Result<T,C> pattern.
 * @param input The input data to validate (text, image, file)
 * @param config The LLM configuration (provider and model)
 * @returns Comprehensive validation result
 */
export function validateInputForLLM(
    input: ValidationInput,
    config: ValidationLLMConfig
): Result<ValidationData, ValidationContext> {
    const issues: Issue<ValidationContext>[] = [];
    const validationData: ValidationData = {};

    try {
        const context: ValidationContext = {
            provider: config.provider,
            model: config.model,
        };

        // Validate file data if provided
        if (input.fileData) {
            const fileValidation = validateFileInput(input.fileData, config);
            validationData.fileValidation = fileValidation;

            if (!fileValidation.isSupported) {
                issues.push({
                    code: LLMErrorCode.INPUT_FILE_UNSUPPORTED,
                    message: fileValidation.error || 'File type not supported by current LLM',
                    scope: ErrorScope.LLM,
                    type: ErrorType.USER,
                    severity: 'error',
                    context: {
                        ...context,
                        fileType: fileValidation.fileType,
                        mimeType: input.fileData.mimeType,
                        filename: input.fileData.filename,
                        suggestedAction: 'Use a supported file type or different model',
                    },
                });
            }
        }

        // Validate image data if provided
        if (input.imageData) {
            const imageValidation = validateImageInput(input.imageData, config);
            validationData.imageValidation = imageValidation;

            if (!imageValidation.isSupported) {
                issues.push({
                    code: LLMErrorCode.INPUT_IMAGE_UNSUPPORTED,
                    message: imageValidation.error || 'Image format not supported by current LLM',
                    scope: ErrorScope.LLM,
                    type: ErrorType.USER,
                    severity: 'error',
                    context: {
                        ...context,
                        suggestedAction: 'Use a supported image format or different model',
                    },
                });
            }
        }

        // Basic text validation (currently permissive - empty text is allowed)
        // TODO: Could be extended with more sophisticated text validation rules
        // Note: Empty text is currently allowed as it may be valid in combination with images/files

        return issues.length === 0 ? ok(validationData, issues) : fail(issues);
    } catch (error) {
        logger.error(`Error during input validation: ${error}`);
        return fail([
            {
                code: LLMErrorCode.REQUEST_INVALID_SCHEMA,
                message: 'Failed to validate input',
                scope: ErrorScope.LLM,
                type: ErrorType.SYSTEM,
                severity: 'error',
                context: {
                    provider: config.provider,
                    model: config.model,
                    suggestedAction: 'Check input format and try again',
                },
            },
        ]);
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
): NonNullable<ValidationData['fileValidation']> {
    // Security validation: file size check (max 64MB for base64)
    if (typeof fileData.data === 'string' && fileData.data.length > MAX_FILE_SIZE) {
        return {
            isSupported: false,
            error: 'File size too large (max 64MB)',
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
 * Validates image input with size and format checks.
 * @param imageData The image data to validate
 * @param _config The LLM configuration
 * @returns Image validation result
 */
function validateImageInput(
    imageData: ImageData,
    _config: ValidationLLMConfig
): NonNullable<ValidationData['imageValidation']> {
    // Check image size if available
    if (typeof imageData.image === 'string' && imageData.image.length > MAX_IMAGE_SIZE) {
        return {
            isSupported: false,
            error: `Image size too large (max ${MAX_IMAGE_SIZE / 1048576}MB)`,
        };
    }

    // Basic MIME type validation for images
    const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (imageData.mimeType && !supportedImageTypes.includes(imageData.mimeType)) {
        return {
            isSupported: false,
            error: 'Unsupported image format',
        };
    }

    // For now, assume images are supported (existing behavior)
    // This can be expanded later with proper image capability validation
    return {
        isSupported: true,
    };
}
