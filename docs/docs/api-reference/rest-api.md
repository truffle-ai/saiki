---
sidebar_position: 3
---

# REST API

Complete reference for all Saiki REST API endpoints. All endpoints are prefixed with `/api/`.

## Base URL

```
http://localhost:3001/api
```

## Message Endpoints

### Send Message (Synchronous)

Send a message to the agent and receive the complete response.

```http
POST /api/message-sync
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | ✅ | The message to send to the agent |
| `imageData` | object | ❌ | Optional image data for multimodal input |
| `imageData.base64` | string | ❌ | Base64 encoded image string |
| `imageData.mimeType` | string | ❌ | Image MIME type (e.g., "image/png") |

#### Example Request

```bash
curl -X POST http://localhost:3001/api/message-sync \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What files are in the current directory?",
    "imageData": {
      "base64": "iVBORw0KGgoAAAANSUhEUgAAAAUA...",
      "mimeType": "image/png"
    }
  }'
```

#### Example Response

```json
{
  "success": true,
  "response": "I can see several files in the current directory:\n\n1. package.json - Node.js project configuration\n2. README.md - Project documentation\n3. src/ - Source code directory\n4. docs/ - Documentation files\n\nWould you like me to examine any specific file in more detail?",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Status Codes

| Code | Description |
|------|----------|
| `200` | Success - Message processed |
| `400` | Bad Request - Invalid message format |
| `429` | Rate Limit - Too many requests |
| `500` | Server Error - Processing failed |

### Send Message (Asynchronous)

Send a message to the agent asynchronously. Use WebSocket to receive the response.

```http
POST /api/message
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | ✅ | The message to send to the agent |

#### Example Request

```bash
curl -X POST http://localhost:3001/api/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Analyze the project structure"}'
```

#### Example Response

```json
{
  "status": "processing",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

:::info WebSocket Required
The actual response will be sent via WebSocket events. See [WebSocket API](./websocket-api) for details.
:::

### Reset Conversation

Clear the agent's conversation history for a fresh start.

```http
POST /api/reset
```

#### Request Body

No request body required (can be empty or `{}`).

#### Example Request

```bash
curl -X POST http://localhost:3001/api/reset \
  -H "Content-Type: application/json"
```

#### Example Response

```json
{
  "status": "reset initiated",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## MCP Server Management

### List MCP Servers

Get all connected and attempted MCP servers with their status.

```http
GET /api/mcp/servers
```

#### Example Request

```bash
curl http://localhost:3001/api/mcp/servers
```

#### Example Response

```json
{
  "servers": [
    {
      "id": "filesystem",
      "name": "filesystem",
      "status": "connected",
      "type": "stdio",
      "description": "File system operations"
    },
    {
      "id": "puppeteer",
      "name": "puppeteer",
      "status": "error",
      "type": "stdio",
      "error": "Failed to start server process"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Server Status Values

| Status | Description |
|--------|-------------|
| `connected` | Server is running and connected |
| `connecting` | Server is starting up |
| `error` | Server failed to start or crashed |
| `disconnected` | Server was disconnected |

### Connect New MCP Server

Dynamically connect a new MCP server to the agent at runtime.

```http
POST /api/connect-server
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Unique name for the server |
| `config` | object | ✅ | Server configuration |
| `config.type` | string | ✅ | Server type (usually "stdio") |
| `config.command` | string | ✅ | Command to start the server |
| `config.args` | array | ❌ | Command arguments |
| `config.env` | object | ❌ | Environment variables |

#### Example Request

```bash
curl -X POST http://localhost:3001/api/connect-server \
  -H "Content-Type: application/json" \
  -d '{
    "name": "database",
    "config": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@truffle-ai/database-server"],
      "env": {
        "DB_URL": "postgresql://localhost:5432/mydb"
      }
    }
  }'
```

#### Example Response

```json
{
  "status": "connected",
  "name": "database",
  "server": {
    "id": "database",
    "name": "database",
    "status": "connected",
    "type": "stdio"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Tool Management

### List Server Tools

Get all tools available from a specific MCP server.

```http
GET /api/mcp/servers/{serverId}/tools
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serverId` | string | ✅ | The ID/name of the MCP server |

#### Example Request

```bash
curl http://localhost:3001/api/mcp/servers/filesystem/tools
```

#### Example Response

```json
{
  "tools": [
    {
      "id": "readFile",
      "name": "readFile",
      "description": "Read the contents of a file",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "description": "Path to the file to read"
          }
        },
        "required": ["path"]
      }
    },
    {
      "id": "writeFile",
      "name": "writeFile",
      "description": "Write content to a file",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "description": "Path to the file to write"
          },
          "content": {
            "type": "string",
            "description": "Content to write to the file"
          }
        },
        "required": ["path", "content"]
      }
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Execute Tool

Directly execute a specific tool on a connected MCP server.

```http
POST /api/mcp/servers/{serverId}/tools/{toolName}/execute
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serverId` | string | ✅ | The ID/name of the MCP server |
| `toolName` | string | ✅ | The name of the tool to execute |

#### Request Body

The request body should match the tool's `inputSchema`. See the tool list endpoint for schema details.

#### Example Request

```bash
curl -X POST http://localhost:3001/api/mcp/servers/filesystem/tools/readFile/execute \
  -H "Content-Type: application/json" \
  -d '{"path": "./README.md"}'
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "content": "# My Project\n\nThis is a sample README file...",
    "encoding": "utf-8",
    "size": 1234
  },
  "execution": {
    "toolName": "readFile",
    "serverId": "filesystem",
    "duration": 45
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Configuration

### Export Configuration

Get the current agent configuration in YAML format. Sensitive information is omitted.

```http
GET /api/config.yaml
```

#### Example Request

```bash
curl http://localhost:3001/api/config.yaml
```

#### Example Response

```yaml
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "."

llm:
  provider: openai
  model: gpt-4.1-mini
  apiKey: "***REDACTED***"
  systemPrompt: |
    You are Saiki, a helpful AI assistant with access to tools.
    Use these tools when appropriate to answer user queries.

version: "0.2.5"
```

## Health Check

### API Health

Check if the Saiki API is running and healthy.

```http
GET /api/health
```

#### Example Request

```bash
curl http://localhost:3001/api/health
```

#### Example Response

```json
{
  "status": "healthy",
  "version": "0.2.5",
  "uptime": 3600,
  "agent": {
    "status": "ready",
    "connectedServers": 2
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Error Responses

All endpoints return errors in a consistent format:

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "field": "Additional error context",
      "suggestion": "How to fix this error"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_REQUEST` | 400 | Request format is invalid |
| `MISSING_FIELD` | 400 | Required field is missing |
| `UNAUTHORIZED` | 401 | Authentication required |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `SERVER_NOT_FOUND` | 404 | MCP server not found |
| `TOOL_NOT_FOUND` | 404 | Tool not found on server |
| `TOOL_EXECUTION_FAILED` | 500 | Tool execution failed |
| `AGENT_ERROR` | 500 | Agent processing error |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Example Error Responses

#### Missing Required Field

```json
{
  "success": false,
  "error": {
    "code": "MISSING_FIELD",
    "message": "Missing required field: message",
    "details": {
      "field": "message",
      "suggestion": "Include a 'message' field in your request body"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Tool Execution Failed

```json
{
  "success": false,
  "error": {
    "code": "TOOL_EXECUTION_FAILED",
    "message": "Failed to execute tool: readFile",
    "details": {
      "toolName": "readFile",
      "serverId": "filesystem",
      "reason": "File not found: ./nonexistent.txt"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

<!-- ## Rate Limiting

API responses include rate limiting headers:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
Content-Type: application/json
```

Rate limiting information will be documented here in future updates. -->

## Next Steps

- **Need real-time updates?** Check out [WebSocket API](./websocket-api)
- **Want code examples?** Browse [SDKs & Examples](./sdks-examples) 