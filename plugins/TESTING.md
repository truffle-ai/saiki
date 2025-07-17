# Testing the Saiki Plugin System

This guide shows you how to test that plugins are working correctly in your Saiki agent.

## Important: Plugin Interface Implementation

**All plugins must implement the `IPlugin` interface explicitly.** The plugin system now requires TypeScript plugins that properly implement the interface contracts:

```typescript
import { BasePlugin } from '../src/core/plugins/base.js';
import type { IPlugin, PluginHooks } from '../src/core/plugins/types.js';

export default class MyPlugin extends BasePlugin implements IPlugin {
    public readonly name = 'my-plugin';
    public readonly version = '1.0.0';
    public readonly hooks: PluginHooks = {
        beforeToolCall: this.beforeToolCall.bind(this),
    };
    
    // Implementation required by IPlugin interface
    protected async onInitialize(): Promise<void> { /* ... */ }
    protected async onCleanup(): Promise<void> { /* ... */ }
}
```

This ensures type safety, proper error handling, and consistent plugin behavior.

## Quick Test Setup

### 1. Create a Test Agent Configuration

Create a test `agent.yml` with plugins enabled:

```yaml
# test-agent-with-plugins.yml
systemPrompt: "You are a helpful AI assistant. Your tool usage is monitored by plugins."

llm:
  provider: openai
  model: gpt-4o
  apiKey: $OPENAI_API_KEY
  router: vercel

mcpServers:
  filesystem:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - .

# Plugin configuration
plugins:
  - name: "audit-logger"
    path: "./plugins/audit-logger.ts"
    enabled: true
    priority: 10
    config:
      logLevel: "info"
      outputPath: "./logs/audit.log"
      
  - name: "tool-filter"
    path: "./plugins/tool-filter.ts"
    enabled: true
    priority: 20
    config:
      mode: "allow"
      allowedTools:
        - "read_file"
        - "write_file"
        - "list_directory"

storage:
  cache:
    type: in-memory
  database:
    type: sqlite
    path: ./test-data/test.db

sessions:
  maxSessions: 10
  sessionTTL: 3600000
```

### 2. Start Saiki with Plugin Configuration

```bash
# Start Saiki with the plugin configuration
npx saiki --config test-agent-with-plugins.yml

# Or if running from source
npm run start -- --config test-agent-with-plugins.yml
```

### 3. Watch for Plugin Loading Messages

When Saiki starts, you should see plugin loading messages in the logs:

```
[INFO] Loading 2 plugin(s)
[INFO] Plugin 'audit-logger' loaded successfully in 45ms
[INFO] Plugin 'tool-filter' loaded successfully in 23ms
[INFO] Plugin manager initialized with 2 active plugin(s)
[INFO] AuditLogger plugin initialized with logLevel: info
[INFO] ToolFilter plugin initialized with mode: allow
```

## Testing Plugin Functionality

### Test 1: Audit Logger Plugin

The audit logger should log all tool calls:

```bash
# Ask Saiki to read a file
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Can you read the package.json file and tell me the version?"}'
```

**Expected behavior:**
- Tool call should execute normally
- You should see audit log entries in the logs:
  ```
  [INFO] [AuditLogger] Tool call started: read_file
  [INFO] [AUDIT] {"timestamp":"2025-07-17T12:34:56.789Z","eventType":"tool_call_start",...}
  [INFO] [AuditLogger] Tool call completed: read_file
  [INFO] [AUDIT] {"timestamp":"2025-07-17T12:34:57.123Z","eventType":"tool_call_complete",...}
  ```

### Test 2: Tool Filter Plugin (Allow Mode)

Test that only allowed tools work:

```bash
# This should work (read_file is in allowedTools)
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Read the README.md file"}'

# This should be blocked if using a tool not in allowedTools
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Search the web for information about AI"}'
```

**Expected behavior:**
- Allowed tools execute normally with log: `[ToolFilter] Allowing tool call: read_file`
- Blocked tools fail with error: `[ToolFilter] Blocking tool call: web_search`

### Test 3: Tool Filter Plugin (Deny Mode)

Update your config to test deny mode:

```yaml
plugins:
  - name: "tool-filter"
    path: "./plugins/tool-filter.ts"
    enabled: true
    priority: 20
    config:
      mode: "deny"
      deniedTools:
        - "write_file"
        - "delete_file"
```

Restart Saiki and test:

```bash
# This should work (read_file not in deniedTools)
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Read the package.json file"}'

# This should be blocked (write_file is in deniedTools)
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Create a new file called test.txt with the content Hello World"}'
```

## Testing with Web UI

If using the web UI:

1. **Start Saiki Web Mode:**
   ```bash
   npx saiki web --config test-agent-with-plugins.yml
   ```

2. **Open browser to `http://localhost:3000`**

3. **Test Tool Interactions:**
   - Ask: "Can you list the files in the current directory?"
   - Ask: "Read the package.json file"
   - Ask: "Create a new file" (should be blocked if write_file is denied)

4. **Watch Browser Console and Terminal:**
   - Browser: Check Network tab for API responses
   - Terminal: Watch for plugin log messages

## Debugging Plugin Issues

### Check Plugin Loading

If plugins aren't loading, check for these common issues:

```bash
# Verify plugin files exist
ls -la ./plugins/

# Check file permissions
chmod +r ./plugins/*.ts

# Verify paths in config are correct
cat test-agent-with-plugins.yml | grep -A 10 "plugins:"
```

### Enable Debug Logging

Add debug logging to see more details:

```yaml
# In your agent.yml, add debug config
plugins:
  - name: "audit-logger"
    path: "./plugins/audit-logger.ts"
    enabled: true
    priority: 10
    config:
      logLevel: "debug"  # Enable debug logs
```

### Test Plugin Loading Programmatically

Create a simple test script:

```javascript
// test-plugins.js
import { PluginManager } from './src/core/plugins/manager.js';
import { logger } from './src/core/logger/index.js';

const mockContext = {
  agentEventBus: {},
  logger,
  mcpManager: {},
  promptManager: {},
  stateManager: {}
};

const pluginManager = new PluginManager(mockContext);

const testConfig = {
  name: 'audit-logger',
  path: './plugins/audit-logger.ts',
  enabled: true,
  config: { logLevel: 'debug' }
};

try {
  console.log('Testing plugin loading...');
  const result = await pluginManager.loadPlugin(testConfig);
  console.log('Plugin load result:', result);
  
  await pluginManager.initializePlugins();
  console.log('Plugin initialization complete');
  
  console.log('Active plugins:', pluginManager.getActivePluginCount());
} catch (error) {
  console.error('Plugin test failed:', error);
}
```

Run the test:
```bash
node test-plugins.js
```

## Expected Log Output

When everything is working correctly, you should see logs like:

```
[2025-07-17T12:34:56.789Z] [INFO] PluginManager initialized
[2025-07-17T12:34:56.790Z] [INFO] Loading 2 plugin(s)
[2025-07-17T12:34:56.835Z] [DEBUG] Loading plugin: audit-logger from ./plugins/audit-logger.js
[2025-07-17T12:34:56.845Z] [INFO] Plugin 'audit-logger' loaded successfully in 45ms
[2025-07-17T12:34:56.846Z] [DEBUG] Loading plugin: tool-filter from ./plugins/tool-filter.js
[2025-07-17T12:34:56.856Z] [INFO] Plugin 'tool-filter' loaded successfully in 23ms
[2025-07-17T12:34:56.857Z] [INFO] Loaded 2 active plugins
[2025-07-17T12:34:56.858Z] [INFO] Initializing loaded plugins
[2025-07-17T12:34:56.859Z] [INFO] AuditLogger plugin initialized with logLevel: info
[2025-07-17T12:34:56.860Z] [INFO] ToolFilter plugin initialized with mode: allow
[2025-07-17T12:34:56.861Z] [INFO] Initialized 2 plugins

# During tool execution:
[2025-07-17T12:35:15.123Z] [DEBUG] Executing hook 'beforeToolCall' across 2 plugins
[2025-07-17T12:35:15.124Z] [DEBUG] Executing hook 'beforeToolCall' for plugin 'audit-logger'
[2025-07-17T12:35:15.125Z] [INFO] [AuditLogger] Tool call started: read_file
[2025-07-17T12:35:15.126Z] [DEBUG] Executing hook 'beforeToolCall' for plugin 'tool-filter'
[2025-07-17T12:35:15.127Z] [DEBUG] [ToolFilter] Allowing tool call: read_file
[2025-07-17T12:35:15.128Z] [DEBUG] Hook 'beforeToolCall' execution completed in 5ms
[2025-07-17T12:35:15.200Z] [DEBUG] Executing hook 'afterToolCall' across 2 plugins
[2025-07-17T12:35:15.201Z] [INFO] [AuditLogger] Tool call completed: read_file
```

## Troubleshooting

### Common Issues:

1. **Plugin not loading:**
   - Check file path is relative to config directory
   - Verify plugin file exists and is readable
   - Check plugin exports default class

2. **Plugin loads but doesn't execute:**
   - Verify plugin implements required hooks
   - Check plugin priority order
   - Look for plugin errors in logs

3. **Hooks not being called:**
   - Verify integration with VercelLLMService
   - Check that tools are being executed through the LLM service
   - Ensure plugin manager is passed to LLM service

4. **Plugin errors:**
   - Check plugin configuration is valid
   - Verify plugin has access to required context services
   - Look for JavaScript/TypeScript errors in plugin code

## TypeScript Plugin Development

### Why TypeScript Plugins Are Recommended

All plugins should be written in TypeScript and implement the `IPlugin` interface properly:

```typescript
import { BasePlugin } from '../src/core/plugins/base.js';
import type { IPlugin, PluginHooks } from '../src/core/plugins/types.js';

export default class MyPlugin extends BasePlugin implements IPlugin {
    public readonly name = 'my-plugin';
    public readonly version = '1.0.0';
    public readonly hooks: PluginHooks = {
        beforeToolCall: this.beforeToolCall.bind(this),
    };

    protected async onInitialize(): Promise<void> {
        // Plugin initialization
    }

    private async beforeToolCall(context: ToolCallHookContext): Promise<HookResult> {
        // Hook implementation
        return this.createHookResult(true, undefined, undefined, 'Success');
    }
}
```

### Benefits of TypeScript Plugins

1. **Type Safety**: Catch errors at compile time, not runtime
2. **Interface Contracts**: Explicit implementation of `IPlugin` interface
3. **IDE Support**: Better autocomplete and error detection
4. **Documentation**: Types serve as documentation
5. **Refactoring**: Safe refactoring with type checking

### Plugin Compilation

The plugin system automatically compiles TypeScript files:

- `.ts` files are compiled to `.js` in `.saiki/plugins/` directory
- TypeScript compiler is loaded dynamically when needed
- Compilation happens on plugin load, not at build time
- Compiled files are cached for performance

### Setting Up TypeScript for Plugins

1. **Install TypeScript** (if not already installed):
   ```bash
   npm install typescript
   ```

2. **Create your plugin in TypeScript**:
   ```typescript
   // plugins/my-plugin.ts
   import { BasePlugin } from '../src/core/plugins/base.js';
   import type { IPlugin, PluginHooks } from '../src/core/plugins/types.js';

   export default class MyPlugin extends BasePlugin implements IPlugin {
       // Implementation
   }
   ```

3. **Reference in config**:
   ```yaml
   plugins:
     - name: "my-plugin"
       path: "./plugins/my-plugin.ts"  # Use .ts extension
   ```

### Common TypeScript Plugin Patterns

```typescript
// Type-safe configuration
interface MyPluginConfig {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    enableMetrics: boolean;
    customSettings?: Record<string, any>;
}

export default class MyPlugin extends BasePlugin implements IPlugin {
    private config!: MyPluginConfig;

    protected async onInitialize(): Promise<void> {
        const rawConfig = this.getConfig() as MyPluginConfig;
        this.config = {
            logLevel: rawConfig?.logLevel ?? 'info',
            enableMetrics: rawConfig?.enableMetrics ?? true,
            customSettings: rawConfig?.customSettings ?? {},
        };
    }
}
```

Use this guide to verify your plugin system is working correctly!