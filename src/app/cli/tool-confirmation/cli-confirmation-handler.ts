import { logger } from '../../../core/logger/index.js';
import * as readline from 'readline';
import chalk from 'chalk';
import { InMemorySettingsProvider } from '../../../core/settings/in-memory-provider.js';
import { SettingsProvider } from '../../../core/settings/types.js';
import boxen from 'boxen';
import {
    ToolConfirmationEvent,
    ToolConfirmationResponse,
} from '../../../core/client/tool-confirmation/types.js';
import { AgentEventBus } from '../../../core/events/index.js';
import { EventSubscriber } from '../../api/types.js';

/**
 * CLI-specific subscriber for tool confirmation events
 * Implements EventSubscriber pattern to listen to AgentEventBus for tool confirmation requests
 */
export class CLIToolConfirmationSubscriber implements EventSubscriber {
    private settingsProvider: SettingsProvider;
    private agentEventBus?: AgentEventBus;

    constructor(settingsProvider?: SettingsProvider) {
        this.settingsProvider = settingsProvider ?? new InMemorySettingsProvider();

        // Ensure tool approval is required by default in CLI
        void this.settingsProvider.updateUserSettings('default', { toolApprovalRequired: true });
    }

    /**
     * Subscribe to tool confirmation events on the AgentEventBus
     */
    subscribe(eventBus: AgentEventBus): void {
        this.agentEventBus = eventBus;
        this.agentEventBus.on(
            'saiki:toolConfirmationRequest',
            this.handleConfirmationRequest.bind(this)
        );
    }

    /**
     * Handle tool confirmation request events from the AgentEventBus
     */
    private async handleConfirmationRequest(event: ToolConfirmationEvent): Promise<void> {
        try {
            // Check user settings first
            logger.info(
                `Handling tool confirmation request for ${event.toolName}, executionId: ${event.executionId}`
            );
            const userSettings = await this.settingsProvider.getUserSettings('default');

            if (userSettings.toolApprovalRequired === false) {
                logger.debug(
                    `Tool '${event.toolName}' execution is automatically approved by settings`
                );
                this.sendConfirmationResponse({
                    executionId: event.executionId,
                    approved: true,
                });
                return;
            }

            // Display tool call using the logger's built-in method
            logger.toolCall(event.toolName, event.args);

            // Collect user input with arrow key navigation
            const approved = await this.collectArrowKeyInput();

            // Send response back via AgentEventBus
            const response: ToolConfirmationResponse = {
                executionId: event.executionId,
                approved,
                rememberChoice: false, // Don't auto-remember approved tools for CLI
            };

            this.sendConfirmationResponse(response);

            if (!approved) {
                logger.warn(`Tool '${event.toolName}' execution denied`);
            }
        } catch (error) {
            logger.error(`Error handling tool confirmation request: ${error}`);
            // Send denial response on error
            this.sendConfirmationResponse({
                executionId: event.executionId,
                approved: false,
            });
        }
    }

    /**
     * Send confirmation response via AgentEventBus
     */
    private sendConfirmationResponse(response: ToolConfirmationResponse): void {
        if (!this.agentEventBus) {
            logger.error('AgentEventBus not available for sending confirmation response');
            return;
        }
        this.agentEventBus.emit('saiki:toolConfirmationResponse', response);
    }

    /**
     * Collect user input with arrow key navigation
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
     * Cleanup event listeners and resources
     */
    cleanup(): void {
        if (this.agentEventBus) {
            this.agentEventBus.removeAllListeners('saiki:toolConfirmationRequest');
        }
    }
}
