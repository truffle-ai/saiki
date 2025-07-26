import { describe, test, expect } from 'vitest';
import { validateInputForLLM, createInputValidationError } from './validation.js';

describe('validateInputForLLM', () => {
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
        test('should pass validation for supported file type with model that supports PDF', () => {
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
            expect(result.fileValidation?.isSupported).toBe(true);
        });

        test('should pass validation for supported audio file with model that supports audio', () => {
            const result = validateInputForLLM(
                {
                    text: 'Analyze this audio',
                    fileData: {
                        data: 'SGVsbG8gV29ybGQ=', // Valid base64 for "Hello World"
                        mimeType: 'audio/mp3',
                        filename: 'audio.mp3',
                    },
                },
                { provider: 'openai', model: 'gpt-4o-audio-preview' }
            );

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.fileValidation?.isSupported).toBe(true);
        });

        test('should fail validation for unsupported file type (model without audio support)', () => {
            const result = validateInputForLLM(
                {
                    text: 'Analyze this audio',
                    fileData: {
                        data: 'SGVsbG8gV29ybGQ=', // Valid base64 for "Hello World"
                        mimeType: 'audio/mp3',
                        filename: 'audio.mp3',
                    },
                },
                { provider: 'openai', model: 'gpt-4o' } // This model doesn't support audio
            );

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
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
                { provider: 'openai', model: 'gpt-4o' }
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
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('File size too large');
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
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Invalid file data format');
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
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Model must be specified');
        });

        test('should fail validation for file without mimeType', () => {
            const result = validateInputForLLM(
                {
                    text: 'Analyze this file',
                    fileData: {
                        data: 'SGVsbG8gV29ybGQ=', // Valid base64 for "Hello World"
                        mimeType: '', // Empty MIME type should fail
                        filename: 'document.pdf',
                    },
                },
                { provider: 'openai', model: 'gpt-4o' }
            );

            expect(result.isValid).toBe(false);
            expect(result.fileValidation?.isSupported).toBe(false);
            expect(result.errors).toContain('Unsupported file type');
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

        test('should fail validation when file input is invalid for model', () => {
            const result = validateInputForLLM(
                {
                    text: 'Analyze this content',
                    imageData: {
                        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD',
                        mimeType: 'image/jpeg',
                    },
                    fileData: {
                        data: 'SGVsbG8gV29ybGQ=', // Valid base64 for "Hello World"
                        mimeType: 'audio/mp3',
                        filename: 'audio.mp3',
                    },
                },
                { provider: 'openai', model: 'gpt-4o' } // This model doesn't support audio
            );

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.fileValidation?.isSupported).toBe(false);
        });
    });

    describe('error handling', () => {
        test('should handle unknown provider gracefully', () => {
            const result = validateInputForLLM(
                {
                    text: 'Analyze this file',
                    fileData: {
                        data: 'SGVsbG8gV29ybGQ=', // Valid base64 for "Hello World"
                        mimeType: 'application/pdf',
                        filename: 'document.pdf',
                    },
                },
                { provider: 'unknown-provider', model: 'unknown-model' }
            );

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('should fail validation for unknown model', () => {
            const result = validateInputForLLM(
                {
                    text: 'Analyze this file',
                    fileData: {
                        data: 'SGVsbG8gV29ybGQ=', // Valid base64 for "Hello World"
                        mimeType: 'application/pdf',
                        filename: 'document.pdf',
                    },
                },
                { provider: 'openai', model: 'unknown-model' }
            );

            // Fixed behavior: unknown models should fail validation
            expect(result.isValid).toBe(false);
            expect(result.fileValidation?.isSupported).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('different providers and models', () => {
        test('should work with Anthropic provider and PDF files', () => {
            const result = validateInputForLLM(
                {
                    text: 'Hello Claude',
                    fileData: {
                        data: 'SGVsbG8gV29ybGQ=', // Valid base64 for "Hello World"
                        mimeType: 'application/pdf',
                        filename: 'document.pdf',
                    },
                },
                { provider: 'anthropic', model: 'claude-4-sonnet-20250514' }
            );

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.fileValidation?.isSupported).toBe(true);
        });

        test('should work with Google provider and PDF files', () => {
            const result = validateInputForLLM(
                {
                    text: 'Hello Gemini',
                    fileData: {
                        data: 'SGVsbG8gV29ybGQ=', // Valid base64 for "Hello World"
                        mimeType: 'application/pdf',
                        filename: 'document.pdf',
                    },
                },
                { provider: 'google', model: 'gemini-2.0-flash' }
            );

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.fileValidation?.isSupported).toBe(true);
        });

        test('should work with image validation (always supported currently)', () => {
            const result = validateInputForLLM(
                {
                    text: 'Hello Gemini',
                    imageData: {
                        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD',
                        mimeType: 'image/jpeg',
                    },
                },
                { provider: 'google', model: 'gemini-2.0-flash' }
            );

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.imageValidation?.isSupported).toBe(true);
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
