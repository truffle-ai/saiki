import { describe, it, expect } from 'vitest';
import {
    InternalToolsSchema,
    ToolConfirmationConfigSchema,
    type InternalToolsConfig,
    type ToolConfirmationConfig,
    type ValidatedToolConfirmationConfig,
} from './schemas.js';

describe('InternalToolsSchema', () => {
    describe('Array Validation', () => {
        it('should accept empty array as default', () => {
            const result = InternalToolsSchema.parse([]);
            expect(result).toEqual([]);
        });

        it('should accept valid internal tool names', () => {
            const result = InternalToolsSchema.parse(['search_history']);
            expect(result).toEqual(['search_history']);
        });

        it('should reject invalid tool names', () => {
            expect(() => InternalToolsSchema.parse(['invalid-tool'])).toThrow();
        });
        // TODO: update when more valid tools are added
        it('should accept multiple valid tools', () => {
            const result = InternalToolsSchema.parse(['search_history']);
            expect(result).toHaveLength(1);
        });
    });

    describe('Default Values', () => {
        it('should apply default empty array when undefined', () => {
            const result = InternalToolsSchema.parse(undefined);
            expect(result).toEqual([]);
        });
    });

    describe('Type Safety', () => {
        it('should have correct type inference', () => {
            const result: InternalToolsConfig = InternalToolsSchema.parse([]);
            expect(Array.isArray(result)).toBe(true);
        });
    });
});

describe('ToolConfirmationConfigSchema', () => {
    describe('Field Validation', () => {
        it('should validate mode enum values', () => {
            const validModes = ['event-based', 'auto-approve', 'auto-deny'];

            validModes.forEach((mode) => {
                expect(() => ToolConfirmationConfigSchema.parse({ mode })).not.toThrow();
            });

            expect(() => ToolConfirmationConfigSchema.parse({ mode: 'invalid' })).toThrow();
        });

        it('should validate timeout as positive integer', () => {
            expect(() => ToolConfirmationConfigSchema.parse({ timeout: -1 })).toThrow();
            expect(() => ToolConfirmationConfigSchema.parse({ timeout: 0 })).toThrow();
            expect(() => ToolConfirmationConfigSchema.parse({ timeout: 1.5 })).toThrow();

            // Valid values should pass
            expect(() => ToolConfirmationConfigSchema.parse({ timeout: 1000 })).not.toThrow();
            expect(() => ToolConfirmationConfigSchema.parse({ timeout: 30000 })).not.toThrow();
        });

        it('should validate allowedToolsStorage enum values', () => {
            const validStorage = ['memory', 'storage'];

            validStorage.forEach((allowedToolsStorage) => {
                expect(() =>
                    ToolConfirmationConfigSchema.parse({ allowedToolsStorage })
                ).not.toThrow();
            });

            expect(() =>
                ToolConfirmationConfigSchema.parse({ allowedToolsStorage: 'invalid' })
            ).toThrow();
        });
    });

    describe('Default Values', () => {
        it('should apply all field defaults for empty object', () => {
            const result = ToolConfirmationConfigSchema.parse({});

            expect(result).toEqual({
                mode: 'event-based',
                timeout: 30000,
                allowedToolsStorage: 'storage',
            });
        });

        it('should apply field defaults for partial config', () => {
            const result1 = ToolConfirmationConfigSchema.parse({ mode: 'auto-approve' });
            expect(result1).toEqual({
                mode: 'auto-approve',
                timeout: 30000,
                allowedToolsStorage: 'storage',
            });

            const result2 = ToolConfirmationConfigSchema.parse({ timeout: 15000 });
            expect(result2).toEqual({
                mode: 'event-based',
                timeout: 15000,
                allowedToolsStorage: 'storage',
            });

            const result3 = ToolConfirmationConfigSchema.parse({ allowedToolsStorage: 'memory' });
            expect(result3).toEqual({
                mode: 'event-based',
                timeout: 30000,
                allowedToolsStorage: 'memory',
            });
        });

        it('should override defaults when values provided', () => {
            const config = {
                mode: 'auto-deny' as const,
                timeout: 60000,
                allowedToolsStorage: 'memory' as const,
            };

            const result = ToolConfirmationConfigSchema.parse(config);
            expect(result).toEqual(config);
        });
    });

    describe('Edge Cases', () => {
        it('should handle boundary timeout values', () => {
            // Very small valid value
            const small = ToolConfirmationConfigSchema.parse({ timeout: 1 });
            expect(small.timeout).toBe(1);

            // Large timeout value
            const large = ToolConfirmationConfigSchema.parse({ timeout: 300000 }); // 5 minutes
            expect(large.timeout).toBe(300000);
        });

        it('should reject non-string mode values', () => {
            expect(() => ToolConfirmationConfigSchema.parse({ mode: 123 })).toThrow();
            expect(() => ToolConfirmationConfigSchema.parse({ mode: null })).toThrow();
        });

        it('should reject non-numeric timeout values', () => {
            expect(() => ToolConfirmationConfigSchema.parse({ timeout: 'abc' })).toThrow();
            expect(() => ToolConfirmationConfigSchema.parse({ timeout: null })).toThrow();
        });

        it('should reject extra fields with strict validation', () => {
            const configWithExtra = {
                mode: 'event-based',
                timeout: 30000,
                allowedToolsStorage: 'storage',
                unknownField: 'should fail',
            };

            expect(() => ToolConfirmationConfigSchema.parse(configWithExtra)).toThrow();
        });
    });

    describe('Type Safety', () => {
        it('should have correct input and output types', () => {
            // Input type allows optional fields (due to defaults)
            const input: ToolConfirmationConfig = {};
            const inputPartial: ToolConfirmationConfig = { mode: 'auto-approve' };
            const inputFull: ToolConfirmationConfig = {
                mode: 'event-based',
                timeout: 30000,
                allowedToolsStorage: 'storage',
            };

            expect(() => ToolConfirmationConfigSchema.parse(input)).not.toThrow();
            expect(() => ToolConfirmationConfigSchema.parse(inputPartial)).not.toThrow();
            expect(() => ToolConfirmationConfigSchema.parse(inputFull)).not.toThrow();
        });

        it('should produce validated output type', () => {
            const result: ValidatedToolConfirmationConfig = ToolConfirmationConfigSchema.parse({});

            // Output type guarantees all fields are present
            expect(typeof result.mode).toBe('string');
            expect(typeof result.timeout).toBe('number');
            expect(typeof result.allowedToolsStorage).toBe('string');
            expect(result.timeout).toBeGreaterThan(0);
        });
    });

    describe('Real-world Scenarios', () => {
        it('should handle interactive mode configuration', () => {
            const interactiveConfig = {
                mode: 'event-based' as const,
                timeout: 30000,
                allowedToolsStorage: 'storage' as const,
            };

            const result = ToolConfirmationConfigSchema.parse(interactiveConfig);
            expect(result).toEqual(interactiveConfig);
        });

        it('should handle auto-approve configuration', () => {
            const autoApproveConfig = {
                mode: 'auto-approve' as const,
                timeout: 1000, // Lower timeout since no user interaction
                allowedToolsStorage: 'memory' as const, // Memory for development
            };

            const result = ToolConfirmationConfigSchema.parse(autoApproveConfig);
            expect(result).toEqual(autoApproveConfig);
        });

        it('should handle strict security configuration', () => {
            const strictConfig = {
                mode: 'auto-deny' as const,
                timeout: 5000, // Short timeout
                allowedToolsStorage: 'memory' as const, // No persistent approvals
            };

            const result = ToolConfirmationConfigSchema.parse(strictConfig);
            expect(result).toEqual(strictConfig);
        });
    });
});
