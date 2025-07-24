---
sidebar_position: 1
---

# DextoAgent API

Complete API reference for the main `DextoAgent` class.

## Constructor and Lifecycle

### `constructor`

Creates a new Dexto agent instance with the provided configuration.

```typescript
constructor(config: AgentConfig)
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `config` | `AgentConfig` | Agent configuration object |

### `start`

Initializes and starts the agent with all required services.

```typescript
async start(): Promise<void>
```

**Parameters:** None

**Example:**
```typescript
const agent = new DextoAgent(config);
await agent.start();
```

### `stop`

Stops the agent and cleans up all resources.

```typescript
async stop(): Promise<void>
```

**Example:**
```typescript
await agent.stop();
```

---

## Core Methods

### `run`

Processes user input through the agent's LLM and returns the response.

```typescript
async run(
  userInput: string,
  imageDataInput?: { image: string; mimeType: string },
  sessionId?: string,
  stream?: boolean
): Promise<string | null>
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `userInput` | `string` | User message or query |
| `imageDataInput` | `{ image: string; mimeType: string }` | (Optional) Base64 image data |
| `sessionId` | `string` | (Optional) Session ID |
| `stream` | `boolean` | (Optional) Enable streaming (default: false) |

**Returns:** `Promise<string | null>` - AI response or null

**Example:**
```typescript
const agent = new DextoAgent(config);
await agent.start();
const response = await agent.run("Explain quantum computing");
// ... use agent ...
await agent.stop();
```

---

## Session Management

### `createSession`

Creates a new conversation session with optional custom ID.

```typescript
async createSession(sessionId?: string): Promise<ChatSession>
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `sessionId` | `string` | (Optional) Custom session ID |

**Returns:** `Promise<ChatSession>`

### `getSession`

Retrieves an existing session by its ID.

```typescript
async getSession(sessionId: string): Promise<ChatSession | undefined>
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `sessionId` | `string` | Session ID to retrieve |

**Returns:** `Promise<ChatSession | undefined>`

### `listSessions`

Returns an array of all active session IDs.

```typescript
async listSessions(): Promise<string[]>
```

**Returns:** `Promise<string[]>` - Array of session IDs

### `deleteSession`

Permanently deletes a session and all its conversation history. This action cannot be undone.

```typescript
async deleteSession(sessionId: string): Promise<void>
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `sessionId` | `string` | Session ID to delete |

**Note:** This completely removes the session and all associated conversation data from storage.

### `loadSession`

Sets a session as the default for subsequent operations that don't specify a session ID.

```typescript
async loadSession(sessionId: string | null): Promise<void>
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `sessionId` | `string \| null` | Session ID to load as default, or null to reset |

### `resetConversation`

Clears the conversation history of a session while keeping the session active.

```typescript
async resetConversation(sessionId?: string): Promise<void>
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `sessionId` | `string` | (Optional) Session to reset |

### `getSessionMetadata`

Retrieves metadata for a session including creation time and message count.

```typescript
async getSessionMetadata(sessionId: string): Promise<SessionMetadata | undefined>
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `sessionId` | `string` | Session ID |

**Returns:** `Promise<SessionMetadata | undefined>`

### `getSessionHistory`

Gets the complete conversation history for a session.

```typescript
async getSessionHistory(sessionId: string): Promise<ConversationHistory>
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `sessionId` | `string` | Session ID |

**Returns:** `Promise<ConversationHistory>`

### `getCurrentSessionId`

Returns the ID of the currently loaded default session.

```typescript
getCurrentSessionId(): string
```

**Returns:** `string` - Current default session ID

### `getDefaultSession`

Returns the currently loaded default session instance.

```typescript
async getDefaultSession(): Promise<ChatSession>
```

**Returns:** `Promise<ChatSession>`

---

## Configuration

### `switchLLM`

Dynamically changes the LLM configuration for the agent or a specific session.

```typescript
async switchLLM(
  llmUpdates: Partial<LLMConfig>,
  sessionId?: string
): Promise<SwitchLLMResult>
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `llmUpdates` | `Partial<LLMConfig>` | LLM configuration updates |
| `sessionId` | `string` | (Optional) Target session ID |

**Returns:** `Promise<SwitchLLMResult>` with properties:
- `success: boolean`
- `config?: LLMConfig`
- `message?: string`
- `warnings?: string[]`
- `errors?: Array<{...}>`

```typescript
const result = await agent.switchLLM({ 
  provider: 'anthropic', 
  model: 'claude-3-opus-20240229' 
});
```

### `getCurrentLLMConfig`

Returns the current LLM configuration for the default session.

```typescript
getCurrentLLMConfig(): LLMConfig
```

**Returns:** `LLMConfig`

### `getEffectiveConfig`

Gets the complete effective configuration for a session or the default configuration.

```typescript
getEffectiveConfig(sessionId?: string): Readonly<AgentConfig>
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `sessionId` | `string` | (Optional) Session ID |

**Returns:** `Readonly<AgentConfig>`

---

## MCP Server Management

### `connectMcpServer`

Connects to a new MCP server and adds it to the agent's available tools.

```typescript
async connectMcpServer(name: string, config: McpServerConfig): Promise<void>
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | Server name |
| `config` | `McpServerConfig` | Server configuration |

### `removeMcpServer`

Disconnects from an MCP server and removes its tools from the agent.

```typescript
async removeMcpServer(name: string): Promise<void>
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | Server name to remove |

### `executeMcpTool`

Directly executes a tool from any connected MCP server.

```typescript
async executeMcpTool(toolName: string, args: any): Promise<any>
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `toolName` | `string` | Tool name |
| `args` | `any` | Tool arguments |

**Returns:** `Promise<any>` - Tool execution result

### `getAllMcpTools`

Returns a map of all available tools from all connected MCP servers.

```typescript
async getAllMcpTools(): Promise<Record<string, ToolDefinition>>
```

**Returns:** `Promise<Record<string, ToolDefinition>>`

### `getMcpClients`

Returns a map of all connected MCP client instances.

```typescript
getMcpClients(): Map<string, IMCPClient>
```

**Returns:** `Map<string, IMCPClient>`

### `getMcpFailedConnections`

Returns a record of failed MCP server connections and their error messages.

```typescript
getMcpFailedConnections(): Record<string, string>
```

**Returns:** `Record<string, string>` - Failed connection names to error messages 