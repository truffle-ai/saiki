/**
 * NoOpConfirmationProvider
 *
 * A ToolConfirmationProvider implementation that always approves or denies tool execution.
 * Used as a fallback for environments where confirmation is not implemented or for
 * security scenarios where tools should be automatically denied.
 *
 * Uses InMemoryAllowedToolsProvider to satisfy the interface, but does not enforce any restrictions
 * when in auto-approve mode.
 */
import { ToolConfirmationProvider } from './types.js';
import { IAllowedToolsProvider } from './allowed-tools-provider/types.js';
import { InMemoryAllowedToolsProvider } from './allowed-tools-provider/in-memory.js';

export class NoOpConfirmationProvider implements ToolConfirmationProvider {
    public allowedToolsProvider: IAllowedToolsProvider;
    private autoApprove: boolean;

    constructor(allowedToolsProvider?: IAllowedToolsProvider, autoApprove: boolean = true) {
        this.allowedToolsProvider = allowedToolsProvider ?? new InMemoryAllowedToolsProvider();
        this.autoApprove = autoApprove;
    }

    async requestConfirmation(/* details */): Promise<boolean> {
        return this.autoApprove; // Always approve or deny based on configuration
    }
}
