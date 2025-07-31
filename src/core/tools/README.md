# Tools System

> **[AGENTS - READ THIS DOCUMENT AND KEEP IT UP TO DATE, EVALUATE INCONSISTENCIES AND FLAG THEM]**

The unified tool management system for Saiki that handles both MCP (Model Context Protocol) servers and internal tools.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   LLM Service   │───▶│   ToolManager    │───▶│  Tool Sources   │
└─────────────────┘    │   (Unified)      │    │                 │
                       └──────────────────┘    │ • MCPManager    │
                                ▲              │ • InternalTools │
                                │              └─────────────────┘
                                ▼
                       ┌──────────────────┐
                       │ ToolConfirmation │
                       │    Provider      │
                       └──────────────────┘
```

## Core Components

### ToolManager (`tool-manager.ts`)
- **Single interface** for all tool operations
- **Universal prefixing**: All tools get source prefixes (`mcp--*`, `internal--*`)
- **Conflict resolution** through prefixing (no naming conflicts)
- **Unified execution** with confirmation support

### Internal Tools (`internal-tools/`)
Directory structure for built-in tools that ship with Saiki:

```
internal-tools/
├── registry.ts              # Tool definitions and type source
├── provider.ts              # Tool provider implementation
├── implementations/         # Individual tool implementations
│   └── search-history-tool.ts
└── provider.test.ts        # Provider tests
```

### Tool Confirmation (`confirmation/`)
Security and approval system for tool execution.

## Key Design Principles

### 1. Implementation Drives Types
```typescript
// ✅ Registry defines what exists
export const INTERNAL_TOOL_NAMES = ['search_history'] as const;
export type KnownInternalTool = typeof INTERNAL_TOOL_NAMES[number];

// ✅ Schema validates against implementation reality
export const InternalToolsSchema = z.array(z.enum(INTERNAL_TOOL_NAMES));
```

### 2. Universal Tool Prefixing
All tools get prefixed by source to eliminate naming conflicts:
- `mcp--filesystem_read` (from MCP server)
- `internal--search_history` (internal tool)

### 3. Schema-Config Separation
- **Registry**: Defines what tools exist (implementation concern)
- **Schema**: Validates user configuration (validation concern)  
- **Config Types**: Enable future schema evolution

## Adding New Internal Tools

### Step 1: Add Tool Name
```typescript
// internal-tools/registry.ts
export const INTERNAL_TOOL_NAMES = [
    'search_history',
    'your_new_tool'  // ← Add here first
] as const;
```

### Step 2: Implement Tool
```typescript
// internal-tools/implementations/your-new-tool.ts
export function createYourNewTool(service: SomeService): InternalTool {
    return {
        id: 'your_new_tool',
        description: 'Description of what it does',
        inputSchema: z.object({
            // Define input parameters
        }),
        execute: async (input, context) => {
            // Implementation
        }
    };
}
```

### Step 3: Register Tool
```typescript
// internal-tools/registry.ts
export const INTERNAL_TOOL_REGISTRY: Record<KnownInternalTool, {
    factory: InternalToolFactory;
    requiredServices: readonly (keyof InternalToolsServices)[];
}> = {
    search_history: { /* existing */ },
    your_new_tool: {
        factory: (services) => createYourNewTool(services.someService!),
        requiredServices: ['someService'] as const,
    }
};
```

### Step 4: Add Service (if needed)
```typescript
// internal-tools/registry.ts
export interface InternalToolsServices {
    searchService?: SearchService;
    someService?: SomeService;  // ← Add required service
}
```

That's it! TypeScript ensures completeness and the schema automatically validates the new tool name.

## Configuration

### Agent Config
```yaml
# agent.yml
internalTools:
  - search_history
  - your_new_tool
```

### Service Initialization
```typescript
const toolManager = new ToolManager(mcpManager, confirmationProvider, {
    internalToolsServices: { 
        searchService,
        someService 
    },
    internalToolsConfig: config.internalTools
});
```

## Type Safety

The system provides complete type safety through:

1. **Literal Types**: Manual names array preserves `"search_history"` literals
2. **Registry Validation**: TypeScript enforces registry completeness  
3. **Schema Derivation**: Perfect type inference for validated config
4. **Service Dependencies**: Required services are type-checked

## Future Architecture

This design prepares for:
- **Custom Tools**: User-defined tools discovered at build time
- **Tools Redesign**: Unified `tools` config with `internal`/`custom` sections
- **Schema Evolution**: Config types can evolve independently of business logic

## Testing

- `provider.test.ts` - Configuration and provider functionality
- `tool-manager.test.ts` - Unified tool management (needs updating)
- `tool-manager.integration.test.ts` - Cross-source scenarios (needs updating)

Tests are currently outdated and need updating after the restructuring.