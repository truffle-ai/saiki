---
sidebar_position: 1
title: "Overview"
---

Welcome to the Saiki API documentation! This comprehensive guide covers everything you need to integrate Saiki agents into your applications. 

Saiki provides both **REST API** and **WebSocket API** interfaces when running as a server (`saiki --mode server`). These APIs allow you to:

- Send messages to AI agents
- Manage conversation state  
- Connect and manage MCP servers dynamically
- Execute tools directly
- Stream real-time responses
- Monitor agent activity

## Quick Start

### 1. Start Saiki in Server Mode
```bash
saiki --mode server
```

### 2. Make Your First API Call
```bash
curl -X POST http://localhost:3001/api/message-sync \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, what can you help me with?"}'
```

### 3. Connect via WebSocket
```javascript
const ws = new WebSocket('ws://localhost:3001/');
ws.send(JSON.stringify({
  type: "message",
  content: "Hello from WebSocket!"
}));
```

## API Sections



### [REST API](./rest-api)
Complete reference for all HTTP endpoints:
- Message endpoints
- Server management
- Tool execution
- Configuration

### [WebSocket API](./websocket-api)
Real-time communication with Saiki agents:
- Connection setup
- Message types
- Event streaming
- Error handling

### [SDKs & Examples](./sdks-examples)
Code examples and SDKs for popular languages:
- JavaScript/TypeScript
- Python
- cURL examples
- Integration patterns



## Key Features

### 🔄 Real-time Streaming
Get immediate responses as your agent thinks and processes:
```javascript
// WebSocket streaming
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.event === 'chunk') {
    console.log('Agent thinking:', data.data.content);
  }
};
```

### 🛠️ Dynamic Tool Management
Connect new tools to your agent at runtime:
```javascript
// Add a new MCP server
await fetch('/api/connect-server', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'database',
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@truffle-ai/database-server']
    }
  })
});
```

### 🎯 Direct Tool Execution
Execute specific tools without going through the agent:
```javascript
// Execute a tool directly
const result = await fetch('/api/mcp/servers/filesystem/tools/readFile/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: './README.md' })
});
```

### 🖼️ Multimodal Support
Send text and images to your agent:
```javascript
// Send image with message
await fetch('/api/message-sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "What's in this image?",
    imageData: {
      base64: "iVBORw0KGgoAAAANSUhEUgAAAAUA...",
      mimeType: "image/png"
    }
  })
});
```

## Base URL

By default, Saiki runs on:
- **Development**: `http://localhost:3001`
- **Production**: Your deployed URL

All API endpoints are prefixed with `/api/` for REST calls.

## Response Format

All API responses follow this structure:

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: message",
    "details": { /* additional error context */ }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Rate Limits

Current rate limits (subject to change):
- **REST API**: 100 requests per minute per IP
- **WebSocket**: 50 messages per minute per connection
- **File uploads**: 10MB maximum size

## Status & Health

Check if your Saiki instance is running:
```bash
curl http://localhost:3001/api/health
```

## Getting Help

- **Questions?** Join our [Discord community](https://discord.gg/GFzWFAAZcm)
- **Bugs?** Report on [GitHub Issues](https://github.com/truffle-ai/saiki/issues)
- **Examples?** Check our [GitHub repository](https://github.com/truffle-ai/saiki)

## Next Steps

1. **Building a web app?** Check out [REST API](./rest-api) endpoints
2. **Need real-time updates?** Explore [WebSocket API](./websocket-api)
3. **Want examples?** Browse [SDKs & Examples](./sdks-examples)

Ready to build something amazing? Let's dive in! 🚀 