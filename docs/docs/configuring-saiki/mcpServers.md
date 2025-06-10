---
sidebar_position: 2
sidebar_label: "MCP Configuration"
---

# mcpServers Configuration

The `mcpServers` section defines the Model Context Protocol (MCP) servers that Saiki can use for tool execution.

Saiki supports three types of MCP server connections:
- **Local servers** (`stdio`) - Launch processes on your machine
- **Remote servers** (`sse`) - Connect via Server-Sent Events over HTTP
- **HTTP servers** (`http`) - Connect via streamable HTTP transport

## Local MCP Server (stdio)

Local MCP servers use the `stdio` type to launch a process on your machine. This is useful for integrating with local tools or scripts.

**TypeScript interface:**
```typescript
export interface StdioServerConfig {
    type: 'stdio';
    command: string;
    args: string[];
    env?: Record<string, string>;
    timeout?: number; // in milliseconds
}
```

**Field explanations:**
- `type`: Must be `'stdio'` for local servers
- `command`: The shell command to launch the server (e.g., `node`, `npx`)
- `args`: Array of arguments for the command
- `env` (optional): Environment variables for the server process
- `timeout` (optional): Timeout in milliseconds for server startup or communication

**Example:**
```yaml
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - .
  puppeteer:
    type: stdio
    command: node
    args:
      - dist/src/servers/puppeteerServer.js
    env:
      DEBUG: "puppeteer:*"
    timeout: 30000
```

## Remote MCP Server (sse)

Remote MCP servers use the `sse` type to connect to a server over HTTP using Server-Sent Events. This is useful for cloud-hosted or remote tool integrations.

**TypeScript interface:**
```typescript
export interface SSEServerConfig {
    type: 'sse';
    url: string;
    headers?: Record<string, string>;
    timeout?: number; // in milliseconds
}
```

**Field explanations:**
- `type`: Must be `'sse'` for Server-Sent Events servers
- `url`: The URL of the remote MCP server
- `headers` (optional): HTTP headers to send with the connection (e.g., for authentication)
- `timeout` (optional): Timeout in milliseconds for server communication

**Example:**
```yaml
mcpServers:
  remote-llm:
    type: sse
    url: https://api.example.com/mcp-server
    headers:
      Authorization: Bearer $REMOTE_LLM_TOKEN
      User-Agent: Saiki/1.0
    timeout: 60000
```

## HTTP MCP Server (http)

HTTP MCP servers use the `http` type to connect via streamable HTTP transport. This provides a reliable HTTP-based connection for MCP servers that support this protocol.

**TypeScript interface:**
```typescript
export interface HttpServerConfig {
    type: 'http';
    baseUrl: string;
    headers?: Record<string, string>;
    timeout?: number; // in milliseconds
}
```

**Field explanations:**
- `type`: Must be `'http'` for HTTP transport servers
- `baseUrl`: The base URL of the HTTP MCP server
- `headers` (optional): HTTP headers to send with requests (e.g., for authentication)
- `timeout` (optional): Timeout in milliseconds for server communication

**Example:**
```yaml
mcpServers:
  api-server:
    type: http
    baseUrl: https://mcp.api.example.com
    headers:
      Authorization: Bearer $API_TOKEN
      Content-Type: application/json
    timeout: 45000
```

## Mixed Configuration Examples

### Example with all server types

```yaml
mcpServers:
  # Local filesystem access
  filesystem:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - .
    timeout: 30000

  # Remote SSE server
  remote-analytics:
    type: sse
    url: https://analytics.example.com/mcp-sse
    headers:
      Authorization: Bearer $ANALYTICS_TOKEN
    timeout: 60000

  # HTTP-based API server
  external-api:
    type: http
    baseUrl: https://api.external-service.com/mcp
    headers:
      Authorization: Bearer $EXTERNAL_API_TOKEN
      X-Client-Version: "1.0"
    timeout: 45000
```

### Example with environment variables

```yaml
mcpServers:
  database:
    type: stdio
    command: npx
    args:
      - -y
      - "@truffle-ai/database-server"
    env:
      DATABASE_URL: $DATABASE_URL
      LOG_LEVEL: info
    timeout: 30000

  cloud-service:
    type: http
    baseUrl: $CLOUD_SERVICE_URL
    headers:
      Authorization: Bearer $CLOUD_SERVICE_TOKEN
    timeout: 60000
```

## Server Selection Guidelines

| Server Type | Use Case | Pros | Cons |
|-------------|----------|------|------|
| **stdio** | Local tools, development, file operations | Fast, secure, full control | Requires local installation |
| **sse** | Real-time events, streaming data | Efficient for live updates | Limited to SSE-compatible servers |
| **http** | RESTful APIs, reliable connections | Widely supported, robust | May have higher latency |

## Best Practices

1. **Use environment variables** for sensitive data like API keys and tokens
2. **Set appropriate timeouts** based on expected server response times
3. **Group related servers** logically in your configuration
4. **Test server connections** during development with appropriate fallbacks
5. **Document server purposes** in comments for team collaboration

## Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| `stdio` server fails to start | Check if command and args are correct, verify file paths |
| `sse` connection drops | Verify URL accessibility, check network/firewall settings |
| `http` server timeouts | Increase timeout value, verify server availability |
| Authentication failures | Verify tokens/credentials, check header format |

### Debug Tips

- Enable debug logging to see detailed connection attempts
- Test server URLs independently before adding to configuration
- Use shorter timeouts during development to fail fast
- Verify environment variables are properly set and accessible

## Additional Resources

- [Saiki GitHub repository examples](https://github.com/truffle-ai/saiki/tree/main/configuration/examples) - More configuration examples
- [Model Context Protocol specification](https://spec.modelcontextprotocol.io/) - Official MCP documentation
- [Available MCP servers](https://github.com/modelcontextprotocol/servers) - Community-maintained server list

## Notes

- You can define as many servers as needed, each with a unique name
- Server names should be descriptive and follow consistent naming conventions
- Mixed server types can be used simultaneously in the same configuration
- All server types support optional timeout configuration for reliable operation 