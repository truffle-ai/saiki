import { ToolConfirmationProvider, ToolExecutionDetails } from './types.js';
import { logger } from '../../logger/index.js';
import * as readline from 'readline';
import chalk from 'chalk';
import { InMemorySettingsProvider } from '../../settings/in-memory-provider.js';
import { SettingsProvider } from '../../settings/types.js';
import boxen from 'boxen';
import { IAllowedToolsProvider } from './allowed-tools-provider/types.js';
import { InMemoryAllowedToolsProvider } from './allowed-tools-provider/in-memory.js';

/**
 * CLI implementation of ToolConfirmationProvider
 * Automatically approves tools in the allowedTools set,
 * and prompts for confirmation for other tools using logger's styling
 */
export class CLIConfirmationProvider implements ToolConfirmationProvider {
    public allowedToolsProvider: IAllowedToolsProvider;
    private rl: readline.Interface | null = null;
    public settingsProvider: SettingsProvider;

    constructor(allowedToolsProvider?: IAllowedToolsProvider, settingsProvider?: SettingsProvider) {
        this.allowedToolsProvider = allowedToolsProvider ?? new InMemoryAllowedToolsProvider();
        this.settingsProvider = settingsProvider ?? new InMemorySettingsProvider();
    }

    /**
     * Request confirmation for executing a tool
     * @param toolDetails Details about the tool execution
     * @param userId (Optional) The user ID for whom to request confirmation. If not provided, a default user ID will be used.
     * @param callbacks (Optional) callbacks for customizing the confirmation flow
     * @returns Promise resolving to boolean indicating if execution is approved
     * TODO: Use the callbacks or change to event-driven approach
     */
    async requestConfirmation(
        toolDetails: ToolExecutionDetails,
        userId?: string,
        callbacks?: {
            displayDetails?: (details: ToolExecutionDetails) => void;
            collectInput?: () => Promise<string | boolean>;
            parseResponse?: (response: any) => boolean;
        }
    ): Promise<boolean> {
        // Use a default userId if not provided
        const effectiveUserId = userId ?? 'default';
        // Get user settings and check if tool approval is required
        const userSettings = await this.settingsProvider.getUserSettings(effectiveUserId);
        if (userSettings.toolApprovalRequired === false) {
            logger.debug(`Tool '${toolDetails.toolName}' execution is automatically approved`);
            return true;
        }
        // If the tool is in the allowed list, automatically approve
        if (await this.allowedToolsProvider.isToolAllowed(toolDetails.toolName, effectiveUserId)) {
            logger.debug(`Tool '${toolDetails.toolName}' is pre-approved for execution`);
            return true;
        }

        // Display tool call using the logger's built-in method
        logger.toolCall(toolDetails.toolName, toolDetails.args);

        // Collect user input with arrow key navigation
        const choice = await this.collectArrowKeyInput();

        // Add an approved tool to the list
        if (choice) {
            await this.allowedToolsProvider.allowTool(toolDetails.toolName, effectiveUserId);
        } else {
            logger.warn(`Tool '${toolDetails.toolName}' execution denied`);
        }

        return choice;
    }

    /**
     * TODO: Refactor this implementation to be more generic
     * @returns Promise resolving to boolean (true for approve, false for deny)
     */
    private collectArrowKeyInput(): Promise<boolean> {
        return new Promise((resolve) => {
            // Configure readline for raw input
            readline.emitKeypressEvents(process.stdin);
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
            }

            // Set initial selection (default to No/Deny for safety)
            let selection = false;

            // Display confirmation options
            console.log(
                boxen(
                    `${chalk.cyan('Confirm execution of this tool?')}\n\n` +
                        `Use ${chalk.yellow('←/→')} arrow keys to select, ${chalk.yellow('Enter')} to confirm`,
                    {
                        padding: 1,
                        borderColor: 'yellow',
                        title: '🔐 Tool Confirmation',
                        titleAlignment: 'center',
                    }
                )
            );

            // Initial render of options
            this.renderSelection(selection);

            // Handle keypress events
            const keypressHandler = (str: string, key: readline.Key) => {
                // Handle left/right arrow keys
                if (key.name === 'left') {
                    selection = true; // Left = Approve
                    this.renderSelection(selection);
                } else if (key.name === 'right') {
                    selection = false; // Right = Deny
                    this.renderSelection(selection);
                }
                // Handle Enter key to confirm selection
                else if (key.name === 'return') {
                    // Clean up
                    process.stdin.removeListener('keypress', keypressHandler);
                    if (process.stdin.isTTY) {
                        process.stdin.setRawMode(false);
                    }

                    // Display confirmation result
                    console.log(
                        boxen(
                            selection
                                ? chalk.green('Tool execution approved')
                                : chalk.red('Tool execution denied'),
                            {
                                padding: 1,
                                borderColor: selection ? 'green' : 'red',
                                title: selection ? '✅ Approved' : '❌ Denied',
                                titleAlignment: 'center',
                            }
                        )
                    );

                    // Resolve with selection
                    resolve(selection);
                }
                // Handle Ctrl+C to abort
                else if (key.ctrl && key.name === 'c') {
                    // Clean up
                    process.stdin.removeListener('keypress', keypressHandler);
                    if (process.stdin.isTTY) {
                        process.stdin.setRawMode(false);
                    }

                    console.log(
                        boxen(chalk.red('Tool execution aborted'), {
                            padding: 1,
                            borderColor: 'red',
                            title: '❌ Aborted',
                            titleAlignment: 'center',
                        })
                    );

                    // Resolve with false (deny)
                    resolve(false);
                }
            };

            // Register keypress handler
            process.stdin.on('keypress', keypressHandler);
        });
    }

    /**
     * Render the current selection state with a horizontal layout
     * @param selection Current selection (true = approve, false = deny)
     */
    private renderSelection(selection: boolean): void {
        // Clear previous line
        process.stdout.write('\r\x1b[K');
        // Render current selection with horizontal layout
        if (selection) {
            process.stdout.write(
                `${chalk.green('▶')}${chalk.green.bold('Approve')}   ${chalk.gray('Deny')}`
            );
        } else {
            process.stdout.write(
                ` ${chalk.gray('Approve')}  ${chalk.red('▶')}${chalk.red.bold('Deny')}`
            );
        }
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
