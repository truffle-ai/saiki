import { randomUUID } from 'crypto';
import {
    ToolConfirmationProvider,
    ToolExecutionDetails,
    ToolConfirmationResponse,
} from './types.js';
import { IAllowedToolsProvider } from './allowed-tools-provider/types.js';
import { logger } from '@core/logger/logger.js';
import { AgentEventBus } from '../../events/index.js';

/**
 * Event-based tool confirmation provider that uses the official AgentEventBus
 * to emit events for confirmation requests and wait for responses.
 * This decouples the core logic from UI-specific implementations.
 */
export class EventBasedConfirmationProvider implements ToolConfirmationProvider {
    private pendingConfirmations = new Map<
        string,
        {
            resolve: (approved: boolean) => void;
            reject: (error: Error) => void;
            toolName: string;
            sessionId?: string;
        }
    >();
    private confirmationTimeout: number;
    private agentEventBus: AgentEventBus;

    constructor(
        public allowedToolsProvider: IAllowedToolsProvider,
        agentEventBus: AgentEventBus,
        options: {
            confirmationTimeout?: number;
        } = {}
    ) {
        this.agentEventBus = agentEventBus;
        this.confirmationTimeout = options.confirmationTimeout ?? 30000; // 30 seconds default

        // Listen for confirmation responses from application layers
        this.agentEventBus.on(
            'saiki:toolConfirmationResponse',
            this.handleConfirmationResponse.bind(this)
        );
    }

    async requestConfirmation(details: ToolExecutionDetails): Promise<boolean> {
        // Check if tool is in allowed list first
        const isAllowed = await this.allowedToolsProvider.isToolAllowed(
            details.toolName,
            details.sessionId
        );

        if (isAllowed) {
            logger.debug(
                `Tool '${details.toolName}' already allowed for session '${details.sessionId ?? 'global'}' – skipping confirmation.`
            );
            return true;
        }

        const executionId = randomUUID();
        const event = {
            toolName: details.toolName,
            args: details.args,
            description: details.description,
            executionId,
            timestamp: new Date(),
            sessionId: details.sessionId, // session context
        };

        logger.info(
            `Tool confirmation requested for ${details.toolName}, executionId: ${executionId}, sessionId: ${details.sessionId}`
        );

        return new Promise<boolean>((resolve, reject) => {
            // Set timeout
            const timeout = setTimeout(() => {
                // Emit synthetic denial so UI and downstream logic know it was cancelled
                const timeoutResponse: ToolConfirmationResponse = {
                    executionId,
                    approved: false,
                    rememberChoice: false,
                    ...(details.sessionId && { sessionId: details.sessionId }),
                };

                logger.warn(
                    `Tool confirmation timeout for ${details.toolName}, executionId: ${executionId}`
                );

                // Clean up pending map before emitting to avoid re-processing
                this.pendingConfirmations.delete(executionId);

                // Notify application layers – this will hit handleConfirmationResponse but
                // pending entry is already gone so it will be ignored.
                this.agentEventBus.emit('saiki:toolConfirmationResponse', timeoutResponse);

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
                ...(details.sessionId && { sessionId: details.sessionId }),
            });

            // Emit the confirmation request event via AgentEventBus
            this.agentEventBus.emit('saiki:toolConfirmationRequest', event);
        });
    }

    /**
     * Handle confirmation response from external handlers
     */
    async handleConfirmationResponse(response: ToolConfirmationResponse): Promise<void> {
        const pending = this.pendingConfirmations.get(response.executionId);
        if (!pending) {
            logger.warn(
                `Received toolConfirmationResponse for unknown executionId ${response.executionId}`
            );
            return;
        }

        // If user wants to remember this choice, add to allowed tools
        if (response.approved && response.rememberChoice) {
            await this.allowedToolsProvider.allowTool(pending.toolName, response.sessionId);
        }

        logger.info(
            `Tool confirmation ${response.approved ? 'approved' : 'denied'} for executionId ${response.executionId}, sessionId: ${response.sessionId}`
        );

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
