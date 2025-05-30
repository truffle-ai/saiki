import { WebSocketServer, WebSocket } from 'ws';
import { AgentEventBus } from '@core/events/index.js';
import { logger } from '@core/index.js';
import { EventSubscriber } from './types.js';

/**
 * WebSocket event subscriber that broadcasts agent events to connected clients
 */
export class WebSocketEventSubscriber implements EventSubscriber {
    private connections: Set<WebSocket> = new Set();
    private abortController?: AbortController;

    constructor(private wss: WebSocketServer) {
        // Track new connections
        this.wss.on('connection', (ws: WebSocket) => {
            logger.debug('New WebSocket client connected');
            this.connections.add(ws);

            // Add error handling for individual connections
            ws.on('error', (error) => {
                logger.error('WebSocket client error:', error);
                this.connections.delete(ws);
            });

            ws.on('close', () => {
                logger.debug('WebSocket client disconnected');
                this.connections.delete(ws);
            });
        });
    }

    /**
     * Subscribe to agent events and broadcast them to WebSocket clients
     */
    subscribe(eventBus: AgentEventBus): void {
        // Create new AbortController for this subscription
        this.abortController = new AbortController();
        const { signal } = this.abortController;

        // Subscribe to all relevant events with abort signal
        eventBus.on(
            'llmservice:thinking',
            (payload) => {
                this.broadcast({
                    event: 'thinking',
                    data: {
                        sessionId: payload.sessionId,
                    },
                });
            },
            { signal }
        );

        eventBus.on(
            'llmservice:chunk',
            (payload) => {
                this.broadcast({
                    event: 'chunk',
                    data: {
                        text: payload.content,
                        isComplete: payload.isComplete,
                        sessionId: payload.sessionId,
                    },
                });
            },
            { signal }
        );

        eventBus.on(
            'llmservice:toolCall',
            (payload) => {
                this.broadcast({
                    event: 'toolCall',
                    data: {
                        toolName: payload.toolName,
                        args: payload.args,
                        callId: payload.callId,
                        sessionId: payload.sessionId,
                    },
                });
            },
            { signal }
        );

        eventBus.on(
            'llmservice:toolResult',
            (payload) => {
                this.broadcast({
                    event: 'toolResult',
                    data: {
                        toolName: payload.toolName,
                        result: payload.result,
                        callId: payload.callId,
                        success: payload.success,
                        sessionId: payload.sessionId,
                    },
                });
            },
            { signal }
        );

        eventBus.on(
            'llmservice:response',
            (payload) => {
                this.broadcast({
                    event: 'response',
                    data: {
                        text: payload.content,
                        tokenCount: payload.tokenCount,
                        model: payload.model,
                        sessionId: payload.sessionId,
                    },
                });
            },
            { signal }
        );

        eventBus.on(
            'llmservice:error',
            (payload) => {
                this.broadcast({
                    event: 'error',
                    data: {
                        message: payload.error.message,
                        context: payload.context,
                        recoverable: payload.recoverable,
                        sessionId: payload.sessionId,
                    },
                });
            },
            { signal }
        );

        // Consolidated conversation reset handler - messageManager:conversationReset has been
        // eliminated in favor of saiki:conversationReset as the single source of truth.
        eventBus.on(
            'saiki:conversationReset',
            (payload) => {
                this.broadcast({
                    event: 'conversationReset',
                    data: {
                        sessionId: payload.sessionId,
                    },
                });
            },
            { signal }
        );

        eventBus.on(
            'saiki:mcpServerConnected',
            (payload) => {
                this.broadcast({
                    event: 'mcpServerConnected',
                    data: {
                        name: payload.name,
                        success: payload.success,
                        error: payload.error,
                        sessionId: payload.sessionId,
                    },
                });
            },
            { signal }
        );

        eventBus.on(
            'saiki:availableToolsUpdated',
            (payload) => {
                this.broadcast({
                    event: 'availableToolsUpdated',
                    data: {
                        tools: payload.tools,
                        source: payload.source,
                        sessionId: payload.sessionId,
                    },
                });
            },
            { signal }
        );
    }

    /**
     * Clean up event listeners and connections
     */
    cleanup(): void {
        // Abort all event listeners at once
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = undefined;
        }

        // Close all WebSocket connections
        for (const client of this.connections) {
            if (client.readyState === WebSocket.OPEN) {
                client.close();
            }
        }
        this.connections.clear();

        logger.debug('WebSocket event subscriber cleaned up');
    }

    private broadcast(message: { event: string; data?: Record<string, any> }): void {
        try {
            const messageString = JSON.stringify(message);
            const deadConnections: WebSocket[] = [];

            for (const client of this.connections) {
                try {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(messageString);
                    } else {
                        deadConnections.push(client);
                    }
                } catch (error) {
                    logger.error('Failed to send message to WebSocket client:', error);
                    deadConnections.push(client);
                }
            }

            // Clean up dead connections
            for (const deadClient of deadConnections) {
                this.connections.delete(deadClient);
            }
        } catch (error) {
            logger.error('Failed to broadcast WebSocket message:', error);
        }
    }
}
