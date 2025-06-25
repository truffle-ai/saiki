import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBasedConfirmationProvider } from './event-based-confirmation-provider.js';
import { InMemoryAllowedToolsProvider } from './allowed-tools-provider/in-memory.js';
import { ToolConfirmationEvent, ToolConfirmationResponse } from './types.js';

describe('EventBasedConfirmationProvider', () => {
    let provider: EventBasedConfirmationProvider;
    let allowedToolsProvider: InMemoryAllowedToolsProvider;

    beforeEach(() => {
        allowedToolsProvider = new InMemoryAllowedToolsProvider();
        provider = new EventBasedConfirmationProvider(allowedToolsProvider);
    });

    afterEach(() => {
        provider.removeAllListeners();
        try {
            provider.cancelAllConfirmations();
        } catch {
            // Expected for pending promises
        }
    });

    describe('constructor', () => {
        it('should create provider with default timeout', () => {
            expect(provider).toBeInstanceOf(EventBasedConfirmationProvider);
            expect(provider.allowedToolsProvider).toBe(allowedToolsProvider);
        });

        it('should create provider with custom timeout', () => {
            const customProvider = new EventBasedConfirmationProvider(allowedToolsProvider, {
                confirmationTimeout: 5000,
            });
            expect(customProvider).toBeInstanceOf(EventBasedConfirmationProvider);
        });
    });

    describe('requestConfirmation', () => {
        it('should auto-approve allowed tools', async () => {
            await allowedToolsProvider.allowTool('testTool', 'user1');

            const result = await provider.requestConfirmation(
                {
                    toolName: 'testTool',
                    args: { arg1: 'value1' },
                },
                'user1'
            );

            expect(result).toBe(true);
        });

        it('should emit toolConfirmationRequest event for non-allowed tools', async () => {
            const eventSpy = vi.fn();
            provider.on('toolConfirmationRequest', eventSpy);

            // Start confirmation request but don't wait for it
            const confirmationPromise = provider.requestConfirmation(
                {
                    toolName: 'newTool',
                    args: { arg1: 'value1' },
                    description: 'Test tool',
                },
                'user1'
            );

            // Give event time to be emitted
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    toolName: 'newTool',
                    args: { arg1: 'value1' },
                    description: 'Test tool',
                    executionId: expect.any(String),
                    timestamp: expect.any(Date),
                    userId: 'user1',
                })
            );

            // Clean up the pending confirmation and catch the rejection
            provider.cancelAllConfirmations();
            await expect(confirmationPromise).rejects.toThrow(
                'All confirmation requests cancelled'
            );
        });

        it('should resolve with approval when response is received', async () => {
            const eventSpy = vi.fn();
            provider.on('toolConfirmationRequest', eventSpy);

            const confirmationPromise = provider.requestConfirmation({
                toolName: 'newTool',
                args: { arg1: 'value1' },
            });

            // Wait for event to be emitted
            await new Promise((resolve) => setTimeout(resolve, 10));

            const event: ToolConfirmationEvent = eventSpy.mock.calls[0][0];

            // Send approval response
            await provider.handleConfirmationResponse({
                executionId: event.executionId,
                approved: true,
                userId: event.userId,
            });

            const result = await confirmationPromise;
            expect(result).toBe(true);
        });

        it('should resolve with denial when response is received', async () => {
            const eventSpy = vi.fn();
            provider.on('toolConfirmationRequest', eventSpy);

            const confirmationPromise = provider.requestConfirmation({
                toolName: 'newTool',
                args: { arg1: 'value1' },
            });

            // Wait for event to be emitted
            await new Promise((resolve) => setTimeout(resolve, 10));

            const event: ToolConfirmationEvent = eventSpy.mock.calls[0][0];

            // Send denial response
            await provider.handleConfirmationResponse({
                executionId: event.executionId,
                approved: false,
                userId: event.userId,
            });

            const result = await confirmationPromise;
            expect(result).toBe(false);
        });

        it('should timeout if no response is received', async () => {
            const shortTimeoutProvider = new EventBasedConfirmationProvider(allowedToolsProvider, {
                confirmationTimeout: 100,
            });

            await expect(
                shortTimeoutProvider.requestConfirmation({
                    toolName: 'newTool',
                    args: { arg1: 'value1' },
                })
            ).rejects.toThrow('Tool confirmation timeout for newTool');

            shortTimeoutProvider.removeAllListeners();
        });
    });

    describe('handleConfirmationResponse', () => {
        it('should ignore responses for unknown execution IDs', async () => {
            await provider.handleConfirmationResponse({
                executionId: 'unknown-id',
                approved: true,
            });

            // Should not throw or cause issues
            expect(provider.getPendingConfirmations()).toEqual([]);
        });

        it('should add tool to allowed list when rememberChoice is true', async () => {
            const eventSpy = vi.fn();
            provider.on('toolConfirmationRequest', eventSpy);

            const confirmationPromise = provider.requestConfirmation(
                {
                    toolName: 'newTool',
                    args: { arg1: 'value1' },
                },
                'user1'
            );

            // Wait for event to be emitted
            await new Promise((resolve) => setTimeout(resolve, 10));

            const event: ToolConfirmationEvent = eventSpy.mock.calls[0][0];

            // Send approval response with remember choice
            await provider.handleConfirmationResponse({
                executionId: event.executionId,
                approved: true,
                rememberChoice: true,
                userId: 'user1',
            });

            await confirmationPromise;

            // Verify tool was added to allowed list
            const isAllowed = await allowedToolsProvider.isToolAllowed('newTool', 'user1');
            expect(isAllowed).toBe(true);
        });

        it('should not add tool to allowed list when denied', async () => {
            const eventSpy = vi.fn();
            provider.on('toolConfirmationRequest', eventSpy);

            const confirmationPromise = provider.requestConfirmation(
                {
                    toolName: 'newTool',
                    args: { arg1: 'value1' },
                },
                'user1'
            );

            // Wait for event to be emitted
            await new Promise((resolve) => setTimeout(resolve, 10));

            const event: ToolConfirmationEvent = eventSpy.mock.calls[0][0];

            // Send denial response with remember choice
            await provider.handleConfirmationResponse({
                executionId: event.executionId,
                approved: false,
                rememberChoice: true,
                userId: 'user1',
            });

            await confirmationPromise;

            // Verify tool was not added to allowed list
            const isAllowed = await allowedToolsProvider.isToolAllowed('newTool', 'user1');
            expect(isAllowed).toBe(false);
        });
    });

    describe('utility methods', () => {
        it('should track pending confirmations', async () => {
            const confirmationPromise = provider.requestConfirmation({
                toolName: 'newTool',
                args: { arg1: 'value1' },
            });

            // Wait for event to be emitted
            await new Promise((resolve) => setTimeout(resolve, 10));

            const pending = provider.getPendingConfirmations();
            expect(pending).toHaveLength(1);

            // Clean up and handle rejection
            provider.cancelAllConfirmations();
            await expect(confirmationPromise).rejects.toThrow(
                'All confirmation requests cancelled'
            );
        });

        it('should cancel individual confirmations', async () => {
            const eventSpy = vi.fn();
            provider.on('toolConfirmationRequest', eventSpy);

            const confirmationPromise = provider.requestConfirmation({
                toolName: 'newTool',
                args: { arg1: 'value1' },
            });

            // Wait for event to be emitted
            await new Promise((resolve) => setTimeout(resolve, 10));

            const event: ToolConfirmationEvent = eventSpy.mock.calls[0][0];
            provider.cancelConfirmation(event.executionId);

            await expect(confirmationPromise).rejects.toThrow('Confirmation request cancelled');
        });

        it('should cancel all confirmations', async () => {
            const confirmationPromise1 = provider.requestConfirmation({
                toolName: 'tool1',
                args: {},
            });

            const confirmationPromise2 = provider.requestConfirmation({
                toolName: 'tool2',
                args: {},
            });

            // Wait for events to be emitted
            await new Promise((resolve) => setTimeout(resolve, 10));

            provider.cancelAllConfirmations();

            await expect(confirmationPromise1).rejects.toThrow(
                'All confirmation requests cancelled'
            );
            await expect(confirmationPromise2).rejects.toThrow(
                'All confirmation requests cancelled'
            );
        });
    });
});
