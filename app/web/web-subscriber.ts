import { WebSocket } from 'ws';

/**
 * Wrapper class to store methods describing how the WebUI should handle agent events
 *
 * Minimum expected event handler methods (for LLMService events)
 *   - onThinking(): void
 *   - onChunk(text: string): void
 *   - onToolCall(toolName: string, args: any): void
 *   - onToolResult(toolName: string, result: any): void
 *   - onResponse(text: string): void
 *   - onError(error: Error): void
 *   - onConversationReset(): void
 */
export class WebUISubscriber {
    private connections: Set<WebSocket> = new Set();

    addConnection(ws: WebSocket): void {
        this.connections.add(ws);
        ws.on('close', () => this.connections.delete(ws));
        // Send initial state or confirmation if needed
        // ws.send(JSON.stringify({ event: 'connected' }));
    }

    private broadcast(eventType: string, data: any): void {
        const message = JSON.stringify({ event: eventType, data });
        this.connections.forEach((client) => {
            // Check readyState before sending
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            } else {
                // Optional: Clean up closed connections proactively
                this.connections.delete(client);
            }
        });
    }

    onThinking(): void {
        this.broadcast('thinking', null);
    }

    onChunk(text: string): void {
        this.broadcast('chunk', { text });
    }

    onToolCall(toolName: string, args: any): void {
        this.broadcast('toolCall', { toolName, args });
    }

    onToolResult(toolName: string, result: any): void {
        this.broadcast('toolResult', { toolName, result });
    }

    onResponse(text: string): void {
        this.broadcast('response', { text });
    }

    onError(error: Error): void {
        this.broadcast('error', { message: error.message });
    }

    onConversationReset(): void {
        this.broadcast('conversationReset', null);
    }
}
