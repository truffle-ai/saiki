import { redactSensitiveData as redact } from './redactor.js';

describe('redact', () => {
    // Basic field redaction
    test('should redact a single sensitive field', () => {
        expect(redact({ apiKey: 'secret' })).toEqual({ apiKey: '[REDACTED]' });
    });

    test('should redact multiple sensitive fields', () => {
        expect(redact({ apiKey: 'secret', password: 'pass' })).toEqual({
            apiKey: '[REDACTED]',
            password: '[REDACTED]',
        });
    });

    test('should perform case-insensitive field matching', () => {
        expect(redact({ ApiKey: 'secret', PASSWORD: 'pass' })).toEqual({
            ApiKey: '[REDACTED]',
            PASSWORD: '[REDACTED]',
        });
    });

    test('should handle mixed sensitive and non-sensitive fields', () => {
        expect(redact({ apiKey: 'secret', name: 'john' })).toEqual({
            apiKey: '[REDACTED]',
            name: 'john',
        });
    });

    test('should handle field names with underscores', () => {
        expect(redact({ api_key: 'secret', access_token: 'token' })).toEqual({
            api_key: '[REDACTED]',
            access_token: '[REDACTED]',
        });
    });

    // Array Processing
    test('should handle array of objects with sensitive fields', () => {
        expect(redact([{ apiKey: 'secret' }, { password: 'pass' }])).toEqual([
            { apiKey: '[REDACTED]' },
            { password: '[REDACTED]' },
        ]);
    });

    test('should handle array of strings with patterns', () => {
        expect(redact(['sk-thisisafakekeyofsufficientlength', 'normal string'])).toEqual([
            '[REDACTED]',
            'normal string',
        ]);
    });

    test('should handle mixed array types', () => {
        expect(redact([{ apiKey: 'secret' }, 'sk-thisisafakekeyofsufficientlength', 42])).toEqual([
            { apiKey: '[REDACTED]' },
            '[REDACTED]',
            42,
        ]);
    });

    test('should handle an empty array', () => {
        expect(redact([])).toEqual([]);
    });

    test('should handle nested arrays', () => {
        expect(redact([[{ apiKey: 'secret' }]])).toEqual([[{ apiKey: '[REDACTED]' }]]);
    });

    // Object Nesting
    test('should handle deeply nested sensitive fields', () => {
        expect(redact({ user: { config: { apiKey: 'secret' } } })).toEqual({
            user: { config: { apiKey: '[REDACTED]' } },
        });
    });

    test('should handle mixed nesting levels', () => {
        expect(redact({ apiKey: 'secret', user: { password: 'pass' } })).toEqual({
            apiKey: '[REDACTED]',
            user: { password: '[REDACTED]' },
        });
    });

    test('should handle array within object', () => {
        expect(redact({ users: [{ apiKey: 'secret' }] })).toEqual({
            users: [{ apiKey: '[REDACTED]' }],
        });
    });

    test('should handle object within array', () => {
        expect(redact([{ nested: { apiKey: 'secret' } }])).toEqual([
            { nested: { apiKey: '[REDACTED]' } },
        ]);
    });
});
