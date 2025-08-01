import { validateModelFileSupport, getAllowedMimeTypes, LLMProvider } from './registry.js';
import { logger } from '../logger/index.js';
import type { ImageData, FileData } from './messages/types.js';
import { Result, ok, fail, Issue } from '../utils/result.js';

export interface ValidationLLMConfig {
    provider: LLMProvider;
    model?: string;
}

export interface ValidationContext {
    provider?: string;
    model?: string;
    fileType?: string;
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
): Result<ValidationData, ValidationContext> {
    const issues: Issue<ValidationContext>[] = [];
    let fileValidation: ValidationData['fileValidation'];
    let imageValidation: ValidationData['imageValidation'];

    try {
        const context: ValidationContext = {
            provider: config.provider,
            model: config.model,
        };

        // Validate file data if provided
        if (input.fileData) {
            fileValidation = validateFileInput(input.fileData, config);
            if (!fileValidation.isSupported) {
                issues.push({
                    code: 'file_validation',
                    message: fileValidation.error || 'File type not supported by current LLM',
                    context: { ...context, fileType: fileValidation.fileType },
                });
            }
        }

        // Validate image data if provided
        if (input.imageData) {
            imageValidation = validateImageInput(input.imageData, config);
            if (!imageValidation.isSupported) {
                issues.push({
                    code: 'image_validation',
                    message: imageValidation.error || 'Image format not supported by current LLM',
                    context,
                });
            }
        }

        // Basic text validation (could be extended)
        if (input.text && input.text.length === 0) {
            issues.push({
                code: 'text_validation',
                message: 'Text input cannot be empty',
                context,
            });
        }

        const validationData: ValidationData = {
            ...(fileValidation && { fileValidation }),
            ...(imageValidation && { imageValidation }),
        };

        return issues.length === 0 ? ok(validationData, issues) : fail(issues);
    } catch (error) {
        logger.error(`Error during input validation: ${error}`);
        return fail([
            {
                code: 'validation_error',
                message: 'Failed to validate input',
                context: { provider: config.provider, model: config.model },
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
): NonNullable<ValidationData['imageValidation']> {
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
    validation: Result<ValidationData, ValidationContext>,
    config: ValidationLLMConfig
) {
    const errors = validation.ok ? [] : validation.issues.map((issue) => issue.message);
    const validationData = validation.ok ? validation.data : undefined;

    return {
        error: errors.join('; '),
        provider: config.provider,
        model: config.model,
        fileType: validationData?.fileValidation?.fileType,
        details: {
            fileValidation: validationData?.fileValidation,
            imageValidation: validationData?.imageValidation,
        },
    };
}

// Removed deprecated legacy functions - no backward compatibility needed
