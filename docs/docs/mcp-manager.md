---
sidebar_position: 7
---

# MCP Manager

The MCPManager is Saiki's powerful standalone utility for managing Model Context Protocol (MCP) servers. Use it in your own applications to connect, manage, and interact with multiple MCP servers without needing the full Saiki agent framework.

## Overview

The MCPManager provides:
- **Multi-server management**: Connect to multiple MCP servers simultaneously
- **Unified tool interface**: Access tools from all connected servers
- **Resource management**: Handle MCP resources and prompts
- **Connection pooling**: Automatic connection management and error handling
- **Type safety**: Full TypeScript support with comprehensive types

## Installation

```bash
npm install @truffle-ai/saiki
```

## Quick Start

```typescript
import { MCPManager } from '@truffle-ai/saiki';

// Create manager instance
const manager = new MCPManager();

// Connect to an MCP server
await manager.connectServer('filesystem', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
});

// Get available tools
const tools = await manager.getAllTools();
console.log('Available tools:', Object.keys(tools));

// Execute a tool
const result = await manager.executeTool('readFile', { path: './README.md' });
console.log(result);
```

## API Reference

### Constructor

```typescript
constructor(confirmationProvider?: ToolConfirmationProvider)
```

**Parameters:**
- `confirmationProvider` (optional): Custom tool confirmation provider. Defaults to CLI confirmation.

**Example:**
```typescript
const manager = new MCPManager();

// With custom confirmation provider
const manager = new MCPManager(customConfirmationProvider);
```

### Connection Management

#### `connectServer(name, config)`

Connect to a new MCP server.

```typescript
async connectServer(name: string, config: McpServerConfig): Promise<void>
```

**Parameters:**
- `name`: Unique identifier for the server connection
- `config`: Server configuration object

**Server Configuration Types:**

```typescript
// stdio server (most common)
{
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
  env?: { [key: string]: string }
}

// HTTP server
{
  type: 'http',
  baseUrl: 'http://localhost:3001/mcp',
  timeout?: number
}

// SSE (Server-Sent Events) server  
{
  type: 'sse',
  url: 'http://localhost:3001/sse'
}
```

**Examples:**

```typescript
// File system server
await manager.connectServer('filesystem', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
});

// Web search server with API key
await manager.connectServer('tavily-search', {
  type: 'stdio',
  command: 'npx', 
  args: ['-y', 'tavily-mcp@0.1.2'],
  env: {
    TAVILY_API_KEY: process.env.TAVILY_API_KEY
  }
});

// HTTP MCP server (like another Saiki agent)
await manager.connectServer('remote-agent', {
  type: 'http',
  baseUrl: 'http://localhost:3001/mcp',
  timeout: 30000
});

// Database server
await manager.connectServer('postgres', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@truffle-ai/postgres-mcp'],
  env: {
    DATABASE_URL: process.env.DATABASE_URL
  }
});
```

#### `initializeFromConfig(serverConfigs, connectionMode)`

Initialize multiple servers from configuration.

```typescript
async initializeFromConfig(
  serverConfigs: ServerConfigs, 
  connectionMode: 'strict' | 'lenient' = 'lenient'
): Promise<void>
```

**Parameters:**
- `serverConfigs`: Object mapping server names to configurations
- `connectionMode`: 
  - `'strict'`: All servers must connect successfully
  - `'lenient'`: At least one server must connect successfully

**Example:**
```typescript
const serverConfigs = {
  filesystem: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
  },
  search: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'tavily-mcp@0.1.2'],
    env: { TAVILY_API_KEY: process.env.TAVILY_API_KEY }
  }
};

// Initialize all servers
await manager.initializeFromConfig(serverConfigs, 'lenient');
```

#### `removeClient(name)`

Disconnect and remove a specific server.

```typescript
async removeClient(name: string): Promise<void>
```

**Example:**
```typescript
await manager.removeClient('filesystem');
```

#### `disconnectAll()`

Disconnect all servers and clear caches.

```typescript
async disconnectAll(): Promise<void>
```

**Example:**
```typescript
await manager.disconnectAll();
```

### Tool Management

#### `getAllTools()`

Get all available tools from all connected servers.

```typescript
async getAllTools(): Promise<ToolSet>
```

**Returns:** Object mapping tool names to tool definitions

**Example:**
```typescript
const tools = await manager.getAllTools();
console.log('Available tools:', Object.keys(tools));

// Inspect a specific tool
const readFileTool = tools.readFile;
console.log('Tool schema:', readFileTool.inputSchema);
```

#### `getToolClient(toolName)`

Get the client that provides a specific tool.

```typescript
getToolClient(toolName: string): IMCPClient | undefined
```

**Example:**
```typescript
const client = manager.getToolClient('readFile');
if (client) {
  console.log('Tool is provided by:', client);
}
```

#### `executeTool(toolName, args)`

Execute a specific tool with arguments.

```typescript
async executeTool(toolName: string, args: any): Promise<any>
```

**Example:**
```typescript
// Read a file
const content = await manager.executeTool('readFile', { 
  path: './package.json' 
});

// Search the web
const searchResults = await manager.executeTool('search', {
  query: 'latest AI developments',
  max_results: 5
});

// Write a file
await manager.executeTool('writeFile', {
  path: './output.txt',
  content: 'Hello from MCP!'
});
```

### Resource Management

#### `listAllResources()`

Get all available resource URIs from all connected servers.

```typescript
async listAllResources(): Promise<string[]>
```

**Example:**
```typescript
const resources = await manager.listAllResources();
console.log('Available resources:', resources);
```

#### `getResourceClient(resourceUri)`

Get the client that provides a specific resource.

```typescript
getResourceClient(resourceUri: string): IMCPClient | undefined
```

#### `readResource(uri)`

Read a specific resource by URI.

```typescript
async readResource(uri: string): Promise<ReadResourceResult>
```

**Example:**
```typescript
const resource = await manager.readResource('file:///project/README.md');
console.log('Resource content:', resource.contents);
```

### Prompt Management

#### `listAllPrompts()`

Get all available prompt names from all connected servers.

```typescript
async listAllPrompts(): Promise<string[]>
```

**Example:**
```typescript
const prompts = await manager.listAllPrompts();
console.log('Available prompts:', prompts);
```

#### `getPromptClient(promptName)`

Get the client that provides a specific prompt.

```typescript
getPromptClient(promptName: string): IMCPClient | undefined
```

#### `getPrompt(name, args)`

Get a specific prompt definition by name.

```typescript
async getPrompt(name: string, args?: any): Promise<GetPromptResult>
```

**Example:**
```typescript
const prompt = await manager.getPrompt('code-review', {
  language: 'typescript',
  file: 'src/index.ts'
});
console.log('Prompt:', prompt.messages);
```

### Status and Monitoring

#### `getClients()`

Get all registered clients.

```typescript
getClients(): Map<string, IMCPClient>
```

**Example:**
```typescript
const clients = manager.getClients();
console.log('Connected servers:', Array.from(clients.keys()));

for (const [name, client] of clients) {
  console.log(`Server: ${name}, Tools available: ${Object.keys(await client.getTools()).length}`);
}
```

#### `getFailedConnections()`

Get errors from failed connections.

```typescript
getFailedConnections(): { [key: string]: string }
```

**Example:**
```typescript
const errors = manager.getFailedConnections();
if (Object.keys(errors).length > 0) {
  console.log('Failed connections:', errors);
}
```

## Usage Patterns

### Basic File Operations

```typescript
import { MCPManager } from '@truffle-ai/saiki';

const manager = new MCPManager();

// Setup filesystem access
await manager.connectServer('fs', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
});

// Read files
const packageJson = await manager.executeTool('readFile', { 
  path: './package.json' 
});

// List directory contents
const files = await manager.executeTool('listFiles', { 
  path: './src' 
});

// Write files
await manager.executeTool('writeFile', {
  path: './output.md',
  content: '# Generated Report\n\nSome content here...'
});
```

### Web Search and Research

```typescript
const manager = new MCPManager();

// Setup web search
await manager.connectServer('search', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', 'tavily-mcp@0.1.2'],
  env: { TAVILY_API_KEY: process.env.TAVILY_API_KEY }
});

// Search for information
const results = await manager.executeTool('search', {
  query: 'Model Context Protocol specifications',
  max_results: 10
});

console.log('Search results:', results);
```

### Database Operations

```typescript
const manager = new MCPManager();

// Setup database connection
await manager.connectServer('db', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@truffle-ai/postgres-mcp'],
  env: {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/mydb'
  }
});

// Execute SQL queries
const users = await manager.executeTool('query', {
  sql: 'SELECT * FROM users WHERE active = true',
  params: []
});

// Get schema information
const schema = await manager.executeTool('describe_table', {
  table: 'users'
});
```

### Multi-Server Workflows

```typescript
const manager = new MCPManager();

// Connect to multiple servers
await manager.initializeFromConfig({
  filesystem: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
  },
  search: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'tavily-mcp@0.1.2'],
    env: { TAVILY_API_KEY: process.env.TAVILY_API_KEY }
  },
  git: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-git']
  }
});

// Complex workflow using multiple tools
async function generateProjectReport() {
  // Get project files
  const files = await manager.executeTool('listFiles', { path: './src' });
  
  // Get git information
  const commits = await manager.executeTool('git_log', { limit: 10 });
  
  // Search for related information
  const research = await manager.executeTool('search', {
    query: 'project documentation best practices'
  });
  
  // Generate report
  const report = `
# Project Report

## Files: ${files.length} files found
## Recent commits: ${commits.length} commits
## Research findings: ${research.length} results

...
  `;
  
  // Save report
  await manager.executeTool('writeFile', {
    path: './PROJECT_REPORT.md',
    content: report
  });
}

await generateProjectReport();
```

### Error Handling

```typescript
const manager = new MCPManager();

try {
  await manager.connectServer('filesystem', {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
  });
} catch (error) {
  console.error('Failed to connect to filesystem server:', error);
  
  // Check what connections failed
  const failed = manager.getFailedConnections();
  console.log('Connection errors:', failed);
}

// Handle tool execution errors
try {
  const result = await manager.executeTool('readFile', { path: './nonexistent.txt' });
} catch (error) {
  console.error('Tool execution failed:', error);
}

// Graceful cleanup
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await manager.disconnectAll();
  process.exit(0);
});
```

### Custom Confirmation Provider

```typescript
import { ToolConfirmationProvider } from '@truffle-ai/saiki';

class CustomConfirmationProvider implements ToolConfirmationProvider {
  async requestConfirmation({ toolName, args }): Promise<boolean> {
    // Custom logic - for example, auto-approve safe operations
    if (['readFile', 'listFiles', 'search'].includes(toolName)) {
      return true;
    }
    
    // Require manual approval for destructive operations
    if (['writeFile', 'deleteFile'].includes(toolName)) {
      console.log(`Approve ${toolName} with args:`, args);
      // Custom approval logic here
      return confirm('Approve this operation?');
    }
    
    return false;
  }
}

const manager = new MCPManager(new CustomConfirmationProvider());
```

## Integration Examples

### Express.js API

```typescript
import express from 'express';
import { MCPManager } from '@truffle-ai/saiki';

const app = express();
app.use(express.json());

const manager = new MCPManager();

// Initialize MCP servers
await manager.initializeFromConfig({
  filesystem: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
  }
});

// API endpoint to list available tools
app.get('/api/tools', async (req, res) => {
  const tools = await manager.getAllTools();
  res.json({ tools: Object.keys(tools) });
});

// API endpoint to execute tools
app.post('/api/execute/:toolName', async (req, res) => {
  try {
    const { toolName } = req.params;
    const { args } = req.body;
    
    const result = await manager.executeTool(toolName, args);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.listen(3000, () => {
  console.log('MCP API server running on port 3000');
});
```

### CLI Tool

```typescript
#!/usr/bin/env node
import { MCPManager } from '@truffle-ai/saiki';
import { Command } from 'commander';

const program = new Command();
const manager = new MCPManager();

program
  .name('mcp-cli')
  .description('CLI for MCP server management')
  .version('1.0.0');

program
  .command('connect <name> <command>')
  .description('Connect to an MCP server')
  .action(async (name, command) => {
    await manager.connectServer(name, {
      type: 'stdio',
      command: 'npx',
      args: ['-y', command]
    });
    console.log(`Connected to server: ${name}`);
  });

program
  .command('tools')
  .description('List available tools')
  .action(async () => {
    const tools = await manager.getAllTools();
    console.log('Available tools:', Object.keys(tools));
  });

program
  .command('exec <tool> [args...]')
  .description('Execute a tool')
  .action(async (tool, args) => {
    const toolArgs = args.reduce((acc, arg) => {
      const [key, value] = arg.split('=');
      acc[key] = value;
      return acc;
    }, {});
    
    const result = await manager.executeTool(tool, toolArgs);
    console.log(JSON.stringify(result, null, 2));
  });

program.parse();
```

## Best Practices

### Connection Management

1. **Use connection pooling**: Keep connections alive for better performance
2. **Handle failures gracefully**: Use lenient mode and check for failed connections
3. **Clean up resources**: Always call `disconnectAll()` on shutdown

### Error Handling

1. **Wrap operations in try-catch**: MCP operations can fail
2. **Check server availability**: Use `getClients()` to verify connections
3. **Monitor failed connections**: Regularly check `getFailedConnections()`

### Performance

1. **Cache tool lists**: Call `getAllTools()` sparingly
2. **Batch operations**: Group related tool calls together  
3. **Use appropriate timeouts**: Configure timeouts for HTTP servers

### Security

1. **Validate tool arguments**: Always validate inputs before execution
2. **Use confirmation providers**: Implement approval workflows for sensitive operations
3. **Limit tool access**: Only connect to necessary MCP servers

## Troubleshooting

### Common Issues

**"No client found for tool" errors**
- Ensure the server providing the tool is connected
- Check tool availability with `getAllTools()`
- Verify server configuration

**Connection timeouts**
- Increase timeout values for HTTP servers
- Check server availability
- Verify network connectivity

**Permission errors**
- Check file/directory permissions for stdio servers
- Verify API keys for external services
- Ensure proper environment variables

**Tool execution failures**
- Validate tool arguments match the expected schema
- Check server logs for detailed error information
- Verify tool confirmation settings

The MCPManager provides a powerful, flexible foundation for building MCP-based applications. Whether you're creating simple automation scripts or complex multi-server workflows, it handles the complexity of MCP protocol management while providing a clean, intuitive API. 🛠️ 