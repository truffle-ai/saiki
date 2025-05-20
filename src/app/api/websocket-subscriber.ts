import { EventEmitter } from 'events';
import { WebSocketServer, WebSocket } from 'ws';
import { EventSubscriber } from './types.js';

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

    subscribe(eventBus: EventEmitter): void {
        eventBus.on('llmservice:thinking', () => this.broadcast('thinking', null));
        eventBus.on('llmservice:chunk', (text: string) => this.broadcast('chunk', { text }));
        eventBus.on('llmservice:toolCall', (toolName: string, args: any) =>
            this.broadcast('toolCall', { toolName, args })
        );
        eventBus.on('llmservice:toolResult', (toolName: string, result: any) =>
            this.broadcast('toolResult', { toolName, result })
        );
        eventBus.on('llmservice:response', (text: string) => this.broadcast('response', { text }));
        eventBus.on('llmservice:error', (error: Error) =>
            this.broadcast('error', { message: error.message })
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
