---
sidebar_position: 3
---

# Events Reference

Complete event system documentation for monitoring and integrating with Saiki agents.

## Overview

The Saiki SDK provides a comprehensive event system through two main event buses:
- **AgentEventBus**: Agent-level events that occur across the entire agent instance
- **SessionEventBus**: Session-specific events that occur within individual conversation sessions

## Agent-Level Events

These events are emitted by the `AgentEventBus` and provide insight into agent-wide operations.

### Conversation Events

#### `saiki:conversationReset`

Fired when a conversation history is reset for a session.

```typescript
{
  sessionId: string;
}
```

**Example:**
```typescript
agent.agentEventBus.on('saiki:conversationReset', (data) => {
  console.log(`Conversation reset for session: ${data.sessionId}`);
});
```

### MCP Server Events

#### `saiki:mcpServerConnected`

Fired when an MCP server connection attempt completes (success or failure).

```typescript
{
  name: string;
  success: boolean;
  error?: string;
}
```

#### `saiki:mcpServerAdded`

Fired when an MCP server is added to the runtime state.

```typescript
{
  serverName: string;
  config: McpServerConfig;
}
```

#### `saiki:mcpServerRemoved`

Fired when an MCP server is removed from the runtime state.

```typescript
{
  serverName: string;
}
```

#### `saiki:mcpServerUpdated`

Fired when an MCP server configuration is updated.

```typescript
{
  serverName: string;
  config: McpServerConfig;
}
```

#### `saiki:availableToolsUpdated`

Fired when the available tools list is updated.

```typescript
{
  tools: string[];
  source: 'mcp' | 'builtin';
}
```

### Validation Events

#### `saiki:inputValidationFailed`

Fired when input validation fails for an LLM request.

```typescript
{
  sessionId: string;
  issues: Issue[];
  provider: string;
  model: string;
}
```

**Example:**
```typescript
agent.agentEventBus.on('saiki:inputValidationFailed', (data) => {
  console.log(`Input validation failed for ${data.provider}/${data.model} in session ${data.sessionId}`);
  data.issues.forEach(issue => {
    console.log(`  - ${issue.severity}: ${issue.message}`);
  });
});
```

### Configuration Events

#### `saiki:llmSwitched`

Fired when the LLM configuration is changed.

```typescript
{
  newConfig: LLMConfig;
  router?: string;
  historyRetained?: boolean;
  sessionIds: string[];
}
```

#### `saiki:stateChanged`

Fired when agent runtime state changes.

```typescript
{
  field: string; // keyof AgentRuntimeState
  oldValue: any;
  newValue: any;
  sessionId?: string;
}
```

#### `saiki:stateExported`

Fired when agent state is exported as configuration.

```typescript
{
  config: AgentConfig;
  runtimeSettings: any;
}
```

#### `saiki:stateReset`

Fired when agent state is reset to baseline.

```typescript
{
  toConfig: AgentConfig;
}
```

### Session Override Events

#### `saiki:sessionOverrideSet`

Fired when session-specific configuration is set.

```typescript
{
  sessionId: string;
  override: SessionOverride;
}
```

#### `saiki:sessionOverrideCleared`

Fired when session-specific configuration is cleared.

```typescript
{
  sessionId: string;
}
```

---

## Session-Level Events

These events are emitted by the `SessionEventBus` and provide insight into LLM service operations within sessions.

### LLM Processing Events

#### `llmservice:thinking`

Fired when the LLM service starts processing a request.

```typescript
{
  sessionId: string;
}
```

#### `llmservice:response`

Fired when the LLM service completes a response.

```typescript
{
  content: string;
  tokenCount?: number;
  model?: string;
  sessionId: string;
}
```

#### `llmservice:chunk`

Fired when a streaming response chunk is received.

```typescript
{
  content: string;
  isComplete?: boolean;
  sessionId: string;
}
```

#### `llmservice:error`

Fired when the LLM service encounters an error.

```typescript
{
  error: Error;
  context?: string;
  recoverable?: boolean;
  sessionId: string;
}
```

#### `llmservice:switched`

Fired when session LLM configuration is changed.

```typescript
{
  newConfig: LLMConfig;
  router?: string;
  historyRetained?: boolean;
  sessionId: string;
}
```

### Tool Execution Events

#### `llmservice:toolCall`

Fired when the LLM service requests a tool execution.

```typescript
{
  toolName: string;
  args: Record<string, any>;
  callId?: string;
  sessionId: string;
}
```

#### `llmservice:toolResult`

Fired when a tool execution completes.

```typescript
{
  toolName: string;
  result: any;
  callId?: string;
  success: boolean;
  sessionId: string;
}
```

---

## Event Usage Patterns

### Basic Event Listening

```typescript
import { SaikiAgent } from '@truffle-ai/saiki';

const agent = new SaikiAgent(config);
await agent.start();

// Listen to agent-level events
agent.agentEventBus.on('saiki:conversationReset', (data) => {
  console.log(`Conversation reset: ${data.sessionId}`);
});

agent.agentEventBus.on('saiki:mcpServerConnected', (data) => {
  if (data.success) {
    console.log(`✅ MCP server '${data.name}' connected`);
  } else {
    console.log(`❌ MCP server '${data.name}' failed: ${data.error}`);
  }
});

// Listen to LLM events
agent.agentEventBus.on('llmservice:thinking', (data) => {
  console.log(`🤔 Agent thinking... (session: ${data.sessionId})`);
});

agent.agentEventBus.on('llmservice:response', (data) => {
  console.log(`💬 Response: ${data.content.substring(0, 100)}...`);
});
```

### Tool Execution Monitoring

```typescript
// Monitor tool executions
agent.agentEventBus.on('llmservice:toolCall', (data) => {
  console.log(`🔧 Executing tool: ${data.toolName}`);
  console.log(`   Arguments:`, data.args);
});

agent.agentEventBus.on('llmservice:toolResult', (data) => {
  if (data.success) {
    console.log(`✅ Tool '${data.toolName}' completed successfully`);
  } else {
    console.log(`❌ Tool '${data.toolName}' failed:`, data.result);
  }
});
```

### Session-Specific Event Handling

```typescript
// Create a session and listen to its events
const session = await agent.createSession('my-session');

// Listen for events from specific session
agent.agentEventBus.on('llmservice:thinking', (data) => {
  if (data.sessionId === 'my-session') {
    console.log('My session is thinking...');
  }
});

agent.agentEventBus.on('llmservice:response', (data) => {
  if (data.sessionId === 'my-session') {
    console.log('My session responded:', data.content);
  }
});
```

### Error Handling

```typescript
// Handle LLM service errors
agent.agentEventBus.on('llmservice:error', (data) => {
  console.error(`LLM Error in session ${data.sessionId}:`, data.error.message);
  
  if (data.recoverable) {
    console.log('Error is recoverable, continuing...');
  } else {
    console.log('Fatal error, may need intervention');
  }
});

// Handle MCP connection failures
agent.agentEventBus.on('saiki:mcpServerConnected', (data) => {
  if (!data.success) {
    console.error(`Failed to connect to MCP server '${data.name}': ${data.error}`);
    // Implement retry logic or fallback behavior
  }
});
```

### Event Cleanup

```typescript
// Using AbortController for cleanup
const controller = new AbortController();

agent.agentEventBus.on('llmservice:response', (data) => {
  console.log('Response received:', data.content);
}, { signal: controller.signal });

// Later, cleanup all listeners
controller.abort();
```

### Standalone Event Bus Usage

```typescript
import { AgentEventBus, SessionEventBus } from '@truffle-ai/saiki';

// Create standalone event buses
const agentBus = new AgentEventBus();
const sessionBus = new SessionEventBus();

// Use them independently
agentBus.on('saiki:llmSwitched', (data) => {
  console.log('LLM configuration changed:', data.newConfig);
});

sessionBus.on('llmservice:thinking', () => {
  console.log('Processing request...');
});

// Emit custom events
agentBus.emit('saiki:conversationReset', { sessionId: 'test-session' });

// Don't forget to clean up when done
// agentBus.removeAllListeners();
// sessionBus.removeAllListeners();
```

---

## Event Data Types

### Core Types

```typescript
interface AgentEventMap {
  'saiki:conversationReset': { sessionId: string };
  'saiki:mcpServerConnected': { name: string; success: boolean; error?: string };
  'saiki:availableToolsUpdated': { tools: string[]; source: string };
  'saiki:llmSwitched': { newConfig: LLMConfig; router?: string; historyRetained?: boolean; sessionIds: string[] };
  // ... other events
}

interface SessionEventMap {
  'llmservice:thinking': { sessionId: string };
  'llmservice:response': { content: string; tokenCount?: number; model?: string; sessionId: string };
  'llmservice:chunk': { content: string; isComplete?: boolean; sessionId: string };
  'llmservice:toolCall': { toolName: string; args: Record<string, any>; callId?: string; sessionId: string };
  'llmservice:toolResult': { toolName: string; result: any; callId?: string; success: boolean; sessionId: string };
  'llmservice:error': { error: Error; context?: string; recoverable?: boolean; sessionId: string };
  // ... other events
}
``` 