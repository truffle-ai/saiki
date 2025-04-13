import { AgentSubscriber } from '../../src/ai/llm/events/types.js';
import { WebSocket } from 'ws';

export class WebUISubscriber implements AgentSubscriber {
  private connections: Set<WebSocket> = new Set();

  addConnection(ws: WebSocket): void {
    this.connections.add(ws);
    ws.on('close', () => this.connections.delete(ws));
    // Send initial state or confirmation if needed
    // ws.send(JSON.stringify({ event: 'connected' })); 
  }

  private broadcast(eventType: string, data: any): void {
    const message = JSON.stringify({ event: eventType, data });
    this.connections.forEach(client => {
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