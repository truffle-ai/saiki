import { IAllowedToolsProvider } from './allowed-tools-provider/types.js';

/**
 * Interface to get tool confirmation and manage allowed tools
 */
export interface ToolConfirmationProvider {
    allowedToolsProvider: IAllowedToolsProvider;
    requestConfirmation(
        details: ToolExecutionDetails,
        userId?: string,
        callbacks?: {
            displayDetails?: (details: ToolExecutionDetails) => void;
            collectInput?: () => Promise<string | boolean>;
            parseResponse?: (response: any) => boolean;
        }
    ): Promise<boolean>;
}

/**
 * Interface for current tool being executed
 */
export interface ToolExecutionDetails {
    toolName: string;
    args: any;
    description?: string;
}
