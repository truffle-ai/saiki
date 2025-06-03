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
import { InMemoryAllowedToolsProvider } from './allowed-tools-provider/in-memory.js';
// import { WebConfirmationProvider } from './web-confirmation-provider.js';
// import { UIConfirmationProvider } from './ui-confirmation-provider.js';

export function createToolConfirmationProvider(
    runMode: 'cli' | 'web' | 'discord' | 'telegram' | 'mcp',
    allowedToolsCfg?: AllowedToolsConfig
): ToolConfirmationProvider {
    // Build allowedToolsProvider based on config or default
    const toolsProvider = allowedToolsCfg ? createAllowedToolsProvider(allowedToolsCfg) : undefined;
    switch (runMode) {
        case 'cli':
            return new CLIConfirmationProvider(toolsProvider);
        case 'web':
        case 'discord':
        case 'telegram':
        case 'mcp':
            // Fallback: No-op provider for now. Replace with real provider when available.
            return new NoOpConfirmationProvider();
        default:
            throw new Error(`Unknown run mode for ToolConfirmationProvider: ${runMode}`);
    }
}
