---
sidebar_position: 2
---

# Standalone Utilities

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

---

## Logger

Configurable logging utility with color support and redaction capabilities.

### Constructor

```typescript
constructor(options?: LoggerOptions)
```

Creates a new Logger instance with optional configuration.

**Options:**
- `level?: string` - Log level (error, warn, info, debug, etc.)
- `silent?: boolean` - Disable all logging

### Methods

#### `info`

Logs an informational message with optional color.

```typescript
info(message: string, meta?: any, color?: ChalkColor): void
```

#### `error`

Logs an error message.

```typescript
error(message: string, meta?: any, color?: ChalkColor): void
```

#### `warn`

Logs a warning message.

```typescript
warn(message: string, meta?: any, color?: ChalkColor): void
```

#### `debug`

Logs a debug message.

```typescript
debug(message: string | object, meta?: any, color?: ChalkColor): void
```

#### `setLevel`

Changes the logging level.

```typescript
setLevel(level: string): void
```

#### `displayAIResponse`

Displays AI responses in a formatted box.

```typescript
displayAIResponse(response: any): void
```

#### `toolCall`

Logs tool calls in a formatted box.

```typescript
toolCall(toolName: string, args: any): void
```

#### `toolResult`

Logs tool results in a formatted box.

```typescript
toolResult(result: any): void
```

### Example Usage

```typescript
import { Logger } from '@truffle-ai/saiki';

const logger = new Logger({ level: 'debug' });

logger.info('Application started', null, 'green');
logger.error('Something went wrong', { error: 'details' });
logger.debug('Debug information');
logger.warn('Warning message', null, 'yellow');
```

---

## Event Bus Classes

Type-safe event emitters for agent-level and session-level events.

### AgentEventBus

Type-safe event emitter for agent-level events.

```typescript
class AgentEventBus extends BaseTypedEventEmitter<AgentEventMap>
```

### SessionEventBus

Type-safe event emitter for session-level events.

```typescript
class SessionEventBus extends BaseTypedEventEmitter<SessionEventMap>
```

### Common Methods

#### `on`

Registers an event listener.

```typescript
on<T extends keyof EventMap>(
  event: T, 
  listener: (data: EventMap[T]) => void,
  options?: { signal?: AbortSignal }
): this
```

#### `once`

Registers a one-time event listener.

```typescript
once<T extends keyof EventMap>(
  event: T, 
  listener: (data: EventMap[T]) => void,
  options?: { signal?: AbortSignal }
): this
```

#### `emit`

Emits an event with data.

```typescript
emit<T extends keyof EventMap>(event: T, data: EventMap[T]): boolean
```

#### `off`

Removes an event listener.

```typescript
off<T extends keyof EventMap>(event: T, listener: Function): this
```

### Example Usage

```typescript
import { AgentEventBus, SessionEventBus } from '@truffle-ai/saiki';

const agentBus = new AgentEventBus();
const sessionBus = new SessionEventBus();

// Listen to events
agentBus.on('saiki:llmSwitched', (data) => {
  console.log('LLM switched:', data.newConfig);
});

sessionBus.on('llmservice:thinking', () => {
  console.log('LLM is thinking...');
});

// Emit events
agentBus.emit('saiki:conversationReset', { sessionId: 'session-1' });
```

---

## Storage Factory

### `createStorageBackends`

Creates storage backend instances for cache and database operations.

```typescript
async createStorageBackends(config: StorageConfig): Promise<{
  manager: StorageManager;
  backends: StorageBackends;
}>
```

### Storage Backend Interfaces

#### Cache Backend

```typescript
interface CacheBackend {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

#### Database Backend

```typescript
interface DatabaseBackend {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  append(key: string, value: any): Promise<void>;
  getRange(key: string, start: number, end: number): Promise<any[]>;
}
```

### Example Usage

```typescript
import { createStorageBackends } from '@truffle-ai/saiki';

const { manager, backends } = await createStorageBackends({
  cache: { type: 'in-memory' },
  database: { type: 'in-memory' }
});

// Use cache for temporary data
await backends.cache.set('session:123', sessionData, 3600); // 1 hour TTL
const sessionData = await backends.cache.get('session:123');

// Use database for persistent data
await backends.database.set('user:456', userData);
await backends.database.append('messages:789', message);
const messages = await backends.database.getRange('messages:789', 0, 50);

// Cleanup when done
await manager.disconnect();
```

---

## Service Factory

### `createAgentServices`

Low-level factory for creating all agent services with proper dependency injection.

```typescript
async createAgentServices(
  agentConfig: AgentConfig
): Promise<AgentServices>
```

**Parameters:**
- `agentConfig` - Complete agent configuration

**Returns:** `AgentServices` object containing:
- `clientManager: MCPManager`
- `promptManager: PromptManager`
- `agentEventBus: AgentEventBus`
- `stateManager: AgentStateManager`
- `sessionManager: SessionManager`
- `storage: StorageBackends`

### Example Usage

```typescript
import { createAgentServices } from '@truffle-ai/saiki';

const services = await createAgentServices(config, options);

// Access individual services
const { clientManager, sessionManager, stateManager } = services;

// Use services independently
const tools = await clientManager.getAllTools();
const session = await sessionManager.createSession();
``` 