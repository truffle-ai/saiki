import { describe, it, expect, beforeEach } from 'vitest';
import { createToolConfirmationProvider, createToolConfirmationProviderLegacy } from './factory.js';
import { EventBasedConfirmationProvider } from './event-based-confirmation-provider.js';
import { NoOpConfirmationProvider } from './noop-confirmation-provider.js';
import { InMemoryAllowedToolsProvider } from './allowed-tools-provider/in-memory.js';

describe('Tool Confirmation Factory', () => {
    describe('createToolConfirmationProvider', () => {
        it('should create event-based provider by default', () => {
            const provider = createToolConfirmationProvider();
            expect(provider).toBeInstanceOf(EventBasedConfirmationProvider);
        });

        it('should create event-based provider when explicitly specified', () => {
            const provider = createToolConfirmationProvider({ mode: 'event-based' });
            expect(provider).toBeInstanceOf(EventBasedConfirmationProvider);
        });

        it('should create auto-approve provider', () => {
            const provider = createToolConfirmationProvider({ mode: 'auto-approve' });
            expect(provider).toBeInstanceOf(NoOpConfirmationProvider);
        });

        it('should create auto-deny provider', () => {
            const provider = createToolConfirmationProvider({ mode: 'auto-deny' });
            expect(provider).toBeInstanceOf(NoOpConfirmationProvider);
        });

        it('should use provided allowed tools provider', () => {
            const allowedToolsProvider = new InMemoryAllowedToolsProvider();
            const provider = createToolConfirmationProvider({
                allowedToolsProvider,
            });
            expect(provider.allowedToolsProvider).toBe(allowedToolsProvider);
        });

        it('should create allowed tools provider from config', () => {
            const provider = createToolConfirmationProvider({
                allowedToolsConfig: { type: 'memory' },
            });
            expect(provider.allowedToolsProvider).toBeDefined();
        });

        it('should pass confirmation timeout to event-based provider', () => {
            const provider = createToolConfirmationProvider({
                mode: 'event-based',
                confirmationTimeout: 5000,
            });
            expect(provider).toBeInstanceOf(EventBasedConfirmationProvider);
        });

        it('should throw error for unknown mode', () => {
            expect(() => {
                createToolConfirmationProvider({
                    mode: 'unknown-mode' as any,
                });
            }).toThrow('Unknown tool confirmation mode: unknown-mode');
        });
    });

    describe('createToolConfirmationProviderLegacy', () => {
        it('should create event-based provider for cli mode', () => {
            const provider = createToolConfirmationProviderLegacy({
                runMode: 'cli',
            });
            expect(provider).toBeInstanceOf(EventBasedConfirmationProvider);
        });

        it('should create auto-approve provider for web mode', () => {
            const provider = createToolConfirmationProviderLegacy({
                runMode: 'web',
            });
            expect(provider).toBeInstanceOf(NoOpConfirmationProvider);
        });

        it('should create auto-approve provider for discord mode', () => {
            const provider = createToolConfirmationProviderLegacy({
                runMode: 'discord',
            });
            expect(provider).toBeInstanceOf(NoOpConfirmationProvider);
        });

        it('should create auto-approve provider for telegram mode', () => {
            const provider = createToolConfirmationProviderLegacy({
                runMode: 'telegram',
            });
            expect(provider).toBeInstanceOf(NoOpConfirmationProvider);
        });

        it('should create auto-approve provider for mcp mode', () => {
            const provider = createToolConfirmationProviderLegacy({
                runMode: 'mcp',
            });
            expect(provider).toBeInstanceOf(NoOpConfirmationProvider);
        });

        it('should create auto-approve provider for server mode', () => {
            const provider = createToolConfirmationProviderLegacy({
                runMode: 'server',
            });
            expect(provider).toBeInstanceOf(NoOpConfirmationProvider);
        });

        it('should pass through allowed tools provider', () => {
            const allowedToolsProvider = new InMemoryAllowedToolsProvider();
            const provider = createToolConfirmationProviderLegacy({
                runMode: 'cli',
                allowedToolsProvider,
            });
            expect(provider.allowedToolsProvider).toBe(allowedToolsProvider);
        });

        it('should pass through allowed tools config', () => {
            const provider = createToolConfirmationProviderLegacy({
                runMode: 'cli',
                allowedToolsConfig: { type: 'memory' },
            });
            expect(provider.allowedToolsProvider).toBeDefined();
        });
    });

    describe('NoOpConfirmationProvider behavior', () => {
        it('should auto-approve when created with auto-approve mode', async () => {
            const provider = createToolConfirmationProvider({ mode: 'auto-approve' });
            const result = await provider.requestConfirmation({
                toolName: 'testTool',
                args: {},
            });
            expect(result).toBe(true);
        });

        it('should auto-deny when created with auto-deny mode', async () => {
            const provider = createToolConfirmationProvider({ mode: 'auto-deny' });
            const result = await provider.requestConfirmation({
                toolName: 'testTool',
                args: {},
            });
            expect(result).toBe(false);
        });
    });
});
