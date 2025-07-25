import { describe, test, expect, vi, beforeEach } from 'vitest';
import { validateInputForLLM, createInputValidationError } from './validation.js';
import * as registry from './registry.js';

// Mock the registry module
vi.mock('./registry.js', () => ({
    validateModelFileSupport: vi.fn(),
    getAllowedMimeTypes: vi.fn(),
}));

describe('validateInputForLLM', () => {
    const mockValidateModelFileSupport = vi.mocked(registry.validateModelFileSupport);
    const mockGetAllowedMimeTypes = vi.mocked(registry.getAllowedMimeTypes);

    beforeEach(() => {
        vi.clearAllMocks();
        // Default mock implementations
        mockGetAllowedMimeTypes.mockReturnValue(['application/pdf', 'audio/mp3', 'audio/wav']);
        mockValidateModelFileSupport.mockReturnValue({
            isSupported: true,
        });
    });

    describe('text validation', () => {
        test('should pass validation for valid text input', () => {
            const result = validateInputForLLM(
                { text: 'Hello, world!' },
                { provider: 'openai', model: 'gpt-4' }
            );

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should pass validation for empty text when no other input provided', () => {
            const result = validateInputForLLM(
                { text: '' },
                { provider: 'openai', model: 'gpt-4' }
            );

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should pass validation for undefined text', () => {
            const result = validateInputForLLM({}, { provider: 'openai', model: 'gpt-4' });

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('file validation', () => {
        test('should pass validation for supported file type', () => {
            const result = validateInputForLLM(
                {
                    text: 'Analyze this file',
                    fileData: {
                        data: 'SGVsbG8gV29ybGQ=', // Valid base64 for "Hello World"
                        mimeType: 'application/pdf',
                        filename: 'document.pdf',
                    },
                },
                { provider: 'openai', model: 'gpt-4o' }
            );

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(mockValidateModelFileSupport).toHaveBeenCalledWith(
                'openai',
                'gpt-4o',
                'application/pdf'
            );
        });

        test('should fail validation for unsupported file type', () => {
            mockValidateModelFileSupport.mockReturnValue({
                isSupported: false,
                error: 'PDF not supported by this model',
            });

            const result = validateInputForLLM(
                {
                    text: 'Analyze this file',
                    fileData: {
                        data: 'SGVsbG8gV29ybGQ=', // Valid base64 for "Hello World"
                        mimeType: 'application/pdf',
                        filename: 'document.pdf',
                    },
                },
                { provider: 'openai', model: 'gpt-3.5-turbo' }
            );

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('PDF not supported by this model');
            expect(result.fileValidation).toBeDefined();
            expect(result.fileValidation?.isSupported).toBe(false);
        });

        test('should fail validation for file not in allowed MIME types', () => {
            const result = validateInputForLLM(
                {
                    text: 'Analyze this file',
                    fileData: {
                        data: 'base64data',
                        mimeType: 'application/exe',
                        filename: 'malware.exe',
                    },
                },
                { provider: 'openai', model: 'gpt-4' }
            );

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Unsupported file type');
            expect(result.fileValidation?.isSupported).toBe(false);
        });

        test('should fail validation for oversized file', () => {
            const largeBase64 = 'A'.repeat(67108865); // > 50MB

            const result = validateInputForLLM(
                {
                    text: 'Analyze this file',
                    fileData: {
                        data: largeBase64,
                        mimeType: 'application/pdf',
                        filename: 'large.pdf',
                    },
                },
                { provider: 'openai', model: 'gpt-4' }
            );

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('File size too large (max 50MB)');
        });

        test('should fail validation for invalid base64 format', () => {
            const result = validateInputForLLM(
                {
                    text: 'Analyze this file',
                    fileData: {
                        data: 'invalid-base64!@#',
                        mimeType: 'application/pdf',
                        filename: 'document.pdf',
                    },
                },
                { provider: 'openai', model: 'gpt-4' }
            );

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Invalid file data format');
        });

        test('should fail validation when model is not specified for file', () => {
            const result = validateInputForLLM(
                {
                    text: 'Analyze this file',
                    fileData: {
                        data: 'SGVsbG8gV29ybGQ=', // Valid base64 for "Hello World"
                        mimeType: 'application/pdf',
                        filename: 'document.pdf',
                    },
                },
                { provider: 'openai' } // No model specified
            );

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain(
                'Model must be specified for file capability validation'
            );
        });

        test('should handle files without mimeType gracefully', () => {
            const result = validateInputForLLM(
                {
                    text: 'Analyze this file',
                    fileData: {
                        data: 'SGVsbG8gV29ybGQ=', // Valid base64 for "Hello World"
                        mimeType: 'application/pdf',
                        filename: 'document.pdf',
                    },
                },
                { provider: 'openai', model: 'gpt-4' }
            );

            expect(result.isValid).toBe(true);
        });
    });

    describe('image validation', () => {
        test('should pass validation for image input', () => {
            const result = validateInputForLLM(
                {
                    text: 'Analyze this image',
                    imageData: {
                        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD',
                        mimeType: 'image/jpeg',
                    },
                },
                { provider: 'openai', model: 'gpt-4o' }
            );

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.imageValidation).toBeDefined();
            expect(result.imageValidation?.isSupported).toBe(true);
        });

        test('should pass validation for image without mimeType', () => {
            const result = validateInputForLLM(
                {
                    text: 'Analyze this image',
                    imageData: {
                        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD',
                    },
                },
                { provider: 'openai', model: 'gpt-4o' }
            );

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('combined input validation', () => {
        test('should pass validation for text + image + file', () => {
            const result = validateInputForLLM(
                {
                    text: 'Analyze this content',
                    imageData: {
                        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD',
                        mimeType: 'image/jpeg',
                    },
                    fileData: {
                        data: 'SGVsbG8gV29ybGQ=', // Valid base64 for "Hello World"
                        mimeType: 'application/pdf',
                        filename: 'document.pdf',
                    },
                },
                { provider: 'openai', model: 'gpt-4o' }
            );

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should fail validation when any input is invalid', () => {
            mockValidateModelFileSupport.mockReturnValue({
                isSupported: false,
                error: 'PDF not supported',
            });

            const result = validateInputForLLM(
                {
                    text: 'Analyze this content',
                    imageData: {
                        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD',
                        mimeType: 'image/jpeg',
                    },
                    fileData: {
                        data: 'SGVsbG8gV29ybGQ=', // Valid base64 for "Hello World"
                        mimeType: 'application/pdf',
                        filename: 'document.pdf',
                    },
                },
                { provider: 'openai', model: 'gpt-3.5-turbo' }
            );

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('PDF not supported');
        });
    });

    describe('error handling', () => {
        test('should handle validation service errors gracefully', () => {
            mockValidateModelFileSupport.mockImplementation(() => {
                throw new Error('Validation service unavailable');
            });

            const result = validateInputForLLM(
                {
                    text: 'Analyze this file',
                    fileData: {
                        data: 'SGVsbG8gV29ybGQ=', // Valid base64 for "Hello World"
                        mimeType: 'application/pdf',
                        filename: 'document.pdf',
                    },
                },
                { provider: 'openai', model: 'gpt-4' }
            );

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Failed to validate input');
        });

        test('should handle registry errors gracefully', () => {
            mockGetAllowedMimeTypes.mockImplementation(() => {
                throw new Error('Registry service unavailable');
            });

            const result = validateInputForLLM(
                {
                    text: 'Analyze this file',
                    fileData: {
                        data: 'base64data',
                        mimeType: 'application/pdf',
                        filename: 'document.pdf',
                    },
                },
                { provider: 'openai', model: 'gpt-4' }
            );

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Failed to validate input');
        });
    });

    describe('different providers and models', () => {
        test('should work with Anthropic provider', () => {
            const result = validateInputForLLM(
                {
                    text: 'Hello Claude',
                    fileData: {
                        data: 'SGVsbG8gV29ybGQ=', // Valid base64 for "Hello World"
                        mimeType: 'application/pdf',
                        filename: 'document.pdf',
                    },
                },
                { provider: 'anthropic', model: 'claude-3-sonnet' }
            );

            expect(result.isValid).toBe(true);
            expect(mockValidateModelFileSupport).toHaveBeenCalledWith(
                'anthropic',
                'claude-3-sonnet',
                'application/pdf'
            );
        });

        test('should work with Google provider', () => {
            const result = validateInputForLLM(
                {
                    text: 'Hello Gemini',
                    imageData: {
                        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD',
                        mimeType: 'image/jpeg',
                    },
                },
                { provider: 'google.generative-ai', model: 'gemini-2.0-flash' }
            );

            expect(result.isValid).toBe(true);
        });
    });
});

describe('createInputValidationError', () => {
    test('should create standardized error response', () => {
        const validation = {
            isValid: false,
            errors: ['File type not supported', 'Image format not supported'],
            fileValidation: {
                isSupported: false,
                fileType: 'application/pdf',
                error: 'PDF not supported by this model',
            },
            imageValidation: {
                isSupported: false,
                error: 'Image format not supported',
            },
        };

        const config = { provider: 'openai', model: 'gpt-3.5-turbo' };

        const result = createInputValidationError(validation, config);

        expect(result).toEqual({
            error: 'File type not supported; Image format not supported',
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            fileType: 'application/pdf',
            details: {
                fileValidation: {
                    isSupported: false,
                    fileType: 'application/pdf',
                    error: 'PDF not supported by this model',
                },
                imageValidation: {
                    isSupported: false,
                    error: 'Image format not supported',
                },
            },
        });
    });

    test('should handle validation without file or image details', () => {
        const validation = {
            isValid: false,
            errors: ['Text input cannot be empty'],
        };

        const config = { provider: 'openai', model: 'gpt-4' };

        const result = createInputValidationError(validation, config);

        expect(result).toEqual({
            error: 'Text input cannot be empty',
            provider: 'openai',
            model: 'gpt-4',
            fileType: undefined,
            details: {
                fileValidation: undefined,
                imageValidation: undefined,
            },
        });
    });
});
