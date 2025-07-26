import { describe, it, expect } from 'vitest';
import {
    LLM_REGISTRY,
    getSupportedProviders,
    getSupportedModels,
    getMaxInputTokensForModel,
    isValidProviderModel,
    getProviderFromModel,
    getAllSupportedModels,
    getEffectiveMaxInputTokens,
    supportsBaseURL,
    requiresBaseURL,
    acceptsAnyModel,
    getDefaultModelForProvider,
    getSupportedFileTypesForModel,
    modelSupportsFileType,
    validateModelFileSupport,
} from './registry.js';
import { ModelNotFoundError } from './errors.js';
import { EffectiveMaxInputTokensError } from './errors.js';
import { ProviderNotFoundError } from './errors.js';

describe('LLM Registry', () => {
    it('should return all provider keys', () => {
        const providers = getSupportedProviders();
        expect(providers).toEqual(Object.keys(LLM_REGISTRY));
    });

    it('should return models for known provider', () => {
        const expected = LLM_REGISTRY.openai.models.map((m) => m.name);
        expect(getSupportedModels('openai')).toEqual(expected);
    });

    it('should be case-insensitive for getSupportedModels', () => {
        expect(getSupportedModels('OpenAI')).toEqual(getSupportedModels('openai'));
    });

    it('should return empty array for unknown provider', () => {
        expect(getSupportedModels('foo')).toEqual([]);
    });

    it('should return correct maxInputTokens for valid provider and model', () => {
        expect(getMaxInputTokensForModel('openai', 'o4-mini')).toBe(200000);
    });

    it('should be case-insensitive for getMaxInputTokensForModel', () => {
        expect(getMaxInputTokensForModel('OpenAI', 'O4-MINI')).toBe(200000);
    });

    it('should throw ProviderNotFoundError for unknown provider in getMaxInputTokensForModel', () => {
        expect(() => getMaxInputTokensForModel('foo', 'o4-mini')).toThrow(ProviderNotFoundError);
    });

    it('should throw ModelNotFoundError for unknown model in getMaxInputTokensForModel', () => {
        expect(() => getMaxInputTokensForModel('openai', 'foo')).toThrow(ModelNotFoundError);
    });

    it('should return true for requiresBaseURL with provider that needs baseURL', () => {
        expect(requiresBaseURL('openai-compatible')).toBe(true);
    });

    it("should return false for requiresBaseURL with provider that doesn't need baseURL", () => {
        expect(requiresBaseURL('openai')).toBe(false);
    });

    it('should return true for acceptsAnyModel with provider that accepts any model', () => {
        expect(acceptsAnyModel('openai-compatible')).toBe(true);
    });

    it('should return false for acceptsAnyModel with provider that has specific models', () => {
        expect(acceptsAnyModel('openai')).toBe(false);
    });

    it('should return true if provider or model is missing in isValidProviderModel', () => {
        expect(isValidProviderModel(undefined, 'some')).toBe(true);
        expect(isValidProviderModel('some', undefined)).toBe(true);
    });

    it('should return true for valid provider-model combinations', () => {
        expect(isValidProviderModel('openai', 'o4-mini')).toBe(true);
    });

    it('should be case-insensitive for isValidProviderModel', () => {
        expect(isValidProviderModel('OpenAI', 'O4-MINI')).toBe(true);
    });

    it('should return false for invalid provider in isValidProviderModel', () => {
        expect(isValidProviderModel('foo', 'o4-mini')).toBe(false);
    });

    it('should return false for invalid model in isValidProviderModel', () => {
        expect(isValidProviderModel('openai', 'foo')).toBe(false);
    });

    it('should return correct provider for valid model in getProviderFromModel', () => {
        expect(getProviderFromModel('o4-mini')).toBe('openai');
    });

    it('should be case-insensitive for getProviderFromModel', () => {
        expect(getProviderFromModel('O4-MINI')).toBe('openai');
    });

    it('should throw for unknown model in getProviderFromModel', () => {
        expect(() => getProviderFromModel('foo')).toThrow();
    });

    it('should return all supported models for getAllSupportedModels', () => {
        const allModels = getAllSupportedModels();
        const expected = Object.values(LLM_REGISTRY).flatMap((info) =>
            info.models.map((m) => m.name)
        );
        expect(allModels).toEqual(expected);
    });

    describe('getEffectiveMaxInputTokens()', () => {
        it('returns explicit override when provided and within registry limit', () => {
            const config = { provider: 'openai', model: 'o4-mini', maxInputTokens: 1000 } as any;
            expect(getEffectiveMaxInputTokens(config)).toBe(1000);
        });

        it('caps override exceeding registry limit to registry value', () => {
            const registryLimit = getMaxInputTokensForModel('openai', 'o4-mini');
            const config = {
                provider: 'openai',
                model: 'o4-mini',
                maxInputTokens: registryLimit + 1,
            } as any;
            expect(getEffectiveMaxInputTokens(config)).toBe(registryLimit);
        });

        it('returns override for unknown model when provided', () => {
            const config = {
                provider: 'openai',
                model: 'unknown-model',
                maxInputTokens: 50000,
            } as any;
            expect(getEffectiveMaxInputTokens(config)).toBe(50000);
        });

        it('defaults to 128000 when baseURL is set and maxInputTokens is missing', () => {
            const config = {
                provider: 'openai-compatible',
                model: 'custom-model',
                baseURL: 'https://example.com',
            } as any;
            expect(getEffectiveMaxInputTokens(config)).toBe(128000);
        });

        it('returns provided maxInputTokens when baseURL is set and maxInputTokens provided', () => {
            const config = {
                provider: 'openai-compatible',
                model: 'custom-model',
                baseURL: 'https://example.com',
                maxInputTokens: 12345,
            } as any;
            expect(getEffectiveMaxInputTokens(config)).toBe(12345);
        });

        it('uses registry when no override or baseURL is present', () => {
            const registryLimit = getMaxInputTokensForModel('openai', 'o4-mini');
            const config = { provider: 'openai', model: 'o4-mini' } as any;
            expect(getEffectiveMaxInputTokens(config)).toBe(registryLimit);
        });

        it('throws EffectiveMaxInputTokensError when lookup fails without override or baseURL', () => {
            const config = { provider: 'openai', model: 'non-existent-model' } as any;
            expect(() => getEffectiveMaxInputTokens(config)).toThrow(EffectiveMaxInputTokensError);
        });
    });

    describe('supportsBaseURL', () => {
        it('returns true for openai-compatible provider', () => {
            expect(supportsBaseURL('openai-compatible')).toBe(true);
        });

        it('returns false for anthropic provider', () => {
            expect(supportsBaseURL('anthropic')).toBe(false);
        });

        it('returns false for unknown provider', () => {
            expect(supportsBaseURL('unknown')).toBe(false);
        });
    });

    describe('requiresBaseURL', () => {
        it('returns true for openai-compatible provider', () => {
            expect(requiresBaseURL('openai-compatible')).toBe(true);
        });

        it('returns false for openai provider', () => {
            expect(requiresBaseURL('openai')).toBe(false);
        });

        it('returns false for unknown provider', () => {
            expect(requiresBaseURL('unknown')).toBe(false);
        });
    });

    describe('acceptsAnyModel', () => {
        it('returns true for openai-compatible provider', () => {
            expect(acceptsAnyModel('openai-compatible')).toBe(true);
        });

        it('returns false for openai provider', () => {
            expect(acceptsAnyModel('openai')).toBe(false);
        });

        it('returns false for unknown provider', () => {
            expect(acceptsAnyModel('unknown')).toBe(false);
        });
    });

    describe('Cohere registry entry', () => {
        const cohereModels = [
            'command-a-03-2025',
            'command-r-plus',
            'command-r',
            'command',
            'command-light',
        ];

        it('is registered as a provider', () => {
            expect(getSupportedProviders()).toContain('cohere');
        });

        it('returns all supported models for cohere', () => {
            expect(getSupportedModels('cohere')).toEqual(cohereModels);
        });

        it('returns the correct default model', () => {
            expect(getDefaultModelForProvider('cohere')).toBe('command-a-03-2025');
        });

        it('validates model/provider combos correctly', () => {
            for (const model of cohereModels) {
                expect(isValidProviderModel('cohere', model)).toBe(true);
            }
            expect(isValidProviderModel('cohere', 'non-existent')).toBe(false);
        });

        it('returns correct maxInputTokens for its models', () => {
            expect(getMaxInputTokensForModel('cohere', 'command-a-03-2025')).toBe(256000);
            expect(getMaxInputTokensForModel('cohere', 'command-r-plus')).toBe(128000);
            expect(getMaxInputTokensForModel('cohere', 'command-r')).toBe(128000);
            expect(getMaxInputTokensForModel('cohere', 'command')).toBe(4000);
            expect(getMaxInputTokensForModel('cohere', 'command-light')).toBe(4000);
        });

        it('returns correct provider for its models', () => {
            expect(getProviderFromModel('command-a-03-2025')).toBe('cohere');
            expect(getProviderFromModel('command-r-plus')).toBe('cohere');
            expect(getProviderFromModel('command-r')).toBe('cohere');
            expect(getProviderFromModel('command')).toBe('cohere');
            expect(getProviderFromModel('command-light')).toBe('cohere');
        });

        it('has correct baseURL support flags', () => {
            expect(supportsBaseURL('cohere')).toBe(false);
            expect(requiresBaseURL('cohere')).toBe(false);
        });

        it('does not accept any model', () => {
            expect(acceptsAnyModel('cohere')).toBe(false);
        });
    });
});

describe('File support functionality', () => {
    describe('getSupportedFileTypesForModel with default models', () => {
        it('should return provider-level default file types for OpenAI default model', () => {
            expect(getSupportedFileTypesForModel('openai', 'gpt-4.1-mini')).toEqual(['pdf']);
        });

        it('should return correct file types for Anthropic default model', () => {
            expect(getSupportedFileTypesForModel('anthropic', 'claude-4-sonnet-20250514')).toEqual([
                'pdf',
            ]);
        });

        it('should return correct file types for Google default model', () => {
            expect(getSupportedFileTypesForModel('google', 'gemini-2.5-pro')).toEqual([
                'pdf',
                'audio',
            ]);
        });

        it('should return empty array for providers without file support', () => {
            expect(getSupportedFileTypesForModel('groq', 'gemma-2-9b-it')).toEqual([]);
            expect(getSupportedFileTypesForModel('xai', 'grok-3')).toEqual([]);
            expect(getSupportedFileTypesForModel('cohere', 'command-r')).toEqual([]);
        });

        it('should throw error for unknown provider', () => {
            expect(() => getSupportedFileTypesForModel('unknown-provider', 'any-model')).toThrow(
                "Provider 'unknown-provider' not found. Available providers: openai, openai-compatible, anthropic, google, groq, xai, cohere"
            );
        });

        it('should be case-sensitive for provider names but case-insensitive for model names', () => {
            expect(() => getSupportedFileTypesForModel('OpenAI', 'gpt-4o')).toThrow(
                "Provider 'OpenAI' not found. Available providers: openai, openai-compatible, anthropic, google, groq, xai, cohere"
            );
            expect(getSupportedFileTypesForModel('openai', 'GPT-4O')).toEqual(['pdf']);
        });
    });

    describe('Model-aware file support', () => {
        describe('getSupportedFileTypesForModel', () => {
            it('should return model-specific file types when available', () => {
                expect(getSupportedFileTypesForModel('openai', 'gpt-4o-audio-preview')).toEqual([
                    'pdf',
                    'audio',
                ]);
                expect(getSupportedFileTypesForModel('openai', 'gpt-4o')).toEqual(['pdf']);
            });

            it('should throw error for unknown models', () => {
                expect(() => getSupportedFileTypesForModel('openai', 'unknown-model')).toThrow(
                    "Model 'unknown-model' not found in provider 'openai'"
                );
            });

            it('should throw error for unknown provider', () => {
                expect(() =>
                    getSupportedFileTypesForModel('unknown-provider', 'any-model')
                ).toThrow(
                    "Provider 'unknown-provider' not found. Available providers: openai, openai-compatible, anthropic, google, groq, xai, cohere"
                );
            });

            it('should return empty array for openai-compatible provider with any model (custom endpoints)', () => {
                expect(getSupportedFileTypesForModel('openai-compatible', 'custom-model')).toEqual(
                    []
                );
                expect(getSupportedFileTypesForModel('openai-compatible', 'gpt-4-custom')).toEqual(
                    []
                );
                expect(
                    getSupportedFileTypesForModel('openai-compatible', 'any-random-name')
                ).toEqual([]);
            });

            it('should be case-sensitive for provider names but case-insensitive for model names', () => {
                expect(() =>
                    getSupportedFileTypesForModel('OpenAI', 'gpt-4o-audio-preview')
                ).toThrow(
                    "Provider 'OpenAI' not found. Available providers: openai, openai-compatible, anthropic, google, groq, xai, cohere"
                );
                expect(getSupportedFileTypesForModel('openai', 'GPT-4O-AUDIO-PREVIEW')).toEqual([
                    'pdf',
                    'audio',
                ]);
            });
        });

        describe('modelSupportsFileType', () => {
            it('should return true for supported model file types', () => {
                expect(modelSupportsFileType('openai', 'gpt-4o-audio-preview', 'audio')).toBe(true);
                expect(modelSupportsFileType('openai', 'gpt-4o-audio-preview', 'pdf')).toBe(true);
                expect(modelSupportsFileType('openai', 'gpt-4o', 'pdf')).toBe(true);
            });

            it('should return false for unsupported model file types', () => {
                expect(modelSupportsFileType('openai', 'gpt-4o', 'audio')).toBe(false);
                expect(
                    modelSupportsFileType('anthropic', 'claude-4-sonnet-20250514', 'audio')
                ).toBe(false);
            });

            it('should return false for openai-compatible provider with any model (no file support assumed)', () => {
                expect(modelSupportsFileType('openai-compatible', 'custom-model', 'pdf')).toBe(
                    false
                );
                expect(modelSupportsFileType('openai-compatible', 'gpt-4-custom', 'audio')).toBe(
                    false
                );
                expect(modelSupportsFileType('openai-compatible', 'any-model', 'pdf')).toBe(false);
            });

            it('should throw error for unknown model or provider', () => {
                expect(() => modelSupportsFileType('unknown-provider', 'any-model', 'pdf')).toThrow(
                    "Provider 'unknown-provider' not found. Available providers: openai, openai-compatible, anthropic, google, groq, xai, cohere"
                );
                expect(() => modelSupportsFileType('openai', 'unknown-model', 'pdf')).toThrow(
                    "Model 'unknown-model' not found in provider 'openai'"
                );
            });
        });

        describe('validateModelFileSupport', () => {
            it('should validate supported files for specific models', () => {
                const result = validateModelFileSupport(
                    'openai',
                    'gpt-4o-audio-preview',
                    'audio/mp3'
                );
                expect(result.isSupported).toBe(true);
                expect(result.fileType).toBe('audio');
                expect(result.error).toBeUndefined();
            });

            it('should reject unsupported files for specific models', () => {
                const result = validateModelFileSupport('openai', 'gpt-4o', 'audio/mp3');
                expect(result.isSupported).toBe(false);
                expect(result.fileType).toBe('audio');
                expect(result.error).toBe("Model 'gpt-4o' (openai) does not support audio files");
            });

            it('should handle unknown MIME types', () => {
                const result = validateModelFileSupport('openai', 'gpt-4o', 'application/unknown');
                expect(result.isSupported).toBe(false);
                expect(result.fileType).toBeUndefined();
                expect(result.error).toBe('Unsupported file type: application/unknown');
            });

            it('should reject files for openai-compatible provider (unknown capabilities)', () => {
                const result = validateModelFileSupport(
                    'openai-compatible',
                    'custom-model',
                    'application/pdf'
                );
                expect(result.isSupported).toBe(false);
                expect(result.fileType).toBe('pdf');
                expect(result.error).toBe(
                    "Model 'custom-model' (openai-compatible) does not support pdf files"
                );
            });

            it('should be case-insensitive for model names', () => {
                const result = validateModelFileSupport(
                    'openai',
                    'GPT-4O-AUDIO-PREVIEW',
                    'audio/mp3'
                );
                expect(result.isSupported).toBe(true);
                expect(result.fileType).toBe('audio');
            });
        });
    });
});
