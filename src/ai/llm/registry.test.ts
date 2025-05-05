import { describe, it, expect } from 'vitest';
import {
    LLM_REGISTRY,
    getSupportedProviders,
    getSupportedModels,
    getMaxTokensForModel,
    isValidProviderModel,
    getProviderFromModel,
    getAllSupportedModels,
} from './registry.js';

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

    it('should throw for unknown provider in getMaxTokensForModel', () => {
        expect(() => getMaxTokensForModel('foo', 'o4-mini')).toThrowError(
            /Provider 'foo' not found in LLM registry/
        );
    });

    it('should throw for unknown model in getMaxTokensForModel', () => {
        expect(() => getMaxTokensForModel('openai', 'foo')).toThrowError(
            /Model 'foo' not found for provider 'openai'/
        );
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
        expect(() => getProviderFromModel('foo')).toThrowError(/Unrecognized model 'foo'/);
    });

    it('should return all supported models for getAllSupportedModels', () => {
        const allModels = getAllSupportedModels();
        const expected = Object.values(LLM_REGISTRY).flatMap((info) =>
            info.models.map((m) => m.name)
        );
        expect(allModels).toEqual(expected);
    });
});
