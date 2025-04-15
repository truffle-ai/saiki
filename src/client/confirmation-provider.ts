import { UserConfirmationProvider, ToolExecutionDetails } from './types.js';
import { logger } from '../utils/logger.js';
import * as readline from 'readline';

/**
 * Default implementation of UserConfirmationProvider
 * Automatically approves tools in the allowedTools set,
 * and prompts for confirmation for other tools
 */
export class DefaultConfirmationProvider implements UserConfirmationProvider {
    private allowedTools: Set<string>;
    private rl: readline.Interface | null = null;

    constructor(allowedTools: Set<string>) {
        this.allowedTools = allowedTools;
    }

    /**
     * Request confirmation for executing a tool
     * @param details Details about the tool execution
     * @param callbacks Optional callbacks for customizing the confirmation flow
     * @returns Promise resolving to boolean indicating if execution is approved
     */
    async requestConfirmation(
        details: ToolExecutionDetails,
        callbacks?: {
            displayDetails?: (details: ToolExecutionDetails) => void;
            collectInput?: () => Promise<string | boolean>;
            parseResponse?: (response: any) => boolean;
        }
    ): Promise<boolean> {
        // If the tool is in the allowed list, automatically approve
        if (this.allowedTools.has(details.toolName)) {
            logger.debug(`Tool '${details.toolName}' is pre-approved for execution`);
            return true;
        }

        // Use provided callbacks or default implementations
        const displayDetails = callbacks?.displayDetails || this.defaultDisplayDetails;
        const collectInput = callbacks?.collectInput || this.defaultCollectInput.bind(this);
        const parseResponse = callbacks?.parseResponse || this.defaultParseResponse;

        // Display tool execution details
        displayDetails(details);

        // Collect user input
        const response = await collectInput();

        // Parse the response to determine if execution is approved
        return parseResponse(response);
    }

    /**
     * Default implementation for displaying tool execution details
     */
    private defaultDisplayDetails(details: ToolExecutionDetails): void {
        logger.info('=== Tool Execution Confirmation ===');
        logger.info(`Tool: ${details.toolName}`);
        if (details.description) {
            logger.info(`Description: ${details.description}`);
        }
        logger.info(`Arguments: ${JSON.stringify(details.args, null, 2)}`);
        logger.info('Do you want to allow this tool execution? (y/n)');
    }

    /**
     * Default implementation for collecting user input
     */
    private async defaultCollectInput(): Promise<string> {
        // Create readline interface if it doesn't exist
        if (!this.rl) {
            this.rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
        }

        return new Promise<string>((resolve) => {
            this.rl!.question('> ', (answer) => {
                resolve(answer.trim().toLowerCase());
            });
        });
    }

    /**
     * Default implementation for parsing user response
     */
    private defaultParseResponse(response: string | boolean): boolean {
        if (typeof response === 'boolean') {
            return response;
        }
        return response === 'y' || response === 'yes';
    }

    /**
     * Close the readline interface if it's open
     */
    close(): void {
        if (this.rl) {
            this.rl.close();
            this.rl = null;
        }
    }
}
