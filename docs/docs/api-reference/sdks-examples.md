---
sidebar_position: 5
---

# SDKs & Examples

Practical code examples and SDKs for integrating Saiki API into your applications. Choose your preferred language and integration pattern.

## JavaScript/TypeScript SDK

### Simple REST Client

```typescript
class SaikiClient {
  constructor(private baseUrl = 'http://localhost:3001/api') {}
  
  async sendMessage(message: string, imageData?: { base64: string; mimeType: string }) {
    const response = await fetch(`${this.baseUrl}/message-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, imageData })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async resetConversation() {
    const response = await fetch(`${this.baseUrl}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getServers() {
    const response = await fetch(`${this.baseUrl}/mcp/servers`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async connectServer(name: string, config: any) {
    const response = await fetch(`${this.baseUrl}/connect-server`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, config })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async executeTool(serverId: string, toolName: string, args: any) {
    const response = await fetch(
      `${this.baseUrl}/mcp/servers/${serverId}/tools/${toolName}/execute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }
}

// Usage
const client = new SaikiClient();

// Send a message
const response = await client.sendMessage("What's in this directory?");
console.log(response.response);

// Execute a tool directly
const fileContent = await client.executeTool('filesystem', 'readFile', {
  path: './README.md'
});
console.log(fileContent.data.content);
```

### Complete WebSocket SDK

```typescript
interface SaikiWebSocketConfig {
  url?: string;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  messageTimeout?: number;
}

interface SaikiMessage {
  type: 'message' | 'reset';
  content?: string;
  imageData?: {
    base64: string;
    mimeType: string;
  };
}

interface SaikiEvent {
  event: 'thinking' | 'chunk' | 'toolCall' | 'toolResult' | 'response' | 'error';
  data: any;
}

class SaikiWebSocketSDK extends EventTarget {
  private ws: WebSocket | null = null;
  private config: Required<SaikiWebSocketConfig>;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  constructor(config: SaikiWebSocketConfig = {}) {
    super();
    
    this.config = {
      url: 'ws://localhost:3001/',
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      messageTimeout: 30000,
      ...config
    };
  }
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.url);
      
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.dispatchEvent(new CustomEvent('connected'));
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data: SaikiEvent = JSON.parse(event.data);
          this.dispatchEvent(new CustomEvent(data.event, { detail: data.data }));
        } catch (error) {
          this.dispatchEvent(new CustomEvent('error', { 
            detail: { message: 'Failed to parse message', error } 
          }));
        }
      };
      
      this.ws.onclose = () => {
        this.dispatchEvent(new CustomEvent('disconnected'));
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        this.dispatchEvent(new CustomEvent('error', { detail: error }));
        reject(error);
      };
    });
  }
  
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  sendMessage(content: string, imageData?: { base64: string; mimeType: string }): void {
    this.send({
      type: 'message',
      content,
      imageData
    });
  }
  
  resetConversation(): void {
    this.send({ type: 'reset' });
  }
  
  async sendAndWaitForResponse(
    content: string, 
    imageData?: { base64: string; mimeType: string }
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let response = '';
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Message timeout'));
      }, this.config.messageTimeout);
      
      const cleanup = () => {
        clearTimeout(timeout);
        this.removeEventListener('chunk', onChunk);
        this.removeEventListener('response', onResponse);
        this.removeEventListener('error', onError);
      };
      
      const onChunk = (event: any) => {
        response += event.detail.content;
      };
      
      const onResponse = (event: any) => {
        cleanup();
        resolve(response || event.detail.content);
      };
      
      const onError = (event: any) => {
        cleanup();
        reject(new Error(event.detail.message || 'Unknown error'));
      };
      
      this.addEventListener('chunk', onChunk);
      this.addEventListener('response', onResponse);
      this.addEventListener('error', onError);
      
      this.sendMessage(content, imageData);
    });
  }
  
  private send(message: SaikiMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }
    
    this.ws.send(JSON.stringify(message));
  }
  
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.dispatchEvent(new CustomEvent('reconnectFailed'));
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Will trigger another reconnect attempt
      });
    }, delay);
  }
}

// Usage
const sdk = new SaikiWebSocketSDK();

sdk.addEventListener('connected', () => {
  console.log('Connected to Saiki');
});

sdk.addEventListener('thinking', () => {
  console.log('Agent is thinking...');
});

sdk.addEventListener('chunk', (event: any) => {
  process.stdout.write(event.detail.content);
});

sdk.addEventListener('response', (event: any) => {
  console.log('\nFinal response received');
});

await sdk.connect();

// Send message and wait for response
const response = await sdk.sendAndWaitForResponse("What files are in this directory?");
console.log('Response:', response);
```

## Python Client

```python
import asyncio
import json
import websockets
import aiohttp
from typing import Optional, Dict, Any, Callable

class SaikiClient:
    def __init__(self, base_url: str = "http://localhost:3001/api"):
        self.base_url = base_url
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def send_message(self, message: str, image_data: Optional[Dict] = None):
        payload = {"message": message}
        if image_data:
            payload["imageData"] = image_data
        
        async with self.session.post(
            f"{self.base_url}/message-sync",
            json=payload
        ) as response:
            response.raise_for_status()
            return await response.json()
    
    async def reset_conversation(self):
        async with self.session.post(f"{self.base_url}/reset") as response:
            response.raise_for_status()
            return await response.json()
    
    async def get_servers(self):
        async with self.session.get(f"{self.base_url}/mcp/servers") as response:
            response.raise_for_status()
            return await response.json()
    
    async def execute_tool(self, server_id: str, tool_name: str, args: Dict[str, Any]):
        url = f"{self.base_url}/mcp/servers/{server_id}/tools/{tool_name}/execute"
        async with self.session.post(url, json=args) as response:
            response.raise_for_status()
            return await response.json()

class SaikiWebSocketClient:
    def __init__(self, url: str = "ws://localhost:3001/"):
        self.url = url
        self.websocket = None
        self.event_handlers = {}
    
    def on(self, event: str, handler: Callable):
        if event not in self.event_handlers:
            self.event_handlers[event] = []
        self.event_handlers[event].append(handler)
    
    def emit(self, event: str, data: Any = None):
        if event in self.event_handlers:
            for handler in self.event_handlers[event]:
                try:
                    handler(data)
                except Exception as e:
                    print(f"Error in event handler: {e}")
    
    async def connect(self):
        self.websocket = await websockets.connect(self.url)
        self.emit('connected')
        
        # Start listening for messages
        asyncio.create_task(self._listen())
    
    async def disconnect(self):
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
            self.emit('disconnected')
    
    async def send_message(self, content: str, image_data: Optional[Dict] = None):
        message = {
            "type": "message",
            "content": content
        }
        if image_data:
            message["imageData"] = image_data
        
        await self.websocket.send(json.dumps(message))
    
    async def reset_conversation(self):
        await self.websocket.send(json.dumps({"type": "reset"}))
    
    async def send_and_wait_for_response(self, content: str, image_data: Optional[Dict] = None):
        response = ""
        response_complete = asyncio.Event()
        
        def on_chunk(data):
            nonlocal response
            response += data.get('content', '')
        
        def on_response(data):
            nonlocal response
            if not response:
                response = data.get('content', '')
            response_complete.set()
        
        def on_error(data):
            response_complete.set()
        
        # Register temporary handlers
        self.on('chunk', on_chunk)
        self.on('response', on_response)
        self.on('error', on_error)
        
        try:
            await self.send_message(content, image_data)
            await response_complete.wait()
            return response
        finally:
            # Clean up handlers
            if 'chunk' in self.event_handlers:
                self.event_handlers['chunk'].remove(on_chunk)
            if 'response' in self.event_handlers:
                self.event_handlers['response'].remove(on_response)
            if 'error' in self.event_handlers:
                self.event_handlers['error'].remove(on_error)
    
    async def _listen(self):
        try:
            async for message in self.websocket:
                try:
                    data = json.loads(message)
                    event = data.get('event')
                    event_data = data.get('data')
                    
                    if event:
                        self.emit(event, event_data)
                except json.JSONDecodeError:
                    self.emit('error', {'message': 'Failed to parse message'})
        except websockets.exceptions.ConnectionClosed:
            self.emit('disconnected')

# Usage examples
async def main():
    # REST API example
    async with SaikiClient() as client:
        response = await client.send_message("What files are in this directory?")
        print(response['response'])
        
        # Execute tool directly
        file_content = await client.execute_tool('filesystem', 'readFile', {'path': './README.md'})
        print(file_content['data']['content'])
    
    # WebSocket example
    ws_client = SaikiWebSocketClient()
    
    ws_client.on('connected', lambda: print('Connected to Saiki'))
    ws_client.on('thinking', lambda data: print('Agent is thinking...'))
    ws_client.on('chunk', lambda data: print(data.get('content', ''), end=''))
    ws_client.on('response', lambda data: print('\nResponse complete'))
    
    await ws_client.connect()
    
    response = await ws_client.send_and_wait_for_response("Analyze this directory")
    print(f"Full response: {response}")
    
    await ws_client.disconnect()

# Run the example
if __name__ == "__main__":
    asyncio.run(main())
```

## cURL Examples

### Basic Message

```bash
# Send a simple message
curl -X POST http://localhost:3001/api/message-sync \
  -H "Content-Type: application/json" \
  -d '{"message": "What files are in the current directory?"}'
```

### Message with Image

```bash
# Send message with base64 encoded image
curl -X POST http://localhost:3001/api/message-sync \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What do you see in this image?",
    "imageData": {
      "base64": "'$(base64 -w 0 image.png)'",
      "mimeType": "image/png"
    }
  }'
```

### Server Management

```bash
# List all MCP servers
curl http://localhost:3001/api/mcp/servers

# Connect a new server
curl -X POST http://localhost:3001/api/connect-server \
  -H "Content-Type: application/json" \
  -d '{
    "name": "database",
    "config": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@truffle-ai/database-server"]
    }
  }'
```

### Tool Execution

```bash
# List tools for a server
curl http://localhost:3001/api/mcp/servers/filesystem/tools

# Execute a tool
curl -X POST http://localhost:3001/api/mcp/servers/filesystem/tools/readFile/execute \
  -H "Content-Type: application/json" \
  -d '{"path": "./README.md"}'
```

### Configuration and Health

```bash
# Get current configuration
curl http://localhost:3001/api/config.yaml

# Health check
curl http://localhost:3001/api/health

# Reset conversation
curl -X POST http://localhost:3001/api/reset \
  -H "Content-Type: application/json"
```

## Integration Patterns

### React Hook

```typescript
import { useState, useEffect, useCallback } from 'react';

interface UseSaikiOptions {
  url?: string;
  autoConnect?: boolean;
}

interface SaikiState {
  connected: boolean;
  loading: boolean;
  error: string | null;
  response: string;
}

export function useSaiki(options: UseSaikiOptions = {}) {
  const [state, setState] = useState<SaikiState>({
    connected: false,
    loading: false,
    error: null,
    response: ''
  });
  
  const [ws, setWs] = useState<WebSocket | null>(null);
  
  const connect = useCallback(() => {
    const websocket = new WebSocket(options.url || 'ws://localhost:3001/');
    
    websocket.onopen = () => {
      setState(prev => ({ ...prev, connected: true, error: null }));
    };
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.event === 'chunk') {
        setState(prev => ({ 
          ...prev, 
          response: prev.response + data.data.content 
        }));
      } else if (data.event === 'response') {
        setState(prev => ({ 
          ...prev, 
          loading: false,
          response: prev.response || data.data.content 
        }));
      } else if (data.event === 'error') {
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: data.data.message 
        }));
      }
    };
    
    websocket.onclose = () => {
      setState(prev => ({ ...prev, connected: false }));
    };
    
    websocket.onerror = () => {
      setState(prev => ({ 
        ...prev, 
        connected: false, 
        error: 'Connection failed' 
      }));
    };
    
    setWs(websocket);
  }, [options.url]);
  
  const disconnect = useCallback(() => {
    if (ws) {
      ws.close();
      setWs(null);
    }
  }, [ws]);
  
  const sendMessage = useCallback((message: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setState(prev => ({ ...prev, error: 'Not connected' }));
      return;
    }
    
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null, 
      response: '' 
    }));
    
    ws.send(JSON.stringify({
      type: 'message',
      content: message
    }));
  }, [ws]);
  
  const resetConversation = useCallback(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    ws.send(JSON.stringify({ type: 'reset' }));
    setState(prev => ({ ...prev, response: '' }));
  }, [ws]);
  
  useEffect(() => {
    if (options.autoConnect) {
      connect();
    }
    
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);
  
  return {
    ...state,
    connect,
    disconnect,
    sendMessage,
    resetConversation
  };
}

// Usage in React component
function ChatComponent() {
  const { connected, loading, response, error, connect, sendMessage } = useSaiki({
    autoConnect: true
  });
  
  const [input, setInput] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
      setInput('');
    }
  };
  
  return (
    <div>
      <div>Status: {connected ? 'Connected' : 'Disconnected'}</div>
      {error && <div>Error: {error}</div>}
      
      <div>
        <h3>Response:</h3>
        <pre>{response}</pre>
        {loading && <div>Thinking...</div>}
      </div>
      
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something..."
          disabled={!connected || loading}
        />
        <button type="submit" disabled={!connected || loading}>
          Send
        </button>
      </form>
    </div>
  );
}
```

### Express.js Middleware

```typescript
import express from 'express';
import { SaikiClient } from './saiki-client';

interface SaikiMiddlewareOptions {
  baseUrl?: string;
  timeout?: number;
}

export function saikiMiddleware(options: SaikiMiddlewareOptions = {}) {
  const client = new SaikiClient(options.baseUrl);
  
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.saiki = {
      async sendMessage(message: string, imageData?: any) {
        return client.sendMessage(message, imageData);
      },
      
      async executeTool(serverId: string, toolName: string, args: any) {
        return client.executeTool(serverId, toolName, args);
      },
      
      async getServers() {
        return client.getServers();
      },
      
      async reset() {
        return client.resetConversation();
      }
    };
    
    next();
  };
}

// Usage
const app = express();
app.use(saikiMiddleware());

app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await req.saiki.sendMessage(message);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Command Line Tool

```bash
#!/bin/bash

# saiki-cli.sh - Simple command line interface to Saiki

SAIKI_URL=${SAIKI_URL:-"http://localhost:3001/api"}

function saiki_send() {
    local message="$1"
    curl -s -X POST "$SAIKI_URL/message-sync" \
        -H "Content-Type: application/json" \
        -d "{\"message\":\"$message\"}" \
        | jq -r '.response'
}

function saiki_reset() {
    curl -s -X POST "$SAIKI_URL/reset" \
        -H "Content-Type: application/json" \
        | jq -r '.status'
}

function saiki_servers() {
    curl -s "$SAIKI_URL/mcp/servers" \
        | jq '.servers[] | "\(.name): \(.status)"'
}

function saiki_health() {
    curl -s "$SAIKI_URL/health" \
        | jq -r '.status'
}

# Main CLI interface
case "$1" in
    "send")
        saiki_send "$2"
        ;;
    "reset")
        saiki_reset
        ;;
    "servers")
        saiki_servers
        ;;
    "health")
        saiki_health
        ;;
    *)
        echo "Usage: $0 {send|reset|servers|health} [message]"
        echo "Examples:"
        echo "  $0 send 'What files are here?'"
        echo "  $0 reset"
        echo "  $0 servers"
        echo "  $0 health"
        exit 1
        ;;
esac
```

## Error Handling Patterns

### Retry with Exponential Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Should not reach here');
}

// Usage
const response = await withRetry(() => 
  client.sendMessage("What's in this directory?")
);
```

### Circuit Breaker

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold = 5,
    private timeout = 60000
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}
```

## Testing Examples

### Jest Testing

```typescript
import { SaikiClient } from '../saiki-client';

// Mock the fetch API
global.fetch = jest.fn();
const mockedFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('SaikiClient', () => {
  let client: SaikiClient;
  
  beforeEach(() => {
    client = new SaikiClient();
    mockedFetch.mockClear();
  });
  
  it('should send a message successfully', async () => {
    const mockResponse = {
      success: true,
      response: 'Hello, world!',
      timestamp: new Date().toISOString()
    };
    
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response);
    
    const result = await client.sendMessage('Hello');
    
    expect(mockedFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/message-sync',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello' })
      }
    );
    
    expect(result).toEqual(mockResponse);
  });
  
  it('should handle API errors', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    } as Response);
    
    await expect(client.sendMessage('Hello')).rejects.toThrow(
      'HTTP 500: Internal Server Error'
    );
  });
});
```

## Next Steps


- **Want to contribute?** Add your SDK to our [GitHub repository](https://github.com/truffle-ai/saiki)
- **Need help?** Join our [Discord community](https://discord.gg/GFzWFAAZcm) 