/**
 * ToolConfirmationProvider Factory
 *
 * Creates ToolConfirmationProvider instances with configurable confirmation behavior.
 * No longer depends on run mode - instead provides flexible options for confirmation logic.
 *
 * Usage:
 *   import { createToolConfirmationProvider } from './factory.js';
 *   const provider = createToolConfirmationProvider({
 *     mode: 'event-based',
 *     allowedToolsProvider
 *   });
 *
 * This decouples tool confirmation from application run modes, allowing for
 * flexible confirmation strategies that can be configured per-instance.
 */

import { ToolConfirmationProvider } from './types.js';
import { EventBasedConfirmationProvider } from './event-based-confirmation-provider.js';
import { NoOpConfirmationProvider } from './noop-confirmation-provider.js';
import {
    createAllowedToolsProvider,
    AllowedToolsConfig,
} from './allowed-tools-provider/factory.js';
import type { IAllowedToolsProvider } from './allowed-tools-provider/types.js';

export type ToolConfirmationMode = 'event-based' | 'auto-approve' | 'auto-deny';

export interface ToolConfirmationOptions {
    mode?: ToolConfirmationMode | undefined;
    allowedToolsProvider?: IAllowedToolsProvider | undefined;
    allowedToolsConfig?: AllowedToolsConfig | undefined;
    confirmationTimeout?: number | undefined;
}

export function createToolConfirmationProvider(
    options: ToolConfirmationOptions = {}
): ToolConfirmationProvider {
    const {
        mode = 'event-based',
        allowedToolsProvider,
        allowedToolsConfig,
        confirmationTimeout,
    } = options;

    // Build allowedToolsProvider if config is provided and provider isn't
    let toolsProvider = allowedToolsProvider;
    if (!toolsProvider && allowedToolsConfig) {
        toolsProvider = createAllowedToolsProvider(allowedToolsConfig);
    }

    // Default to memory-based allowed tools provider if none provided
    if (!toolsProvider) {
        toolsProvider = createAllowedToolsProvider({ type: 'memory' });
    }

    switch (mode) {
        case 'event-based':
            return new EventBasedConfirmationProvider(
                toolsProvider,
                confirmationTimeout ? { confirmationTimeout } : {}
            );
        case 'auto-approve':
            return new NoOpConfirmationProvider(toolsProvider);
        case 'auto-deny':
            // Create a provider that always denies (useful for security-critical scenarios)
            return new NoOpConfirmationProvider(toolsProvider, false);
        default:
            throw new Error(`Unknown tool confirmation mode: ${mode}`);
    }
}

// Legacy function for backward compatibility - to be removed
export function createToolConfirmationProviderLegacy(options: {
    runMode: 'cli' | 'web' | 'discord' | 'telegram' | 'mcp' | 'server';
    allowedToolsProvider?: IAllowedToolsProvider;
    allowedToolsConfig?: AllowedToolsConfig;
}): ToolConfirmationProvider {
    // Map legacy run modes to new confirmation modes
    const mode: ToolConfirmationMode = options.runMode === 'cli' ? 'event-based' : 'auto-approve';

    return createToolConfirmationProvider({
        mode,
        allowedToolsProvider: options.allowedToolsProvider || undefined,
        allowedToolsConfig: options.allowedToolsConfig || undefined,
    });
}
