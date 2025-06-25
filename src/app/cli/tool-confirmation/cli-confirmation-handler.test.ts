import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CLIConfirmationHandler } from './cli-confirmation-handler.js';
import { EventBasedConfirmationProvider } from '../../../core/client/tool-confirmation/event-based-confirmation-provider.js';
import { InMemoryAllowedToolsProvider } from '../../../core/client/tool-confirmation/allowed-tools-provider/in-memory.js';
import { InMemorySettingsProvider } from '../../../core/settings/in-memory-provider.js';
import { ToolConfirmationEvent } from '../../../core/client/tool-confirmation/types.js';

// Mock readline and process.stdin for testing
vi.mock('readline', () => ({
    emitKeypressEvents: vi.fn(),
    Key: {},
}));

// Mock chalk and boxen for testing
vi.mock('chalk', () => ({
    default: {
        cyan: vi.fn((text) => text),
        yellow: vi.fn((text) => text),
        green: vi.fn((text) => text),
        red: vi.fn((text) => text),
        gray: vi.fn((text) => text),
        dim: vi.fn((text) => text),
    },
}));

vi.mock('boxen', () => ({
    default: vi.fn((text, _options) => `[BOXED] ${text}`),
}));

// Mock logger to avoid winston issues
vi.mock('../../../core/logger/index.js', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        toolCall: vi.fn(),
    },
}));

describe('CLIConfirmationHandler', () => {
    let handler: CLIConfirmationHandler;
    let provider: EventBasedConfirmationProvider;
    let allowedToolsProvider: InMemoryAllowedToolsProvider;
    let settingsProvider: InMemorySettingsProvider;

    beforeEach(() => {
        allowedToolsProvider = new InMemoryAllowedToolsProvider();
        provider = new EventBasedConfirmationProvider(allowedToolsProvider);
        settingsProvider = new InMemorySettingsProvider();
        handler = new CLIConfirmationHandler(provider, settingsProvider);

        // Mock process.stdin
        Object.defineProperty(process, 'stdin', {
            value: {
                isTTY: true,
                setRawMode: vi.fn(),
                on: vi.fn(),
                removeListener: vi.fn(),
            },
            writable: true,
        });

        // Mock process.stdout
        Object.defineProperty(process, 'stdout', {
            value: {
                write: vi.fn(),
            },
            writable: true,
        });

        // Mock console.log
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        handler.destroy();
        provider.removeAllListeners();
        provider.cancelAllConfirmations();
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create handler and listen to provider events', () => {
            expect(handler).toBeInstanceOf(CLIConfirmationHandler);
            expect(provider.listenerCount('toolConfirmationRequest')).toBe(1);
        });

        it('should use provided settings provider', () => {
            const customSettingsProvider = new InMemorySettingsProvider();
            const customHandler = new CLIConfirmationHandler(provider, customSettingsProvider);
            expect(customHandler).toBeInstanceOf(CLIConfirmationHandler);
            customHandler.destroy();
        });
    });

    describe('handleConfirmationRequest', () => {
        it('should auto-approve when toolApprovalRequired is false', async () => {
            // Configure settings to not require approval
            await settingsProvider.updateUserSettings('default', {
                toolApprovalRequired: false,
            });

            const handleResponseSpy = vi.spyOn(provider, 'handleConfirmationResponse');

            const event: ToolConfirmationEvent = {
                executionId: 'exec-123',
                toolName: 'testTool',
                args: { arg1: 'value1' },
                description: 'Test tool',
                timestamp: new Date(),
            };

            // Emit the event
            provider.emit('toolConfirmationRequest', event);

            // Wait for async handling
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(handleResponseSpy).toHaveBeenCalledWith({
                executionId: 'exec-123',
                approved: true,
            });
        });

        it('should handle errors gracefully', async () => {
            const handleResponseSpy = vi.spyOn(provider, 'handleConfirmationResponse');

            // Mock an error in settings provider
            vi.spyOn(settingsProvider, 'getUserSettings').mockRejectedValue(
                new Error('Settings error')
            );

            const event: ToolConfirmationEvent = {
                executionId: 'exec-123',
                toolName: 'testTool',
                args: { arg1: 'value1' },
                description: 'Test tool',
                timestamp: new Date(),
            };

            // Emit the event
            provider.emit('toolConfirmationRequest', event);

            // Wait for async handling with longer timeout
            await new Promise((resolve) => setTimeout(resolve, 50));

            // Should send denial response on error
            expect(handleResponseSpy).toHaveBeenCalledWith({
                executionId: 'exec-123',
                approved: false,
            });
        });
    });

    describe('collectArrowKeyInput', () => {
        it('should be callable (testing setup)', () => {
            // This test ensures the mock setup is working
            // The actual input collection is complex to test due to readline interactions
            expect(typeof handler['collectArrowKeyInput']).toBe('function');
        });
    });

    describe('destroy', () => {
        it('should remove event listeners', () => {
            handler.destroy();
            expect(provider.listenerCount('toolConfirmationRequest')).toBe(0);
        });
    });

    describe('integration with provider', () => {
        it('should respond to tool confirmation events', async () => {
            const handleResponseSpy = vi.spyOn(provider, 'handleConfirmationResponse');

            // Configure settings to not require approval for easy testing
            await settingsProvider.updateUserSettings('testUser', {
                toolApprovalRequired: false,
            });

            const event: ToolConfirmationEvent = {
                executionId: 'exec-123',
                toolName: 'testTool',
                args: { arg1: 'value1' },
                description: 'Test tool',
                timestamp: new Date(),
            };

            // Emit the event
            provider.emit('toolConfirmationRequest', event);

            // Wait for async handling
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(handleResponseSpy).toHaveBeenCalledWith({
                executionId: 'exec-123',
                approved: true,
            });
        });

        it('should handle events without user context', async () => {
            const handleResponseSpy = vi.spyOn(provider, 'handleConfirmationResponse');

            // Configure settings to not require approval
            await settingsProvider.updateUserSettings('default', {
                toolApprovalRequired: false,
            });

            const event: ToolConfirmationEvent = {
                executionId: 'exec-123',
                toolName: 'testTool',
                args: { arg1: 'value1' },
                description: 'Test tool',
                timestamp: new Date(),
            };

            // Emit the event
            provider.emit('toolConfirmationRequest', event);

            // Wait for async handling
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(handleResponseSpy).toHaveBeenCalledWith({
                executionId: 'exec-123',
                approved: true,
            });
        });
    });
});
