import { WebSocketServer, WebSocket } from 'ws';
import { EventSubscriber } from './types.js';
import { TypedEventEmitter, EventMap } from '@core/events/index.js';

/**
 * Subscribes to core events and broadcasts them over all open WebSocket connections.
 */
export class WebSocketEventSubscriber implements EventSubscriber {
    private connections: Set<WebSocket> = new Set();

    constructor(private wss: WebSocketServer) {
        // Track new connections
        this.wss.on('connection', (ws: WebSocket) => {
            this.connections.add(ws);
            ws.on('close', () => this.connections.delete(ws));
        });
    }

    subscribe(eventBus: TypedEventEmitter): void {
        eventBus.on('llmservice:thinking', () => this.broadcast('thinking', null));
        eventBus.on('llmservice:chunk', (payload) =>
            this.broadcast('chunk', { text: payload.content })
        );
        eventBus.on('llmservice:toolCall', (payload) =>
            this.broadcast('toolCall', { toolName: payload.toolName, args: payload.args })
        );
        eventBus.on('llmservice:toolResult', (payload) =>
            this.broadcast('toolResult', { toolName: payload.toolName, result: payload.result })
        );
        eventBus.on('llmservice:response', (payload) =>
            this.broadcast('response', { text: payload.content })
        );
        eventBus.on('llmservice:error', (payload) =>
            this.broadcast('error', { message: payload.error.message })
        );
        eventBus.on('messageManager:conversationReset', () =>
            this.broadcast('conversationReset', null)
        );
    }

    private broadcast(eventType: string, data: any): void {
        const message = JSON.stringify({ event: eventType, data });
        for (const client of this.connections) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            } else {
                this.connections.delete(client);
            }
        }
    }
}
