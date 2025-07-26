# Saiki Custom Tools System

This directory demonstrates Saiki's custom tools system, which allows you to create and integrate custom tools alongside MCP servers using a clean, intuitive API.

## Overview

The custom tools system provides:
- **Clean, simple API** for defining tools with minimal boilerplate
- **Automatic tool discovery** from the `/tools` directory
- **YAML configuration** for tool settings
- **Integration with existing MCP tools** - all work together seamlessly
- **Type safety** with full TypeScript support and Zod validation

## Quick Start

### 1. Enable Custom Tools

Add the `customTools` section to your `agent.yml`:

```yaml
customTools:
  toolsDirectory: "./tools"
  autoDiscover: true
  globalSettings:
    requiresConfirmation: false
```

### 2. Create Your First Tool

Create a `.ts` file in the tools directory:

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

## Tool Definition Patterns

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

### Agent Configuration

```yaml
customTools:
  # Directory containing tool files
  toolsDirectory: "./tools"
  
  # Auto-discover tools on startup
  autoDiscover: true
  
  # Tool-specific settings
  toolConfigs:
    tool_name:
      requiresConfirmation: true
      timeout: 60000
  
  # Global settings
  globalSettings:
    requiresConfirmation: false
    timeout: 30000
    enableCaching: false
```

### Tool File Organization

```
tools/
├── math.ts          # Mathematical operations
├── network.ts       # Network utilities
├── data/
│   ├── parsers.ts   # Data parsing tools
│   └── validators.ts # Data validation tools
└── integrations/
    ├── api.ts       # API integration tools
    └── database.ts  # Database tools
```

## Examples

This directory includes example tools:

- **math.ts** - Mathematical operations (add, power, random) using the new clean API
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
  toolsDirectory: "./tools"
  autoDiscover: true
```

The AI agent can use both custom tools and MCP tools in the same conversation, choosing the best tool for each task.


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