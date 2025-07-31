import { describe, it, expect, beforeEach } from 'vitest';
import { createToolConfirmationProvider } from './factory.js';
import { EventBasedConfirmationProvider } from './event-based-confirmation-provider.js';
import { NoOpConfirmationProvider } from './noop-confirmation-provider.js';
import { InMemoryAllowedToolsProvider } from './allowed-tools-provider/in-memory.js';
import { AgentEventBus } from '../../events/index.js';

describe('Tool Confirmation Factory', () => {
    let agentEventBus: AgentEventBus;

    beforeEach(() => {
        agentEventBus = new AgentEventBus();
    });

    describe('createToolConfirmationProvider', () => {
        it('should create event-based provider by default', () => {
            const provider = createToolConfirmationProvider({ agentEventBus });
            expect(provider).toBeInstanceOf(EventBasedConfirmationProvider);
        });

        it('should create event-based provider when explicitly specified', () => {
            const provider = createToolConfirmationProvider({ mode: 'event-based', agentEventBus });
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
                agentEventBus,
            });
            expect(provider.allowedToolsProvider).toBe(allowedToolsProvider);
        });

        it('should create allowed tools provider from config', () => {
            const provider = createToolConfirmationProvider({
                allowedToolsConfig: { type: 'memory' },
                agentEventBus,
            });
            expect(provider.allowedToolsProvider).toBeDefined();
        });

        it('should pass confirmation timeout to event-based provider', () => {
            const provider = createToolConfirmationProvider({
                mode: 'event-based',
                confirmationTimeout: 5000,
                agentEventBus,
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

        it('should throw error when agentEventBus is missing for event-based mode', () => {
            expect(() => {
                createToolConfirmationProvider({
                    mode: 'event-based',
                });
            }).toThrow('AgentEventBus is required for event-based tool confirmation mode');
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
