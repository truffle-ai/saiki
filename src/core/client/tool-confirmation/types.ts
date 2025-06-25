import { IAllowedToolsProvider } from './allowed-tools-provider/types.js';

/**
 * Event emitted when tool confirmation is requested
 */
export interface ToolConfirmationEvent {
    toolName: string;
    args: any;
    description?: string | undefined;
    executionId: string;
    timestamp: Date;
    sessionId?: string;
}

/**
 * Response to tool confirmation request
 */
export interface ToolConfirmationResponse {
    executionId: string;
    approved: boolean;
    rememberChoice?: boolean;
    /**
     * Optional session identifier to scope the approval. When provided, a
     * "remembered" approval is stored only for this session by the
     * AllowedToolsProvider implementation.
     */
    sessionId?: string;
}

/**
 * Interface to get tool confirmation and manage allowed tools
 */
export interface ToolConfirmationProvider {
    allowedToolsProvider: IAllowedToolsProvider;
    requestConfirmation(
        details: ToolExecutionDetails,
        callbacks?: {
            displayDetails?: (details: ToolExecutionDetails) => void;
            collectInput?: () => Promise<string | boolean>;
            parseResponse?: (response: any) => boolean;
        }
    ): Promise<boolean>;

    // Only implemented by event-based providers – kept here for convenience
    handleConfirmationResponse?(response: ToolConfirmationResponse): Promise<void>;
}

/**
 * Interface for current tool being executed
 */
export interface ToolExecutionDetails {
    toolName: string;
    args: any;
    description?: string;
    sessionId?: string;
}
