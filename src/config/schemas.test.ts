import { describe, it, expect } from 'vitest';
import { contributorConfigSchema, systemPromptConfigSchema, llmConfigSchema } from './schemas.js';

describe('Config Schemas', () => {
    it('contributorConfigSchema accepts valid config', () => {
        const valid = {
            id: 'user1',
            type: 'static',
            priority: 10,
            enabled: true,
            content: 'hello',
        };
        expect(() => contributorConfigSchema.parse(valid)).not.toThrow();
    });

    it('contributorConfigSchema rejects missing fields', () => {
        const invalid = { type: 'static', priority: 5 };
        expect(() => contributorConfigSchema.parse(invalid as any)).toThrow();
    });

    it('systemPromptConfigSchema accepts valid prompts', () => {
        const valid = { contributors: [{ id: 'c1', type: 'dynamic', priority: 1 }] };
        expect(() => systemPromptConfigSchema.parse(valid)).not.toThrow();
    });

    it('llmConfigSchema accepts valid string prompt', () => {
        const good = {
            provider: 'openai',
            model: 'o4-mini',
            systemPrompt: 'Hi',
            apiKey: 'key',
            maxIterations: 2,
        };
        expect(() => llmConfigSchema.parse(good)).not.toThrow();
    });

    it('llmConfigSchema accepts valid object prompt', () => {
        const objPrompt = {
            contributors: [{ id: 'c1', type: 'static', priority: 1, content: 'x' }],
        };
        const good = { provider: 'openai', model: 'o4-mini', systemPrompt: objPrompt };
        expect(() => llmConfigSchema.parse(good)).not.toThrow();
    });

    it('llmConfigSchema rejects unsupported provider', () => {
        const bad = { provider: 'bad', model: 'x', systemPrompt: 'Hi' };
        const error = expect(() => llmConfigSchema.parse(bad));
        error.toThrow(/Provider 'bad' is not supported/);
    });

    it('llmConfigSchema rejects unsupported model', () => {
        const badModel = { provider: 'openai', model: 'not-a-model', systemPrompt: 'Hi' };
        const error = expect(() => llmConfigSchema.parse(badModel));
        error.toThrow(/Model 'not-a-model' is not supported for provider 'openai'/);
    });
});
