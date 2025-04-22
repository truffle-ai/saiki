/**
 * Interface to store allowed tools and get user confirmation
 */
export interface UserConfirmationProvider {
    allowedTools: Set<string>,
    requestConfirmation(
        details: ToolExecutionDetails,
        userId?: string,
        callbacks?: {
            displayDetails?: (details: ToolExecutionDetails) => void;
            collectInput?: () => Promise<string | boolean>;
            parseResponse?: (response: any) => boolean;
        },
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
