import { describe, it, expect } from 'vitest';
import { SessionConfigSchema, type SessionConfig, type ValidatedSessionConfig } from './schemas.js';

describe('SessionConfigSchema', () => {
    describe('Field Validation', () => {
        it('should validate maxSessions as positive integer', () => {
            expect(() => SessionConfigSchema.parse({ maxSessions: -1 })).toThrow();
            expect(() => SessionConfigSchema.parse({ maxSessions: 0 })).toThrow();
            expect(() => SessionConfigSchema.parse({ maxSessions: 1.5 })).toThrow();

            // Valid values should pass
            expect(() => SessionConfigSchema.parse({ maxSessions: 1 })).not.toThrow();
            expect(() => SessionConfigSchema.parse({ maxSessions: 100 })).not.toThrow();
        });

        it('should validate sessionTTL as positive integer', () => {
            expect(() => SessionConfigSchema.parse({ sessionTTL: -1 })).toThrow();
            expect(() => SessionConfigSchema.parse({ sessionTTL: 0 })).toThrow();
            expect(() => SessionConfigSchema.parse({ sessionTTL: 1.5 })).toThrow();

            // Valid values should pass
            expect(() => SessionConfigSchema.parse({ sessionTTL: 1000 })).not.toThrow();
            expect(() => SessionConfigSchema.parse({ sessionTTL: 3600000 })).not.toThrow();
        });

        it('should reject string inputs without coercion', () => {
            expect(() =>
                SessionConfigSchema.parse({
                    maxSessions: '50',
                    sessionTTL: '1800000',
                })
            ).toThrow();
        });
    });

    describe('Default Values', () => {
        it('should apply field defaults for empty object', () => {
            const result = SessionConfigSchema.parse({});

            expect(result).toEqual({
                maxSessions: 100,
                sessionTTL: 3600000,
            });
        });

        it('should apply field defaults for partial config', () => {
            const result1 = SessionConfigSchema.parse({ maxSessions: 50 });
            expect(result1).toEqual({
                maxSessions: 50,
                sessionTTL: 3600000,
            });

            const result2 = SessionConfigSchema.parse({ sessionTTL: 1800000 });
            expect(result2).toEqual({
                maxSessions: 100,
                sessionTTL: 1800000,
            });
        });

        it('should override defaults when values provided', () => {
            const config = {
                maxSessions: 200,
                sessionTTL: 7200000,
            };

            const result = SessionConfigSchema.parse(config);
            expect(result).toEqual(config);
        });
    });

    describe('Edge Cases', () => {
        it('should handle boundary values', () => {
            // Very small valid values
            const small = SessionConfigSchema.parse({
                maxSessions: 1,
                sessionTTL: 1,
            });
            expect(small.maxSessions).toBe(1);
            expect(small.sessionTTL).toBe(1);

            // Large values
            const large = SessionConfigSchema.parse({
                maxSessions: 10000,
                sessionTTL: 86400000, // 24 hours
            });
            expect(large.maxSessions).toBe(10000);
            expect(large.sessionTTL).toBe(86400000);
        });

        it('should reject non-numeric types', () => {
            expect(() => SessionConfigSchema.parse({ maxSessions: 'abc' })).toThrow();
            expect(() => SessionConfigSchema.parse({ sessionTTL: null })).toThrow();
            expect(() => SessionConfigSchema.parse({ maxSessions: {} })).toThrow();
        });

        it('should reject extra fields with strict validation', () => {
            const configWithExtra = {
                maxSessions: 100,
                sessionTTL: 3600000,
                unknownField: 'should fail',
            };

            // Should fail due to strict validation
            expect(() => SessionConfigSchema.parse(configWithExtra)).toThrow();
        });
    });

    describe('Type Safety', () => {
        it('should have correct input and output types', () => {
            // Input type allows optional fields (due to defaults)
            const input: SessionConfig = {};
            const inputPartial: SessionConfig = { maxSessions: 50 };
            const inputFull: SessionConfig = { maxSessions: 100, sessionTTL: 3600000 };

            // All should be valid inputs
            expect(() => SessionConfigSchema.parse(input)).not.toThrow();
            expect(() => SessionConfigSchema.parse(inputPartial)).not.toThrow();
            expect(() => SessionConfigSchema.parse(inputFull)).not.toThrow();
        });

        it('should produce validated output type', () => {
            const result: ValidatedSessionConfig = SessionConfigSchema.parse({});

            // Output type guarantees all fields are present
            expect(typeof result.maxSessions).toBe('number');
            expect(typeof result.sessionTTL).toBe('number');
            expect(result.maxSessions).toBeGreaterThan(0);
            expect(result.sessionTTL).toBeGreaterThan(0);
        });
    });

    describe('Real-world Scenarios', () => {
        it('should handle typical production config', () => {
            const prodConfig = {
                maxSessions: 1000,
                sessionTTL: 7200000, // 2 hours
            };

            const result = SessionConfigSchema.parse(prodConfig);
            expect(result).toEqual(prodConfig);
        });

        it('should handle development config with shorter TTL', () => {
            const devConfig = {
                maxSessions: 10,
                sessionTTL: 300000, // 5 minutes
            };

            const result = SessionConfigSchema.parse(devConfig);
            expect(result).toEqual(devConfig);
        });
    });
});
