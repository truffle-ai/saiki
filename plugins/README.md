# Saiki Plugin System

The Saiki plugin system allows you to extend and customize the agent's behavior at key points in the workflow. Plugins can intercept tool calls, modify LLM responses, and react to session lifecycle events.

## Plugin Architecture

### Core Concepts

- **Plugins**: JavaScript/TypeScript modules that implement the `IPlugin` interface
- **Hooks**: Specific points in the agent workflow where plugins can execute
- **Plugin Manager**: Loads, manages, and executes plugins
- **Hook Executor**: Runs plugin hooks in priority order

### Available Hooks

#### Tool Execution Hooks
- `beforeToolCall`: Called before a tool is executed
- `afterToolCall`: Called after a tool is executed

#### LLM Response Hooks (Coming Soon)
- `beforeLLMRequest`: Called before sending a request to the LLM
- `afterLLMResponse`: Called after receiving a response from the LLM

#### Session Lifecycle Hooks
- `onSessionStart`: Called when a session is created
- `onSessionEnd`: Called when a session ends

## Creating a Plugin

### IPlugin Interface

All plugins must implement the `IPlugin` interface, which requires:

- **name**: Unique plugin identifier (must match config)
- **version**: Plugin version string
- **hooks**: Object containing hook implementations
- **initialize(context, config)**: Setup method called when plugin loads
- **cleanup()**: Teardown method called when plugin unloads

Optional properties:
- **description**: Human-readable description
- **configSchema**: JSON schema for configuration validation

### Basic Plugin Structure (JavaScript)

```javascript
/**
 * @implements {IPlugin}
 */
export default class MyPlugin {
    // Required properties
    name = 'my-plugin';
    version = '1.0.0';
    description = 'Description of what the plugin does';
    
    // Hook implementations
    hooks = {
        beforeToolCall: this.beforeToolCall.bind(this),
        afterToolCall: this.afterToolCall.bind(this),
        onSessionStart: this.onSessionStart.bind(this),
        onSessionEnd: this.onSessionEnd.bind(this)
    };

    // Required methods
    async initialize(context, config) {
        this.context = context;
        this.config = config || {};
        // Plugin initialization logic
    }

    async cleanup() {
        // Plugin cleanup logic
    }

    // Hook implementations
    async beforeToolCall(context) {
        // Hook implementation
        return {
            continue: true,
            modifiedData: context.args, // Optional: modify the arguments
            message: 'Optional message for logging'
        };
    }
}
```

### TypeScript Plugin Structure

```typescript
import { BasePlugin } from '../src/core/plugins/base.js';
import type { 
    IPlugin, 
    PluginHooks, 
    ToolCallHookContext,
    HookResult 
} from '../src/core/plugins/types.js';

export default class MyPlugin extends BasePlugin implements IPlugin {
    public readonly name = 'my-plugin';
    public readonly version = '1.0.0';
    public readonly description = 'TypeScript plugin example';
    
    public readonly hooks: PluginHooks = {
        beforeToolCall: this.beforeToolCall.bind(this),
    };

    protected async onInitialize(): Promise<void> {
        // Plugin initialization logic
    }

    protected async onCleanup(): Promise<void> {
        // Plugin cleanup logic
    }

    private async beforeToolCall(context: ToolCallHookContext): Promise<HookResult> {
        return this.createHookResult(
            true, // continue
            context.args, // data
            undefined, // error
            'Tool call processed'
        );
    }
}
```

### Plugin Context

Every hook receives a context object with access to:

```javascript
{
    sessionId: string,           // Current session ID
    sessionEventBus: EventBus,   // Session-scoped event bus
    agentEventBus: EventBus,     // Agent-level event bus
    logger: Logger,              // Logger instance
    mcpManager: MCPManager,      // MCP manager for tool access
    promptManager: PromptManager, // System prompt manager
    stateManager: StateManager   // Agent state manager
}
```

### Hook Context Types

#### Tool Call Context
```javascript
{
    toolName: string,      // Name of the tool being called
    args: object,          // Arguments passed to the tool
    callId?: string,       // Optional call ID for tracking
    ...baseContext
}
```

#### Tool Result Context
```javascript
{
    toolName: string,      // Name of the tool that was called
    args: object,          // Arguments that were passed
    result: any,           // Result from the tool
    success: boolean,      // Whether the call succeeded
    callId?: string,       // Optional call ID for tracking
    ...baseContext
}
```

## Hook Return Values

### Standard Hook Result
```javascript
{
    continue: boolean,     // Whether to continue execution
    modifiedData?: any,    // Modified data to use instead of original
    error?: Error,         // Error to throw
    message?: string       // Message for logging
}
```

### Hook Behaviors

- **Continue**: Return `{ continue: true }` to proceed normally
- **Modify**: Return `{ continue: true, modifiedData: newData }` to modify the data
- **Block**: Return `{ continue: false }` to stop execution
- **Error**: Return `{ continue: false, error: new Error('...') }` to throw an error

## Configuration

### Agent Configuration (agent.yml)

```yaml
plugins:
  - name: "my-plugin"
    path: "./plugins/my-plugin.js"
    enabled: true
    priority: 50
    config:
      # Plugin-specific configuration
      key: value
```

### Plugin Options

- `name`: Must match the plugin's name property
- `path`: Relative path to the plugin file
- `enabled`: Whether the plugin is enabled
- `priority`: Load/execution priority (lower numbers execute first)
- `config`: Plugin-specific configuration object

## Example Plugins

### Audit Logger Plugin

Logs all tool calls and responses for audit purposes:

```javascript
export default class AuditLoggerPlugin {
    // ... (see plugins/audit-logger.js for full implementation)
    
    async beforeToolCall(context) {
        this.logAuditEvent('tool_call_start', {
            sessionId: context.sessionId,
            toolName: context.toolName,
            args: context.args
        });
        
        return { continue: true };
    }
}
```

### Tool Filter Plugin

Filters tool calls based on allow/deny lists:

```javascript
export default class ToolFilterPlugin {
    // ... (see plugins/tool-filter.js for full implementation)
    
    async beforeToolCall(context) {
        if (!this.isToolAllowed(context.toolName)) {
            return {
                continue: false,
                error: new Error(`Tool '${context.toolName}' is not allowed`)
            };
        }
        
        return { continue: true };
    }
}
```

## Best Practices

1. **Error Handling**: Always wrap plugin logic in try-catch blocks
2. **Performance**: Keep hook execution fast to avoid blocking the agent
3. **Logging**: Use the provided logger for consistent logging
4. **Configuration**: Use the config object for plugin customization
5. **State Management**: Store plugin state in the plugin instance
6. **Cleanup**: Properly clean up resources in the cleanup method

## Security Considerations

- Plugins run in the same process as the agent
- Plugins have access to all agent services
- Use proper input validation in plugin hooks
- Consider sandboxing for untrusted plugins

## Debugging

- Use the logger for debugging output
- Check plugin states via the plugin manager
- Monitor hook execution order and results
- Use the audit logger plugin for detailed execution traces

## Future Enhancements

- LLM request/response hooks
- Plugin dependency management
- Plugin marketplace integration
- Advanced security and sandboxing
- Plugin configuration UI