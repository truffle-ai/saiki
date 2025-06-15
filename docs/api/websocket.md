---
sidebar_position: 3
---

# WebSocket API

The WebSocket API provides real-time, bidirectional communication with Saiki, perfect for building interactive applications.

### Connection URL
<p class="api-endpoint-header"><code>ws://localhost:3001/</code></p>

---

## Client to Server Messages
*Send messages to the server as JSON strings.*

### Send Message
*Instructs the agent to process a user prompt.*
#### Schema
```typescript
{
  "type": "message",
  "content": string,
  "sessionId"?: string,
  "stream"?: boolean,
  "imageData"?: {
    "base64": string,
    "mimeType": string
  }
}
```
- `sessionId`: Continue an existing conversation.
- `stream`: If `true`, the agent will send back `chunk` events as it thinks.

### Reset Conversation
*Resets the conversation history for a session.*
#### Schema
```typescript
{
  "type": "reset",
  "sessionId"?: string
}
```

---

## Server to Client Events
*Listen for events from the server to get real-time updates. All events follow the `{ "event": "...", "data": { ... } }` structure.*

### Agent Events
*These events are broadcast from the agent's core processing logic.*

- **`thinking`**: The agent has started processing a prompt.
- **`chunk`**: A piece of the response, sent when `stream: true` is used. The `data` payload is `{ "content": "..." }`.
- **`toolCall`**: The agent is about to execute a tool. The `data` payload contains `toolName`, `serverId`, and `arguments`.
- **`toolResult`**: The result of a tool execution. The `data` payload contains `toolName`, `serverId`, and `result`.
- **`response`**: The final, complete response from the agent. The `data` payload is `{ "content": "..." }`.
- **`error`**: An error occurred within the agent's execution. The `data` payload contains a detailed error message and code.

### Connection Events
*These events are sent directly in response to a WebSocket message.*

- **`error`**: A message could not be processed. The `data` payload will contain a simple error message, such as `{ "message": "Failed to process message" }` or `{ "message": "Unknown message type" }`.

### Example Event
```json
{
  "event": "chunk",
  "data": {
    "content": "I can see several files..."
  }
}
```

## Complete Example

Here's a full working example:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Saiki WebSocket Example</title>
</head>
<body>
    <div id="messages"></div>
    <input type="text" id="messageInput" placeholder="Type a message...">
    <button onclick="sendMessage()">Send</button>
    <button onclick="resetConversation()">Reset</button>

    <script>
        const ws = new WebSocket('ws://localhost:3001/');
        const messagesDiv = document.getElementById('messages');
        
        ws.onopen = () => {
            addMessage('System', 'Connected to Saiki', 'system');
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleEvent(data);
        };
        
        ws.onclose = () => {
            addMessage('System', 'Disconnected from Saiki', 'system');
        };
        
        ws.onerror = (error) => {
            addMessage('System', `Error: ${error.message}`, 'error');
        };
        
        function handleEvent(data) {
            switch (data.event) {
                case 'thinking':
                    addMessage('Agent', 'Thinking...', 'thinking');
                    break;
                    
                case 'chunk':
                    appendToLastMessage(data.data.content);
                    break;
                    
                case 'toolCall':
                    addMessage('Agent', `Using tool: ${data.data.toolName}`, 'tool');
                    break;
                    
                case 'toolResult':
                    addMessage('Tool', `Result from ${data.data.toolName}`, 'tool-result');
                    break;
                    
                case 'response':
                    addMessage('Agent', data.data.content, 'response');
                    break;
                    
                case 'error':
                    addMessage('Error', data.data.message, 'error');
                    break;
            }
        }
        
        function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (message) {
                addMessage('You', message, 'user');
                
                ws.send(JSON.stringify({
                    type: 'message',
                    content: message
                }));
                
                input.value = '';
            }
        }
        
        function resetConversation() {
            ws.send(JSON.stringify({
                type: 'reset'
            }));
            
            addMessage('System', 'Conversation reset', 'system');
        }
        
        function addMessage(sender, content, type) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${type}`;
            messageDiv.innerHTML = `<strong>${sender}:</strong> ${content}`;
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        
        function appendToLastMessage(content) {
            const lastMessage = messagesDiv.lastElementChild;
            if (lastMessage && lastMessage.classList.contains('response')) {
                lastMessage.innerHTML += content;
            } else {
                addMessage('Agent', content, 'response');
            }
        }
        
        // Send message on Enter key
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    </script>
    
    <style>
        #messages {
            height: 400px;
            overflow-y: auto;
            border: 1px solid #ccc;
            padding: 10px;
            margin-bottom: 10px;
        }
        
        .message {
            margin-bottom: 10px;
            padding: 5px;
            border-radius: 5px;
        }
        
        .message.user {
            background-color: #e3f2fd;
        }
        
        .message.response {
            background-color: #f3e5f5;
        }
        
        .message.thinking {
            background-color: #fff3e0;
            font-style: italic;
        }
        
        .message.tool {
            background-color: #e8f5e8;
            font-size: 0.9em;
        }
        
        .message.error {
            background-color: #ffebee;
            color: #c62828;
        }
        
        .message.system {
            background-color: #f5f5f5;
            font-size: 0.9em;
        }
        
        #messageInput {
            width: 70%;
            padding: 10px;
            margin-right: 10px;
        }
        
        button {
            padding: 10px 20px;
            margin-right: 10px;
        }
    </style>
</body>
</html>
```

## Advanced Usage

### Connection Management

```javascript
class SaikiWebSocketClient {
  constructor(url = 'ws://localhost:3001/') {
    this.url = url;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.eventHandlers = new Map();
  }
  
  connect() {
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      console.log('Connected to Saiki');
      this.reconnectAttempts = 0;
      this.emit('connected');
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.emit(data.event, data.data);
    };
    
    this.ws.onclose = () => {
      console.log('Disconnected from Saiki');
      this.emit('disconnected');
      this.attemptReconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  sendMessage(content, imageData = null) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'message',
        content,
        ...(imageData && { imageData })
      };
      
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket is not connected');
    }
  }
  
  resetConversation() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'reset' }));
    }
  }
  
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }
  
  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
  
  emit(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Event handler error:', error);
        }
      });
    }
  }
  
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('reconnectFailed');
    }
  }
}

// Usage
const client = new SaikiWebSocketClient();

client.on('connected', () => {
  console.log('Successfully connected to Saiki');
});

client.on('thinking', () => {
  console.log('Agent is thinking...');
});

client.on('chunk', (data) => {
  process.stdout.write(data.content);
});

client.on('response', (data) => {
  console.log('\nFinal response:', data.content);
});

client.on('error', (error) => {
  console.error('Error:', error.message);
});

client.connect();

// Send a message
client.sendMessage("What's in this directory?");
```

### Message Queue

```javascript
class MessageQueue {
  constructor(client) {
    this.client = client;
    this.queue = [];
    this.processing = false;
  }
  
  async addMessage(content, imageData = null) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        content,
        imageData,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const message = this.queue.shift();
      
      try {
        const response = await this.sendAndWaitForResponse(
          message.content, 
          message.imageData
        );
        message.resolve(response);
      } catch (error) {
        message.reject(error);
      }
    }
    
    this.processing = false;
  }
  
  sendAndWaitForResponse(content, imageData) {
    return new Promise((resolve, reject) => {
      let response = '';
      
      const cleanup = () => {
        this.client.off('chunk', onChunk);
        this.client.off('response', onResponse);
        this.client.off('error', onError);
      };
      
      const onChunk = (data) => {
        response += data.content;
      };
      
      const onResponse = (data) => {
        cleanup();
        resolve(response || data.content);
      };
      
      const onError = (error) => {
        cleanup();
        reject(new Error(error.message));
      };
      
      this.client.on('chunk', onChunk);
      this.client.on('response', onResponse);
      this.client.on('error', onError);
      
      this.client.sendMessage(content, imageData);
    });
  }
}
```

## Error Handling

### Connection Errors

```javascript
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
  
  // Common error scenarios:
  // - Server not running
  // - Network issues
  // - Invalid URL
  // - Security restrictions
};

ws.onclose = (event) => {
  console.log('Connection closed:', event.code, event.reason);
  
  // Close codes:
  // 1000 - Normal closure
  // 1001 - Going away
  // 1006 - Abnormal closure
  // 1011 - Server error
};
```

### Message Errors

```javascript
ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    
    if (data.event === 'error') {
      handleAgentError(data.data);
    } else {
      handleEvent(data);
    }
  } catch (error) {
    console.error('Failed to parse message:', error);
  }
};

function handleAgentError(error) {
  switch (error.code) {
    case 'AGENT_ERROR':
      console.error('Agent processing failed:', error.message);
      break;
    case 'TOOL_EXECUTION_FAILED':
      console.error('Tool failed:', error.details);
      break;
    default:
      console.error('Unknown error:', error);
  }
}
```

## Performance Tips

### Throttling Messages

```javascript
class ThrottledClient {
  constructor(ws, maxMessagesPerSecond = 10) {
    this.ws = ws;
    this.messageInterval = 1000 / maxMessagesPerSecond;
    this.lastMessageTime = 0;
    this.messageQueue = [];
    this.processing = false;
  }
  
  sendMessage(content) {
    this.messageQueue.push(content);
    this.processQueue();
  }
  
  async processQueue() {
    if (this.processing) return;
    this.processing = true;
    
    while (this.messageQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastMessage = now - this.lastMessageTime;
      
      if (timeSinceLastMessage < this.messageInterval) {
        await new Promise(resolve => 
          setTimeout(resolve, this.messageInterval - timeSinceLastMessage)
        );
      }
      
      const message = this.messageQueue.shift();
      this.ws.send(JSON.stringify({
        type: 'message',
        content: message
      }));
      
      this.lastMessageTime = Date.now();
    }
    
    this.processing = false;
  }
}
```

## Next Steps

- **Need HTTP endpoints?** Check out [REST API](./rest-api)
- **Want code examples?** Browse [SDKs & Examples](./sdks-examples)
- **Having issues?** See [Error Handling](./error-handling) 