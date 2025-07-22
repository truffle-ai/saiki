---
sidebar_position: 1
title: "TypeScript SDK Guide"
---

# TypeScript SDK Guide

Welcome to the Saiki TypeScript/JavaScript SDK guide! This guide provides everything you need to start building powerful AI applications with Saiki.

Whether you're creating standalone agents, integrating with existing applications, or building custom AI workflows, the SDK offers a flexible and robust set of tools.

## Key Features

- **Full TypeScript Support**: Strong typing for better development.

## Core Concepts

The SDK is built around a few core concepts:

- **SaikiAgent**: The main class for creating and managing agents.
- **MCPManager**: A utility for managing MCP server connections.
- **LLMService**: A service for interacting with large language models.
- **StorageBackends**: A set of backends for persisting agent data.

## Example Usage

Here's a quick example of how to create a simple agent that uses the OpenAI API:

```typescript
import { SaikiAgent } from '@truffle-ai/saiki';

const agent = new SaikiAgent({
  llm: {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: process.env.OPENAI_API_KEY,
  },
});

await agent.start();

const response = await agent.run('Hello, world!');
console.log(response);

await agent.stop();
```

For more detailed examples, see the [Examples & Demos](/docs/category/examples--demos) section.

## Overview

The Saiki TypeScript SDK provides a complete library for building AI agents with MCP (Model Context Protocol) integration. It offers both high-level agent abstractions and low-level utilities for maximum flexibility.

### When to Use the SDK vs REST API

**Use the TypeScript SDK when:**
- Building TypeScript/JavaScript applications
- Need real-time event handling
- Want type safety and IDE support
- Require complex session management
- Building long-running applications

**Use the REST API when:**
- Working in other languages
- Building simple integrations
- Prefer stateless interactions
- Working with webhooks or serverless functions

## Installation

```bash
npm install @truffle-ai/saiki
```

## Quick Start

### Basic Agent Setup

```typescript
import { SaikiAgent } from '@truffle-ai/saiki';

// Create agent with minimal configuration
const agent = new SaikiAgent({
  llm: {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY
  }
});
await agent.start();

// Start a conversation
const response = await agent.run('Hello! What can you help me with?');
console.log(response);
```

### Adding MCP Tools

```typescript
const agent = new SaikiAgent({
  llm: {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY
  },
  mcpServers: {
    filesystem: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
    },
    web: {
      type: 'stdio', 
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search']
    }
  }
});
await agent.start();

// Now the agent can use filesystem and web search tools
const response = await agent.run('List the files in this directory and search for recent AI news');
```

## Core Concepts

### Agents vs Sessions

- **Agent**: The main AI system with configuration, tools, and state management
- **Session**: Individual conversation threads within an agent

```typescript
// Create an agent (one per application typically)
const agent = new SaikiAgent(config);
await agent.start();

// Create multiple sessions for different conversations
const userSession = await agent.createSession('user-123');
const adminSession = await agent.createSession('admin-456');

// Each session maintains separate conversation history
await userSession.run('Help me with my account');
await adminSession.run('Show me system metrics');
```

### Event-Driven Architecture

The SDK provides real-time events for monitoring and integration:

```typescript
// Listen to agent-wide events
agent.agentEventBus.on('saiki:mcpServerConnected', (data) => {
  console.log(`✅ Connected to ${data.name}`);
});

// Listen to conversation events
agent.agentEventBus.on('llmservice:thinking', (data) => {
  console.log(`🤔 Agent thinking... (session: ${data.sessionId})`);
});

agent.agentEventBus.on('llmservice:toolCall', (data) => {
  console.log(`🔧 Using tool: ${data.toolName}`);
});
```

## Common Patterns

### Multi-User Chat Application

```typescript
import { SaikiAgent } from '@truffle-ai/saiki';

class ChatApplication {
  private agent: SaikiAgent;
  private userSessions = new Map<string, string>();

  async initialize() {
    this.agent = new SaikiAgent({
      llm: { provider: 'openai', model: 'gpt-4o', apiKey: process.env.OPENAI_API_KEY },
      mcpServers: { /* your tools */ }
    });
    await this.agent.start();

    // Set up event monitoring
    this.agent.agentEventBus.on('llmservice:response', (data) => {
      this.broadcastToUser(data.sessionId, data.content);
    });
  }

  async handleUserMessage(userId: string, message: string) {
    // Get or create session for user
    let sessionId = this.userSessions.get(userId);
    if (!sessionId) {
      const session = await this.agent.createSession(`user-${userId}`);
      sessionId = session.id;
      this.userSessions.set(userId, sessionId);
    }

    // Process message
    return await this.agent.run(message, undefined, sessionId);
  }

  private broadcastToUser(sessionId: string, message: string) {
    // Find user and send response via WebSocket, etc.
  }
}
```

### Dynamic Tool Management

```typescript
class AdaptiveAgent {
  private agent: SaikiAgent;

  async initialize() {
    this.agent = new SaikiAgent(baseConfig);
    await this.agent.start();
  }

  async addCapability(name: string, serverConfig: McpServerConfig) {
    try {
      await this.agent.connectMcpServer(name, serverConfig);
      console.log(`✅ Added ${name} capability`);
    } catch (error) {
      console.error(`❌ Failed to add ${name}:`, error);
    }
  }

  async removeCapability(name: string) {
    await this.agent.removeMcpServer(name);
    console.log(`🗑️ Removed ${name} capability`);
  }

  async listCapabilities() {
    const tools = await this.agent.getAllMcpTools();
    return Object.keys(tools);
  }
}
```

### Session Management with Persistence

```typescript
class PersistentChatBot {
  private agent: SaikiAgent;

  async initialize() {
    this.agent = new SaikiAgent({
      llm: { /* config */ },
      storage: {
        cache: { type: 'redis', url: 'redis://localhost:6379' },
        database: { type: 'postgresql', url: process.env.DATABASE_URL }
      }
    });
    await this.agent.start();
  }

  async resumeConversation(userId: string) {
    const sessionId = `user-${userId}`;
    
    // Check if session exists
    const sessions = await this.agent.listSessions();
    if (sessions.includes(sessionId)) {
      // Load existing session
      await this.agent.loadSession(sessionId);
      const history = await this.agent.getSessionHistory(sessionId);
      return history;
    } else {
      // Create new session
      await this.agent.createSession(sessionId);
      return null;
    }
  }
}
```

## Configuration Options

### LLM Providers

```typescript
// OpenAI
const openaiConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
  maxOutputTokens: 4000
};

// Anthropic
const anthropicConfig = {
  provider: 'anthropic', 
  model: 'claude-3-opus-20240229',
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxIterations: 5
};

// Cohere
const cohereConfig = {
  provider: 'cohere',
  model: 'command-r-plus',
  apiKey: process.env.COHERE_API_KEY,
  temperature: 0.3
};

// Local/Custom OpenAI-compatible
const localConfig = {
  provider: 'openai',
  model: 'llama-3.1-70b',
  apiKey: 'not-needed',
  baseURL: 'http://localhost:8080/v1'
};
```

### Storage Backends

```typescript
// In-memory (development)
const memoryStorage = {
  cache: { type: 'in-memory' },
  database: { type: 'in-memory' }
};

// Production with Redis + PostgreSQL
const productionStorage = {
  cache: { 
    type: 'redis',
    url: 'redis://localhost:6379'
  },
  database: {
    type: 'postgresql', 
    url: process.env.DATABASE_URL
  }
};
```

## Error Handling

### Graceful Degradation

```typescript
const agent = new SaikiAgent(config);
await agent.start();

// Handle MCP connection failures
agent.agentEventBus.on('saiki:mcpServerConnected', (data) => {
  if (!data.success) {
    console.warn(`⚠️ ${data.name} unavailable: ${data.error}`);
    // Continue without this capability
  }
});

// Handle LLM errors
agent.agentEventBus.on('llmservice:error', (data) => {
  if (data.recoverable) {
    console.log('🔄 Retrying request...');
  } else {
    console.error('💥 Fatal error:', data.error);
    // Implement fallback or user notification
  }
});
```

### Validation and Fallbacks

```typescript
try {
  const agent = new SaikiAgent({
    llm: primaryLLMConfig,
    mcpServers: allServers
  });
  await agent.start();
} catch (error) {
  console.warn('⚠️ Full setup failed, using minimal config');
  
  // Fallback to basic configuration
  const agent = new SaikiAgent({
    llm: fallbackLLMConfig,
    mcpServers: {} // No external tools
  });
  await agent.start();
}
```

## Best Practices

### 1. Resource Management

```typescript
// Proper cleanup
const agent = new SaikiAgent(config);
await agent.start();

process.on('SIGTERM', async () => {
  await agent.stop();
  process.exit(0);
});
```

### 2. Session Lifecycle

```typescript
// Set session TTL to manage memory usage (chat history preserved in storage)
const agent = new SaikiAgent({
  // ... other config
  sessions: {
    maxSessions: 1000,
    sessionTTL: 24 * 60 * 60 * 1000 // 24 hours
  }
});
await agent.start();
```

### 3. Monitoring and Observability

```typescript
// Log all tool executions
agent.agentEventBus.on('llmservice:toolCall', (data) => {
  console.log(`[${data.sessionId}] Tool: ${data.toolName}`, data.args);
});

agent.agentEventBus.on('llmservice:toolResult', (data) => {
  if (data.success) {
    console.log(`[${data.sessionId}] ✅ ${data.toolName} completed`);
  } else {
    console.error(`[${data.sessionId}] ❌ ${data.toolName} failed:`, data.result);
  }
});
```

## Next Steps

- **[SaikiAgent API](/api/saiki-agent)** - Detailed method documentation
- **[MCP Guide](/docs/guides/mcp-manager)** - Learn about Model Context Protocol
- **[Deployment Guide](/docs/guides/deployment)** - Production deployment strategies
- **[Examples](/docs/category/examples--demos)** - Complete example applications