---
sidebar_position: 3
---

# Node.js SDK API Reference

Complete technical API reference for the Saiki Node.js SDK. For guides and examples, see the [SDK Guide](/docs/guides/nodejs-sdk).

## Installation

```bash
npm install @truffle-ai/saiki
```

## Core Imports

```typescript
import {
  createSaikiAgent,
  SaikiAgent,
  MCPManager,
  Logger,
  AgentEventBus,
  SessionEventBus,
  createStorageBackends,
  createAgentServices
} from '@truffle-ai/saiki';
```

## API Sections

### [SaikiAgent Class](./saiki-agent)
Complete API reference for the main `SaikiAgent` class:
- Factory function (`createSaikiAgent`)
- Core methods (`run`, session management)
- Configuration management
- MCP server integration

### [Standalone Utilities](./utilities)
Individual classes for modular usage:
- `MCPManager` - MCP server management
- `Logger` - Configurable logging
- `AgentEventBus` & `SessionEventBus` - Event handling
- Storage and service factories

### [Events Reference](./events)
Complete event system specification:
- Agent-level events (`saiki:*`)
- Session-level events (`llmservice:*`)
- Event data structures
- Type definitions

### [TypeScript Types](./types)
Type definitions and interfaces:
- Configuration objects
- Method parameters and return types
- Event payloads
- Utility interfaces 