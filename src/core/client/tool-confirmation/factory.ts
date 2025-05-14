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
// import { WebConfirmationProvider } from './web-confirmation-provider.js';
// import { UIConfirmationProvider } from './ui-confirmation-provider.js';

export function createToolConfirmationProvider(
    runMode: 'cli' | 'web' | 'discord' | 'telegram'
): ToolConfirmationProvider {
    switch (runMode) {
        case 'cli':
            return new CLIConfirmationProvider();
        case 'web':
        case 'discord':
        case 'telegram':
            // Fallback: No-op provider for now. Replace with real provider when available.
            return new NoOpConfirmationProvider();
        default:
            throw new Error(`Unknown run mode for ToolConfirmationProvider: ${runMode}`);
    }
}
