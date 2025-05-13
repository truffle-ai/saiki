import { describe, it, expect } from 'vitest';
import {
    LLM_REGISTRY,
    getSupportedProviders,
    getSupportedModels,
    getMaxTokensForModel,
    isValidProviderModel,
    getProviderFromModel,
    getAllSupportedModels,
    getEffectiveMaxTokens,
} from './registry.js';
import { ModelNotFoundError } from './errors.js';
import { EffectiveMaxTokensError } from './errors.js';
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

    it('should return correct maxTokens for valid provider and model', () => {
        expect(getMaxTokensForModel('openai', 'o4-mini')).toBe(200000);
    });

    it('should be case-insensitive for getMaxTokensForModel', () => {
        expect(getMaxTokensForModel('OpenAI', 'O4-MINI')).toBe(200000);
    });

    it('should throw ProviderNotFoundError for unknown provider in getMaxTokensForModel', () => {
        expect(() => getMaxTokensForModel('foo', 'o4-mini')).toThrow(ProviderNotFoundError);
    });

    it('should throw ModelNotFoundError for unknown model in getMaxTokensForModel', () => {
        expect(() => getMaxTokensForModel('openai', 'foo')).toThrow(ModelNotFoundError);
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

    describe('getEffectiveMaxTokens()', () => {
        it('returns explicit override when provided and within registry limit', () => {
            const config = { provider: 'openai', model: 'o4-mini', maxTokens: 1000 } as any;
            expect(getEffectiveMaxTokens(config)).toBe(1000);
        });

        it('caps override exceeding registry limit to registry value', () => {
            const registryLimit = getMaxTokensForModel('openai', 'o4-mini');
            const config = {
                provider: 'openai',
                model: 'o4-mini',
                maxTokens: registryLimit + 1,
            } as any;
            expect(getEffectiveMaxTokens(config)).toBe(registryLimit);
        });

        it('returns override for unknown model when provided', () => {
            const config = { provider: 'openai', model: 'unknown-model', maxTokens: 50000 } as any;
            expect(getEffectiveMaxTokens(config)).toBe(50000);
        });

        it('defaults to 128000 when baseURL is set and maxTokens is missing', () => {
            const config = {
                provider: 'openai',
                model: 'o4-mini',
                baseURL: 'https://example.com',
            } as any;
            expect(getEffectiveMaxTokens(config)).toBe(128000);
        });

        it('returns provided maxTokens when baseURL is set and maxTokens provided', () => {
            const config = {
                provider: 'openai',
                model: 'o4-mini',
                baseURL: 'https://example.com',
                maxTokens: 12345,
            } as any;
            expect(getEffectiveMaxTokens(config)).toBe(12345);
        });

        it('uses registry when no override or baseURL is present', () => {
            const registryLimit = getMaxTokensForModel('openai', 'o4-mini');
            const config = { provider: 'openai', model: 'o4-mini' } as any;
            expect(getEffectiveMaxTokens(config)).toBe(registryLimit);
        });

        it('throws EffectiveMaxTokensError when lookup fails without override or baseURL', () => {
            const config = { provider: 'openai', model: 'non-existent-model' } as any;
            expect(() => getEffectiveMaxTokens(config)).toThrow(EffectiveMaxTokensError);
        });
    });
});
