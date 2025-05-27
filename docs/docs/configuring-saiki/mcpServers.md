---
sidebar_position: 2
---

# mcpServers Configuration

The `mcpServers` section defines the Model Context Protocol (MCP) servers Saiki can use for tool execution. 

Local MCP servers are supported with `stdio` type
Remote MCP servers are supported with `sse` type

## Local MCP Server (stdio)

Local MCP servers use the `stdio` type to launch a process on your machine. This is useful for integrating with local tools or scripts.

**TypeScript type:**
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
- `type`: Must be `'stdio'` for local servers.
- `command`: The shell command to launch the server (e.g., `node`).
- `args`: Array of arguments for the command.
- `env` (optional): Environment variables for the server process.
- `timeout` (optional): Timeout in milliseconds for server startup or communication.

## Remote MCP Server (sse)

Remote MCP servers use the `sse` type to connect to a server over HTTP using Server-Sent Events. This is useful for cloud or remote tool integrations.

**TypeScript type:**
```typescript
export interface SSEServerConfig {
    type: 'sse';
    url: string;
    headers?: Record<string, string>;
    timeout?: number; // in milliseconds
}
```

**Field explanations:**
- `type`: Must be `'sse'` for remote servers.
- `url`: The URL of the remote MCP server.
- `headers` (optional): HTTP headers to send with the connection (e.g., for authentication).
- `timeout` (optional): Timeout in milliseconds for server communication.


## Example with local servers (stdio)

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
```

## Example with remote servers (SSE)

```yaml
mcpServers:
  remote-llm:
    type: sse
    url: https://api.example.com/mcp-server
    headers:
      Authorization: Bearer $REMOTE_LLM_TOKEN
```

## Example with both local and remote servers

```yaml
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - .
  remote-llm:
    type: sse
    url: https://api.example.com/mcp-server
    headers:
      Authorization: Bearer $REMOTE_LLM_TOKEN
```

## Notes

- Refer Saiki's [github repository](https://github.com/truffle-ai/saiki/tree/main/configuration/examples) to see more examples
- You can define as many servers as you want, each with a unique name.
- Use environment variables for secrets (e.g., `token: $MY_SECRET_TOKEN`). 