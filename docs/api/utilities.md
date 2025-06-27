---
sidebar_position: 2
---

# Utilities

Individual classes and utilities that can be used independently of the main `SaikiAgent` class.

## MCPManager

Standalone MCP server manager for handling multiple MCP connections without a full agent.

### Constructor

```typescript
constructor(confirmationProvider?: ToolConfirmationProvider)
```

Creates a new MCPManager instance for managing MCP server connections.

### Methods

#### `connectServer`

Connects to a new MCP server.

```typescript
async connectServer(name: string, config: McpServerConfig): Promise<void>
```

#### `removeClient`

Disconnects and removes a specific MCP server.

```typescript
async removeClient(name: string): Promise<void>
```

#### `getAllTools`

Gets all available tools from connected servers.

```typescript
async getAllTools(): Promise<ToolSet>
```

#### `executeTool`

Executes a specific tool with arguments.

```typescript
async executeTool(toolName: string, args: any): Promise<any>
```

#### `getClients`

Returns all registered MCP client instances.

```typescript
getClients(): Map<string, IMCPClient>
```

#### `getFailedConnections`

Returns failed connection error messages.

```typescript
getFailedConnections(): Record<string, string>
```

#### `listAllPrompts`

Gets all available prompt names from connected servers.

```typescript
async listAllPrompts(): Promise<string[]>
```

#### `getPrompt`

Gets a specific prompt by name.

```typescript
async getPrompt(name: string, args?: any): Promise<GetPromptResult>
```

#### `listAllResources`

Gets all available resource URIs from connected servers.

```typescript
async listAllResources(): Promise<string[]>
```

#### `readResource`

Reads a specific resource by URI.

```typescript
async readResource(uri: string): Promise<ReadResourceResult>
```

### Example Usage

```typescript
import { MCPManager } from '@truffle-ai/saiki';

const mcpManager = new MCPManager();

// Connect to servers
await mcpManager.connectServer('filesystem', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
});

// Execute tools directly
const result = await mcpManager.executeTool('readFile', { path: './README.md' });

// Get all available tools
const tools = await mcpManager.getAllTools();
console.log('Available tools:', Object.keys(tools));
``` 