# Saiki Custom Tools System

This directory demonstrates Saiki's custom tools system, which allows you to create and integrate custom tools alongside MCP servers using a clean, intuitive API.

## Overview

The custom tools system provides:
- **Clean, simple API** for defining tools with minimal boilerplate
- **Automatic tool registration** - tools register themselves when you use `createTool()`
- **YAML configuration** for tool settings
- **Integration with existing MCP tools** - all work together seamlessly
- **Type safety** with full TypeScript support and Zod validation

## Quick Start

### 1. Enable Custom Tools

Add the `customTools` section to your `agent.yml`:

```yaml
customTools:
  globalSettings:
    requiresConfirmation: false
```

### 2. Create Your First Tool

Create a `.ts` file anywhere in your project:

```typescript
// tools/hello.ts
import { createTool } from '@truffle-ai/saiki';
import { z } from 'zod';

export const greetTool = createTool({
    id: 'greet',
    description: 'Greets someone with a friendly message',
    inputSchema: z.object({
        name: z.string().default('World').describe('Name to greet')
    }),
    execute: async ({ name }) => {
        return {
            message: `Hello, ${name}!`,
            timestamp: new Date().toISOString()
        };
    },
    metadata: {
        category: 'social',
        tags: ['greeting', 'social']
    }
});
```

### 3. Use Your Tool

Start your Saiki agent and the tool will be automatically available:

```bash
npx saiki --agent tools/example-agent.yml
```

The AI can now use your custom tool alongside MCP tools!

## Tool Definition Pattern

### Basic Tool Structure

```typescript
import { createTool } from '@truffle-ai/saiki';
import { z } from 'zod';

export const myTool = createTool({
    id: 'tool_name',
    description: 'Tool description',
    inputSchema: z.object({
        param1: z.string().describe('Parameter description'),
        param2: z.number().default(42).describe('Optional parameter')
    }),
    execute: async ({ param1, param2 }) => {
        // Your tool logic here
        return {
            result: 'computed value',
            metadata: { /* optional metadata */ }
        };
    },
    metadata: {
        category: 'category_name',
        tags: ['tag1', 'tag2']
    },
    settings: {
        requiresConfirmation: false,
        timeout: 30000
    }
});
```

### Core Tool Properties

- **`id`** - Unique identifier for the tool
- **`description`** - Human-readable description of what the tool does
- **`inputSchema`** - Zod schema defining input parameters and validation
- **`execute`** - Function that implements the tool logic

### Optional Properties

- **`metadata`** - Discovery and categorization information
- **`settings`** - Execution behavior configuration

## Advanced Features

### Tool Context

Tools receive a context object with useful information:

```typescript
import { ToolExecutionContext } from '@truffle-ai/saiki';

export const contextAwareTool = createTool({
    id: 'context_tool',
    description: 'Tool that uses execution context',
    inputSchema: z.object({
        data: z.string()
    }),
    execute: async ({ data }, context?: ToolExecutionContext) => {
        // Access session ID
        console.log('Session:', context?.sessionId);
        
        // Access event bus (if available)
        context?.eventBus?.emit('custom:event', { data });
        
        // Access storage (if available)
        const stored = await context?.storage?.get('key');
        
        return { result: data, sessionId: context?.sessionId };
    }
});
```

### Error Handling

```typescript
export const robustTool = createTool({
    id: 'robust_tool',
    description: 'Tool with proper error handling',
    inputSchema: z.object({
        input: z.string()
    }),
    execute: async ({ input }) => {
        try {
            // Tool logic
            const result = await processInput(input);
            return { success: true, data: result };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
});
```

### Complex Input Schemas

```typescript
import { z } from 'zod';

export const configTool = createTool({
    id: 'configure',
    description: 'Tool with complex configuration',
    inputSchema: z.object({
        server: z.object({
            host: z.string().url(),
            port: z.number().min(1).max(65535),
            ssl: z.boolean().default(false)
        }),
        options: z.array(z.string()).optional(),
        timeout: z.number().positive().default(30000)
    }),
    execute: async ({ server, options, timeout }) => {
        // Tool logic here
        return { configured: true, server, options };
    }
});
```

## Configuration

### Configuration Structure

```yaml
customTools:
  # Tool filtering options (optional)
  enabledTools: 'all'                    # Enable all tools (default)
  # enabledTools: ['tool1', 'tool2']    # Or enable specific tools only
  
  toolConfigs:                            # Tool-specific overrides
    tool_id:
      requiresConfirmation: true
      timeout: 60000
  globalSettings:                         # Global defaults for all tools
    requiresConfirmation: false
    timeout: 30000
```

### How Tools Work

1. **Create tools** using `createTool()` in your TypeScript files
2. **Tools auto-register** themselves when the code is imported
3. **Configure behavior** via YAML settings
4. **Tools are available** to the AI agent automatically

### Parameters Reference

#### Tool Filtering Options

##### `enabledTools` (string or array, default: 'all')
- **Description**: Enable all tools or a specific list of tool IDs. Set to `'all'` to enable all tools.
- **Example**: `'all'` (enable all), `['add', 'multiply', 'power']` (enable specific)

#### Tool Configuration Options

#### `toolConfigs` (object, optional)
Tool-specific configuration overrides. Keys should match the tool IDs defined in your tool files.

##### Available tool-specific settings:

###### `requiresConfirmation` (boolean, optional)
- **Description**: Override whether this specific tool requires user confirmation
- **Example**: `true` (requires confirmation), `false` (auto-approve)

###### `timeout` (number, optional)
- **Description**: Override execution timeout for this tool (in milliseconds)
- **Example**: `60000` (60 seconds)

#### `globalSettings` (object, optional)
Global settings that apply to all custom tools unless overridden by tool-specific configs.

##### Available global settings:

###### `requiresConfirmation` (boolean, optional)
- **Default**: `false`
- **Description**: Whether tools require confirmation by default
- **Example**: `true` (all tools require confirmation), `false` (auto-approve all tools)

###### `timeout` (number, optional)
- **Default**: `30000` (30 seconds)
- **Description**: Default execution timeout for all tools (in milliseconds)
- **Example**: `60000` (60 seconds), `5000` (5 seconds)


### Configuration Examples

#### Basic Configuration (All Tools Enabled)
```yaml
customTools:
  # No configuration needed - all tools enabled by default
  enabledTools: 'all'  # Default behavior
```

#### Enable Specific Tools Only
```yaml
customTools:
  enabledTools: ['add', 'multiply', 'power']  # Only these tools enabled
```

#### Security-Focused Configuration
```yaml
customTools:
  enabledTools: ['add', 'multiply']      # Only safe tools enabled
  globalSettings:
    requiresConfirmation: true            # Require confirmation for all tools
```



#### Security-Focused Configuration
```yaml
customTools:
  globalSettings:
    requiresConfirmation: true  # All tools require confirmation
    timeout: 10000              # 10 second timeout
```

#### Performance-Focused Configuration
```yaml
customTools:
  globalSettings:
    requiresConfirmation: false  # Auto-approve all tools
    timeout: 60000               # 60 second timeout
```

#### Mixed Security Configuration
```yaml
customTools:
  globalSettings:
    requiresConfirmation: false  # Most tools auto-approve
    timeout: 30000
  toolConfigs:
    dangerous_tool:
      requiresConfirmation: true  # This specific tool requires confirmation
      timeout: 120000             # Longer timeout for this tool
    safe_tool:
      requiresConfirmation: false # Explicitly auto-approve this tool
```

### Tool Registration Process

Tools are automatically registered when:

1. **You use `createTool()`** in your TypeScript files
2. **The file is imported** (either directly or through module resolution)
3. **The tool is added** to the global registry automatically
4. **The agent loads** and applies filtering rules
5. **Filtered tools are available** to the AI agent

### Tool Filtering Logic

The filtering process follows this order:

1. **Start with all registered tools**
2. **If `enabledTools` is `'all'` (default)** → All tools available
3. **If `enabledTools` is a list** → Only explicitly enabled tools available
4. **Apply tool-specific settings** → Override global settings for remaining tools

#### Filtering Examples

```yaml
# Example: Start with tools: [add, power, random, admin_tool, dangerous_tool]

# Enable all tools (default)
customTools:
  enabledTools: 'all'  # All tools available
  # Final available tools: [add, power, random, admin_tool, dangerous_tool]

# Enable specific tools only
customTools:
  enabledTools: ['add', 'power', 'random']  # Only these tools enabled
  # Final available tools: [add, power, random]
```

### Tool-Specific vs Global Settings

Settings follow this precedence order (highest to lowest priority):

1. **Tool-specific settings** in `toolConfigs[tool_id]` (highest priority)
2. **Tool code settings** defined in `tool.settings` 
3. **Global settings** in `globalSettings`
4. **System defaults** (hardcoded fallbacks)

#### Example: Confirmation Requirements

```yaml
# Global settings
customTools:
  globalSettings:
    requiresConfirmation: true  # All tools require confirmation by default
  
  # Tool-specific overrides
  toolConfigs:
    safe_tool:
      requiresConfirmation: false  # This tool auto-approves (overrides global)
    dangerous_tool:
      requiresConfirmation: true   # This tool requires confirmation (uses global)
```

In this example:
- `safe_tool` will **auto-approve** (tool-specific config overrides global)
- `dangerous_tool` will **require confirmation** (uses global setting)
- Any other tools will **require confirmation** (use global setting)

#### Example: Timeout Settings

```yaml
customTools:
  globalSettings:
    timeout: 30000  # 30 seconds default
  
  toolConfigs:
    fast_tool:
      timeout: 5000   # 5 seconds (tool-specific override)
    slow_tool:
      timeout: 120000 # 2 minutes (tool-specific override)
```

In this example:
- `fast_tool` uses **5 second timeout** (tool-specific override)
- `slow_tool` uses **2 minute timeout** (tool-specific override)  
- Other tools use **30 second timeout** (global default)

## Examples

This directory includes example tools:

- **math.ts** - Mathematical operations (add, power, random) using the clean API
- **example-agent.yml** - Complete agent configuration example

### Math Tools Example

```typescript
// tools/math.ts
import { createTool } from '@truffle-ai/saiki';
import { z } from 'zod';

export const addTool = createTool({
    id: 'add',
    description: 'Adds two numbers together',
    inputSchema: z.object({
        a: z.number().describe('First number'),
        b: z.number().describe('Second number')
    }),
    execute: async ({ a, b }) => {
        return {
            result: a + b,
            operation: 'addition',
            operands: [a, b]
        };
    },
    metadata: {
        category: 'math',
        tags: ['math', 'addition', 'arithmetic']
    }
});

export const powerTool = createTool({
    id: 'power',
    description: 'Raises a number to a specified power',
    inputSchema: z.object({
        base: z.number().describe('Base number'),
        exponent: z.number().describe('Exponent')
    }),
    execute: async ({ base, exponent }) => {
        return {
            result: Math.pow(base, exponent),
            operation: 'exponentiation',
            base,
            exponent
        };
    },
    metadata: {
        category: 'math',
        tags: ['math', 'power', 'exponent']
    }
});
```

## Best Practices

### 1. Tool Design
- **Keep tools focused** - One tool, one clear purpose
- **Use descriptive IDs** - Make tool names self-explanatory
- **Write clear descriptions** - Help the AI understand when to use your tool

### 2. Input Schema Design
- **Use Zod schemas** - Leverage type safety and validation
- **Provide good defaults** - Make tools easy to use
- **Add descriptions** - Help with parameter documentation

### 3. Error Handling
- **Return structured results** - Include success/error status
- **Provide helpful error messages** - Make debugging easier
- **Handle edge cases** - Validate inputs and handle failures gracefully

### 4. Performance
- **Keep tools fast** - Avoid blocking operations when possible
- **Use appropriate timeouts** - Set reasonable execution limits
- **Cache when appropriate** - Store expensive computation results

### 5. Documentation
- **Write clear descriptions** - Explain what the tool does
- **Document parameters** - Use Zod descriptions for clarity
- **Include examples** - Show how to use the tool effectively

### 6. Security
- Use `requiresConfirmation: true` for tools that perform destructive operations
- Set appropriate timeouts to prevent hanging operations
- Consider tool-specific confirmation for sensitive operations

### 7. Organization
- Use descriptive tool IDs that match your configuration keys
- Document tool-specific requirements in your configuration
- Group related tools in separate files for better organization

## Integration with MCP Tools

Custom tools work seamlessly with MCP tools:

```yaml
# Both types in same config
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]

customTools:
  globalSettings:
    requiresConfirmation: false
```

The AI agent can use both custom tools and MCP tools in the same conversation, choosing the best tool for each task.

## Troubleshooting

### Tools Not Available
- Ensure you're using `createTool()` to define your tools
- Check that the file containing your tools is being imported
- Verify tool IDs match your configuration keys

### Tools Requiring Unexpected Confirmation
- Check `globalSettings.requiresConfirmation`
- Check tool-specific settings in `toolConfigs`
- Verify tool code doesn't override settings

### Tools Timing Out
- Increase `timeout` in `globalSettings` or tool-specific config
- Check if the tool is actually hanging or just slow
- Consider if the operation should be cached

## Contributing

To add new example tools:
1. Create a new `.ts` file in this directory
2. Follow the patterns shown in existing examples
3. Use the clean `createTool` API
4. Update this README with your tool description
5. Test thoroughly before submitting

## Learn More

- [Saiki Documentation](../docs)
- [MCP Protocol](https://modelcontextprotocol.io)
- [TypeScript Guide](https://www.typescriptlang.org/docs)
- [Zod Documentation](https://zod.dev) 