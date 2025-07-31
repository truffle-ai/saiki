# Model Context Protocol (MCP) System

> **[AGENTS - READ THIS DOCUMENT AND KEEP IT UP TO DATE, EVALUATE INCONSISTENCIES AND FLAG THEM]**

The Model Context Protocol integration system for Saiki that manages connections to MCP servers and provides unified access to their tools, prompts, and resources.

## Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        TM[ToolManager]
        AS[ApplicationServices]
    end
    
    subgraph "MCP System"
        MM[MCPManager]
        MC[MCPClient]
        CC[ConnectionCache]
    end
    
    subgraph "MCP Protocol"
        SDK[MCP SDK]
        CL[Client]
        TR[Transport]
    end
    
    subgraph "MCP Servers"
        FS[Filesystem Server]
        GIT[Git Server]
        DB[Database Server]
        WEB[Web Server]
        CUSTOM[Custom Servers]
    end
    
    subgraph "Capabilities"
        TOOLS[Tools]
        PROMPTS[Prompts]
        RESOURCES[Resources]
    end
    
    TM --> MM
    AS --> MM
    MM --> MC
    MM --> CC
    MC --> SDK
    SDK --> CL
    CL --> TR
    TR --> FS
    TR --> GIT
    TR --> DB
    TR --> WEB
    TR --> CUSTOM
    FS --> TOOLS
    GIT --> PROMPTS
    DB --> RESOURCES
```

## Core Components

### MCPManager (`manager.ts`)
**Centralized orchestration** for all MCP server connections and capability management.

**Key Responsibilities:**
- **Client Management**: Register, connect, disconnect MCP clients
- **Resource Discovery**: Cache and provide access to tools, prompts, resources
- **Tool Execution**: Execute MCP tools with confirmation mechanisms
- **Connection Handling**: Strict and lenient connection modes with error tracking
- **Conflict Resolution**: Handle tool name conflicts across servers
- **Dynamic Management**: Runtime addition/removal of MCP servers

**Core Operations:**
```typescript
// Initialize MCP servers from configuration
await mcpManager.initializeFromConfig(serverConfigs, strictMode);

// Access aggregated capabilities from all servers
const tools = await mcpManager.getAllTools();
const prompts = await mcpManager.listAllPrompts();
const resources = await mcpManager.listAllResources();

// Dynamic server management
await mcpManager.connectClient('git-server', gitConfig);
await mcpManager.disconnectClient('git-server');
```

*See [`manager.ts`](./manager.ts) for complete API*

### MCPClient (`mcp-client.ts`)
Individual server connection handler implementing the IMCPClient interface.

**Key Responsibilities:**
- Connection management for single MCP server
- Transport abstraction (stdio, HTTP, SSE)
- Capability exposure (tools, prompts, resources)
- Protocol compliance and error handling

**Transport Support:**
```mermaid
graph LR
    subgraph "MCPClient"
        CM[Connection Manager]
        TH[Transport Handler]
    end
    
    subgraph "Transport Types"
        STDIO[STDIO Transport]
        HTTP[HTTP Transport]
        SSE[SSE Transport]
    end
    
    subgraph "Server Processes"
        SP[Server Process]
        HS[HTTP Server]
        ES[Event Stream]
    end
    
    CM --> TH
    TH --> STDIO
    TH --> HTTP
    TH --> SSE
    STDIO --> SP
    HTTP --> HS
    SSE --> ES
```

### Interface Types (`types.ts`)
Type definitions for MCP client contracts and capability interfaces.

**Core Interfaces:**
Individual MCP clients implement a standard interface for connection management and capability access.

*See [`types.ts`](./types.ts) for complete interface definitions*

## Key Design Principles

### 1. Unified Capability Management
```mermaid
graph TB
    subgraph "MCPManager Aggregation"
        TC[Tool Cache]
        PC[Prompt Cache]
        RC[Resource Cache]
        CM[Conflict Management]
    end
    
    subgraph "MCP Servers"
        S1[Server 1<br/>Tools: A, B]
        S2[Server 2<br/>Tools: B, C]
        S3[Server 3<br/>Prompts: X, Y]
    end
    
    subgraph "Resolution"
        UT[Unified Tools<br/>A, server1--B, server2--C]
        UP[Unified Prompts<br/>X, Y]
        UR[Unified Resources]
    end
    
    S1 --> TC
    S2 --> TC
    S3 --> PC
    TC --> CM
    CM --> UT
    PC --> UP
    RC --> UR
```

### 2. Tool Name Conflict Resolution
Automatic prefixing for conflicting tool names:
- Unique tools: `filesystem_read` (no prefix)
- Conflicting tools: `git--status`, `system--status` (server prefixed with `--`)

### 3. Connection Management Modes
- **Strict Mode**: All servers must connect successfully
- **Lenient Mode**: Continue with partial server failures
- **Runtime Management**: Dynamic server addition/removal

### 4. Caching and Performance
Efficient capability lookup with cached mappings:
- Tool-to-client mapping for direct execution routing
- Server-tool mapping for organization and conflict resolution

## MCP Server Configuration

### Configuration Format
```yaml
# agent.yml
mcpServers:
  filesystem:
    command: mcp-filesystem
    args: ["/home/user"]
    env:
      DEBUG: "1"
    
  git:
    command: mcp-git
    args: ["--repo", "."]
    
  database:
    command: mcp-database
    args: ["--connection", "postgresql://localhost/db"]
    
  web:
    transport: http
    url: "http://localhost:8080/mcp"
    
  events:
    transport: sse
    url: "http://localhost:8081/events"
```

### Transport Types

See `docs/architecture/mcp/transports.md` for diagrams and details.

graph LR
    subgraph "STDIO Transport"
        SC[Server Command]
        SP[Server Process]
        SIO[Stdin/Stdout]
    end
    
    subgraph "HTTP Transport"
        HU[HTTP URL]
        HS[HTTP Server]
        HR[HTTP Requests]
    end
    
    subgraph "SSE Transport"
        SU[SSE URL]
        ES[Event Stream]
        EV[Server Events]
    end
    
    SC --> SP
    SP --> SIO
    HU --> HS
    HS --> HR
    SU --> ES
    ES --> EV
```

## Usage Patterns

### Basic Server Management
```typescript
const mcpManager = new MCPManager();

// Initialize from configuration
await mcpManager.initializeFromConfig({
    filesystem: { command: 'mcp-filesystem' },
    git: { command: 'mcp-git' }
});

// Get all available tools
const tools = await mcpManager.getAllTools();
console.log('Available tools:', Object.keys(tools));

// Execute a tool
const result = await mcpManager.executeTool('filesystem_read', {
    path: '/etc/hosts'
});
```

### Dynamic Server Management
```typescript
// Add server at runtime
const gitClient = new MCPClient();
mcpManager.registerClient('git', gitClient);
await mcpManager.connectClient('git', {
    command: 'mcp-git',
    args: ['--repo', process.cwd()]
});

// Remove server
await mcpManager.disconnectClient('git');
```

### Prompt and Resource Access
```typescript
// List all prompts from connected servers
const prompts = await mcpManager.listAllPrompts();

// Get specific prompt with arguments
const prompt = await mcpManager.getPrompt('code_review', {
    language: 'typescript',
    style: 'detailed'
});

// List and read resources
const resources = await mcpManager.listAllResources();
const content = await mcpManager.readResource('file:///etc/config.json');
```

### Error Handling and Resilience
```typescript
// Lenient initialization (continue with failures)
await mcpManager.initializeFromConfig(configs, false);

// Check connection status
const connectedClients = mcpManager.getConnectedClients();
const connectionErrors = mcpManager.getConnectionErrors();

// Retry failed connections
for (const [serverName, error] of Object.entries(connectionErrors)) {
    console.log(`Server ${serverName} failed: ${error}`);
    // Implement retry logic
}
```

## Tool Execution Flow

```mermaid
sequenceDiagram
    participant TM as ToolManager
    participant MM as MCPManager
    participant MC as MCPClient
    participant CP as ConfirmationProvider
    participant MS as MCP Server

    TM->>MM: executeTool(toolName, args)
    MM->>MM: resolveToolClient(toolName)
    MM->>CP: requestConfirmation(toolName, args)
    CP->>MM: confirmationResponse(approved)
    
    alt Tool Execution Approved
        MM->>MC: executeTool(toolName, args)
        MC->>MS: call_tool(name, args)
        MS->>MC: tool_result
        MC->>MM: executionResult
        MM->>TM: toolResult
    else Tool Execution Denied
        MM->>TM: executionDenied
    end
```

## Capability Discovery Flow

```mermaid
sequenceDiagram
    participant MM as MCPManager
    participant MC as MCPClient
    participant MS as MCP Server
    participant Cache as Cache

    MM->>MC: connect(config, serverName)
    MC->>MS: initialize
    MS->>MC: connection_established
    
    MM->>MC: listTools()
    MC->>MS: list_tools
    MS->>MC: tools_list
    MC->>MM: tools_array
    MM->>Cache: updateToolCache(serverName, tools)
    
    MM->>MC: listPrompts()
    MC->>MS: list_prompts
    MS->>MC: prompts_list
    MC->>MM: prompts_array
    MM->>Cache: updatePromptCache(serverName, prompts)
    
    MM->>MC: listResources()
    MC->>MS: list_resources
    MS->>MC: resources_list
    MC->>MM: resources_array
    MM->>Cache: updateResourceCache(serverName, resources)
```

## Advanced Features

### Tool Name Conflict Resolution
```typescript
// Automatic conflict detection and resolution
const conflictingTools = new Set(['status', 'list', 'info']);

// Server 1 provides: status, list, info
// Server 2 provides: status, clone, push
// Result:
// - git--status, git--list, git--info (server1)
// - system--status, clone, push (server2)

const tools = await mcpManager.getAllTools();
// Returns: { 'git--status': {...}, 'system--status': {...}, 'clone': {...} }
```

### Connection State Management

See `docs/architecture/mcp/transports.md` for details.

```typescript
interface ConnectionState {
    connected: boolean;
    lastConnected?: Date;
    lastError?: string;
    retryCount: number;
    capabilities: {
        tools: string[];
        prompts: string[];
        resources: string[];
    };
}

// Access connection state
const state = mcpManager.getConnectionState('filesystem');
console.log(`Filesystem server: ${state.connected ? 'Connected' : 'Disconnected'}`);
```

### Custom Transport Implementation
```typescript
class CustomMCPClient implements IMCPClient {
    async connect(config: McpServerConfig): Promise<Client> {
        // Custom connection logic
        const transport = new CustomTransport(config);
        return new Client({ name: 'custom-client' }, { transport });
    }
    
    async listTools(): Promise<string[]> {
        const client = await this.getConnectedClient();
        const result = await client.listTools();
        return result.tools.map(tool => tool.name);
    }
    
    // ... implement other methods
}
```

## Related Modules

- [`tools`](../tools/README.md) - Tool execution
- [`config`](../config/README.md) - MCP configuration
- [`events`](../events/README.md) - Event integration

## Testing

The MCP system has comprehensive test coverage:

### Manager Tests (`manager.test.ts`) - 26 tests
- **Client Registration**: Server registration and conflict detection
- **Connection Management**: Connect/disconnect lifecycle with error handling
- **Tool Execution**: Tool resolution, confirmation, and execution flow
- **Capability Caching**: Tool, prompt, and resource cache management
- **Conflict Resolution**: Tool name conflict detection and prefixing
- **Error Handling**: Connection failures and recovery scenarios

## Future Architecture

This design supports future enhancements:
- **Connection Pooling**: Efficient connection reuse and management
- **Load Balancing**: Distribute requests across multiple server instances
- **Health Monitoring**: Server health checks and automatic failover
- **Capability Versioning**: Support for evolving MCP server capabilities
- **Streaming Support**: Real-time capability updates and streaming responses