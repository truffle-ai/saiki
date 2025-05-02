/**
 * NoOpConfirmationProvider
 *
 * A ToolConfirmationProvider implementation that always approves tool execution.
 * Used as a fallback for environments (like 'web') where confirmation is not yet implemented.
 *
 * Uses InMemoryAllowedToolsProvider to satisfy the interface, but does not enforce any restrictions.
 */
import { ToolConfirmationProvider } from './types.js';
import { InMemoryAllowedToolsProvider } from './allowed-tools-provider/in-memory.js';

export class NoOpConfirmationProvider implements ToolConfirmationProvider {
    public allowedToolsProvider = new InMemoryAllowedToolsProvider();

    async requestConfirmation(/* details */): Promise<boolean> {
        return true; // Always approve
    }
}
