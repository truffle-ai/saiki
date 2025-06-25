import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import {
    ToolConfirmationProvider,
    ToolExecutionDetails,
    ToolConfirmationEvent,
    ToolConfirmationResponse,
} from './types.js';
import { IAllowedToolsProvider } from './allowed-tools-provider/types.js';
import { logger } from '@core/logger/logger.js';

/**
 * Event-based tool confirmation provider that emits events for confirmation requests
 * and waits for responses. This decouples the core logic from UI-specific implementations.
 */
export class EventBasedConfirmationProvider
    extends EventEmitter
    implements ToolConfirmationProvider
{
    private pendingConfirmations = new Map<
        string,
        {
            resolve: (approved: boolean) => void;
            reject: (error: Error) => void;
            toolName: string;
        }
    >();
    private confirmationTimeout: number;

    constructor(
        public allowedToolsProvider: IAllowedToolsProvider,
        options: {
            confirmationTimeout?: number;
        } = {}
    ) {
        super();
        this.confirmationTimeout = options.confirmationTimeout ?? 30000; // 30 seconds default
    }

    async requestConfirmation(details: ToolExecutionDetails): Promise<boolean> {
        // Check if tool is in allowed list first
        const isAllowed = await this.allowedToolsProvider.isToolAllowed(details.toolName);
        if (isAllowed) {
            return true;
        }

        const executionId = randomUUID();
        const event: ToolConfirmationEvent = {
            toolName: details.toolName,
            args: details.args,
            description: details.description,
            executionId,
            timestamp: new Date(),
        };

        logger.info(
            `Tool confirmation requested for ${details.toolName}, executionId: ${executionId}`
        );

        return new Promise<boolean>((resolve, reject) => {
            // Set timeout
            const timeout = setTimeout(() => {
                this.pendingConfirmations.delete(executionId);
                reject(new Error(`Tool confirmation timeout for ${details.toolName}`));
            }, this.confirmationTimeout);

            // Store the promise resolvers with cleanup
            this.pendingConfirmations.set(executionId, {
                resolve: (approved: boolean) => {
                    clearTimeout(timeout);
                    this.pendingConfirmations.delete(executionId);
                    resolve(approved);
                },
                reject: (error: Error) => {
                    clearTimeout(timeout);
                    this.pendingConfirmations.delete(executionId);
                    reject(error);
                },
                toolName: details.toolName,
            });

            // Emit the confirmation request event
            this.emit('toolConfirmationRequest', event);
        });
    }

    /**
     * Handle confirmation response from external handlers
     */
    async handleConfirmationResponse(response: ToolConfirmationResponse): Promise<void> {
        const pending = this.pendingConfirmations.get(response.executionId);
        if (!pending) {
            // Response for unknown or expired confirmation request
            return;
        }

        // If user wants to remember this choice, add to allowed tools
        if (response.approved && response.rememberChoice) {
            await this.allowedToolsProvider.allowTool(pending.toolName);
        }

        pending.resolve(response.approved);
    }

    /**
     * Get list of pending confirmation requests
     */
    getPendingConfirmations(): string[] {
        return Array.from(this.pendingConfirmations.keys());
    }

    /**
     * Cancel a pending confirmation request
     */
    cancelConfirmation(executionId: string): void {
        const pending = this.pendingConfirmations.get(executionId);
        if (pending) {
            pending.reject(new Error('Confirmation request cancelled'));
            this.pendingConfirmations.delete(executionId);
        }
    }

    /**
     * Cancel all pending confirmation requests
     */
    cancelAllConfirmations(): void {
        for (const [_executionId, pending] of this.pendingConfirmations) {
            pending.reject(new Error('All confirmation requests cancelled'));
        }
        this.pendingConfirmations.clear();
    }
}
