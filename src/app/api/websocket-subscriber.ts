import { WebSocketServer, WebSocket } from 'ws';
import { AgentEventBus } from '@core/events/index.js';
import { logger } from '@core/index.js';
import { EventSubscriber } from './types.js';

/**
 * WebSocket event subscriber that broadcasts agent events to connected clients
 */
export class WebSocketEventSubscriber implements EventSubscriber {
    private connections: Set<WebSocket> = new Set();

    constructor(private wss: WebSocketServer) {
        // Track new connections
        this.wss.on('connection', (ws: WebSocket) => {
            logger.debug('New WebSocket client connected');
            this.connections.add(ws);
            ws.on('close', () => this.connections.delete(ws));
        });
    }

    /**
     * Subscribe to agent events and broadcast them to WebSocket clients
     */
    subscribe(eventBus: AgentEventBus): void {
        // Subscribe to all relevant events
        eventBus.on('llmservice:thinking', (payload) => {
            this.broadcast({
                event: 'thinking',
                data: {
                    sessionId: payload?.sessionId,
                },
            });
        });

        eventBus.on('llmservice:chunk', (payload) => {
            this.broadcast({
                event: 'chunk',
                data: {
                    text: payload.content,
                    isComplete: payload.isComplete,
                    sessionId: payload.sessionId,
                },
            });
        });

        eventBus.on('llmservice:toolCall', (payload) => {
            this.broadcast({
                event: 'toolCall',
                data: {
                    toolName: payload.toolName,
                    args: payload.args,
                    callId: payload.callId,
                    sessionId: payload.sessionId,
                },
            });
        });

        eventBus.on('llmservice:toolResult', (payload) => {
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
        });

        eventBus.on('llmservice:response', (payload) => {
            this.broadcast({
                event: 'response',
                data: {
                    text: payload.content,
                    tokenCount: payload.tokenCount,
                    model: payload.model,
                    sessionId: payload.sessionId,
                },
            });
        });

        eventBus.on('llmservice:error', (payload) => {
            this.broadcast({
                event: 'error',
                data: {
                    message: payload.error.message,
                    context: payload.context,
                    recoverable: payload.recoverable,
                    sessionId: payload.sessionId,
                },
            });
        });

        eventBus.on('messageManager:conversationReset', (payload) => {
            this.broadcast({
                event: 'conversationReset',
                data: {
                    sessionId: payload?.sessionId,
                },
            });
        });

        eventBus.on('saiki:conversationReset', (payload) => {
            this.broadcast({
                event: 'saikiConversationReset',
                data: {
                    sessionId: payload.sessionId,
                },
            });
        });

        eventBus.on('saiki:mcpServerConnected', (payload) => {
            this.broadcast({
                event: 'mcpServerConnected',
                data: {
                    name: payload.name,
                    success: payload.success,
                    error: payload.error,
                    sessionId: payload?.sessionId,
                },
            });
        });

        eventBus.on('saiki:availableToolsUpdated', (payload) => {
            this.broadcast({
                event: 'availableToolsUpdated',
                data: {
                    tools: payload.tools,
                    source: payload.source,
                    sessionId: payload?.sessionId,
                },
            });
        });
    }

    private broadcast(event: any): void {
        const message = JSON.stringify(event);
        for (const client of this.connections) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            } else {
                this.connections.delete(client);
            }
        }
    }
}
