/**
 * ToolConfirmationProvider Factory
 *
 * Selects and instantiates the appropriate ToolConfirmationProvider implementation
 * based on the application's run mode (cli, web, etc).
 *
 * Usage:
 *   import { createToolConfirmationProvider } from './factory.js';
 *   const provider = createToolConfirmationProvider(runMode);
 *
 * This centralizes provider selection logic, making it easy to extend and maintain.
 * TODO: implement web tool confirmation provider
 */

import { ToolConfirmationProvider } from './types.js';
import { CLIConfirmationProvider } from './cli-confirmation-provider.js';
import { NoOpConfirmationProvider } from './noop-confirmation-provider.js';
import {
    createAllowedToolsProvider,
    AllowedToolsConfig,
} from './allowed-tools-provider/factory.js';
import type { IAllowedToolsProvider } from './allowed-tools-provider/types.js';

export function createToolConfirmationProvider(options: {
    runMode: 'cli' | 'web' | 'discord' | 'telegram' | 'mcp' | 'api';
    allowedToolsProvider?: IAllowedToolsProvider;
    allowedToolsConfig?: AllowedToolsConfig;
}): ToolConfirmationProvider {
    const { runMode, allowedToolsProvider, allowedToolsConfig } = options;

    // Build allowedToolsProvider if config is provided and provider isn't
    let toolsProvider = allowedToolsProvider;
    if (!toolsProvider && allowedToolsConfig) {
        toolsProvider = createAllowedToolsProvider(allowedToolsConfig);
    }

    switch (runMode) {
        case 'cli':
            return new CLIConfirmationProvider(toolsProvider);
        case 'web':
        case 'discord':
        case 'telegram':
        case 'mcp':
        case 'api':
            // Fallback: No-op provider for now. Replace with real provider when available.
            return new NoOpConfirmationProvider();
        default:
            throw new Error(`Unknown run mode for ToolConfirmationProvider: ${runMode}`);
    }
}
