# Configuration System

> **[AGENTS - READ THIS DOCUMENT AND KEEP IT UP TO DATE, EVALUATE INCONSISTENCIES AND FLAG THEM]**

The comprehensive configuration management system for Saiki that handles validation, state management, and runtime configuration changes.

## Architecture Overview

```mermaid
graph LR
    A[Configuration Sources] --> B[Config System]
    B --> C[Validated Configuration]
    
    A1[agent.yml] --> A
    A2[CLI Args] --> A
    A3[Environment] --> A
    A4[Overrides] --> A
    
    B1[Schema Validation] --> B
    B2[Default Application] --> B
    B3[Runtime State Management] --> B
    B4[Session Overrides] --> B
    B5[Dynamic MCP Server Management] --> B
    
    C1[Type Safety] --> C
    C2[Runtime State] --> C
    C3[Session Overrides] --> C
```

## Core Components

### ConfigManager (`config-manager.ts`)
**Pure configuration validation** and read-only access to processed configuration.

**Key Responsibilities:**
- **Schema Validation**: Apply Zod schemas with comprehensive error reporting
- **Default Application**: Merge user config with schema defaults
- **Immutability Protection**: Freeze configuration to prevent mutations
- **Type Safety**: Ensure configuration conforms to expected types

**API:**
```typescript
class ConfigManager {
    constructor(config: AgentConfig)
    getConfig(): ValidatedAgentConfig
    // Access nested config: getConfig().llm, getConfig().mcpServers, etc.
}
```

### AgentStateManager (`agent-state-manager.ts`)
**Runtime configuration management** that handles dynamic changes during agent execution.

**Key Responsibilities:**
- **Runtime State Tracking**: Track changes separate from static baseline
- **Session Overrides**: Support session-specific LLM configurations
- **Dynamic MCP Management**: Add/remove servers at runtime
- **Change Validation**: Validate runtime modifications
- **State Export**: Export modified state back to config format

**API:**
```typescript
class AgentStateManager {
    // LLM configuration management
    updateLLM(newConfig: Partial<ValidatedLLMConfig>, sessionId?: string): ValidationResult
    getLLMConfig(sessionId?: string): ValidatedLLMConfig
    
    // Session override management
    clearSessionOverride(sessionId: string): void
    
    // Dynamic MCP server management
    addMcpServer(name: string, config: McpServerConfig)
    removeMcpServer(name: string)
    
    // State export and inspection
    getRuntimeConfig(sessionId?: string): ValidatedAgentConfig
    exportAsConfig(): ValidatedAgentConfig
    resetToBaseline(): void
}
```

### Schemas (`schemas.ts`)
**Zod schema definitions** providing type-safe configuration validation.

**Key Schema Types:**
- **AgentConfigSchema**: Complete agent configuration
- **LLMConfigSchema**: Language model configuration with provider validation
- **McpServerConfigSchema**: MCP server connection details
- **SystemPromptConfigSchema**: System prompt and contributor configuration
- **AgentCardSchema**: Agent metadata for discovery and integration

### Validation Utils (`validation-utils.ts`)
**Configuration validation utilities** for complex validation logic.

**Key Functions:**
- **buildLLMConfig()**: Build and validate LLM configuration with provider inference
- **validateLLMSwitchRequest()**: Validate dynamic LLM switching requests
- **validateMcpServerConfig()**: Validate MCP server configurations
- **validationErrorsToStrings()**: Convert validation errors to user-friendly messages

## Key Design Principles

### 1. Layered Configuration Management
```typescript
// Static baseline (immutable)
ConfigManager → ValidatedAgentConfig

// Runtime changes (mutable)
AgentStateManager → Runtime state + Session overrides

// Effective configuration (computed)
getLLMConfig(sessionId) → Baseline + Runtime + Session overrides
```

### 2. Type Safety Through Schemas
- **Input Types**: `z.input<Schema>` for user-facing APIs
- **Validated Types**: `z.infer<Schema>` for internal usage
- **Strict Validation**: `.strict()` to prevent unknown properties
- **Default Application**: Schema defaults merged automatically

### 3. Session-Specific Configuration
- **Global Configuration**: Default settings for all sessions
- **Session Overrides**: Per-session LLM configuration overrides
- **Inheritance**: Sessions inherit global config unless overridden
- **Isolation**: Session changes don't affect other sessions

### 4. Runtime Configuration Changes
- **Baseline Preservation**: Original config remains unchanged
- **Change Tracking**: Runtime modifications tracked separately
- **State Export**: Modified state can be exported to config format
- **Validation**: All runtime changes validated before application

## Configuration Schema Structure

### Agent Configuration
```yaml
# agent.yml
systemPrompt: |
  You are a helpful AI assistant.

llm:
  provider: anthropic                    # anthropic, openai, etc.
  model: claude-3-5-sonnet-20241022     # Model identifier
  apiKey: $ANTHROPIC_API_KEY            # Environment variable reference
  router: in-built                      # Message formatting strategy
  maxInputTokens: 100000               # Token limit override

mcpServers:
  filesystem:
    command: mcp-filesystem             # Command to start server
    args: ["/tmp"]                     # Optional arguments
    env:                               # Optional environment variables
      DEBUG: "1"

internalTools:
  - search_history                     # Built-in tools to enable

storage:
  database:
    type: sqlite                       # sqlite, postgres, memory
    path: .saiki/saiki.db             # Database path/connection

agentCard:
  name: "My Saiki Agent"
  description: "Custom AI assistant"
  url: "https://localhost:3000"
  version: "1.0.0"
```

### Dynamic Configuration Changes
```typescript
// Session-specific LLM override
stateManager.updateLLM({
    provider: 'openai',
    model: 'gpt-4o',
    maxInputTokens: 50000
}, 'user-123');

// Add MCP server at runtime
stateManager.addMcpServer('git', {
    command: 'mcp-git',
    args: ['--repo', '/path/to/repo']
});

// Get effective config for session
const effectiveConfig = stateManager.getLLMConfig('user-123');
// Returns: { provider: 'openai', model: 'gpt-4o', ... }
```

## Configuration Loading and Processing

### Startup Sequence
1. **Raw Config Loading**: Load from files, CLI args, environment (app layer)
2. **Schema Validation**: Apply Zod schemas and defaults via ConfigManager
3. **State Initialization**: Initialize AgentStateManager with validated config
4. **Service Initialization**: Pass validated config to core services

### Runtime Modification Sequence
1. **Validation**: Validate proposed changes against schemas
2. **State Update**: Apply changes to runtime state
3. **Event Emission**: Emit configuration change events
4. **Service Updates**: Notify affected services of changes
5. **Persistence**: Optionally persist changes to storage

## Validation and Error Handling

### Schema Validation Features
- **Comprehensive Validation**: Provider/model compatibility checking
- **Environment Variable Resolution**: `$VAR_NAME` syntax support
- **Default Application**: Schema defaults merged automatically
- **Strict Mode**: Prevent unknown properties in configuration
- **Custom Validators**: Complex validation logic for specific fields

### Error Reporting
```typescript
interface ValidationError {
    type: ValidationErrorType;
    path: string[];
    message: string;
    details?: Record<string, unknown>;
}

// User-friendly error messages
const errors = validationErrorsToStrings(validationResult.errors);
// ["LLM model 'invalid-model' is not supported for provider 'openai'"]
```

## Session Override System

### Override Types
```typescript
interface SessionOverride {
    llm?: Partial<ValidatedLLMConfig>;  // LLM configuration override
    // Future: tools?, systemPrompt?, etc.
}
```

### Override Resolution
1. **Global Baseline**: Start with global LLM configuration
2. **Runtime Changes**: Apply any runtime-level modifications
3. **Session Overrides**: Apply session-specific overrides
4. **Validation**: Validate final effective configuration
5. **Return**: Type-safe effective configuration

### Use Cases
- **Multi-tenant Applications**: Different LLM configs per user
- **A/B Testing**: Test different models within same agent
- **User Preferences**: Per-user model selection
- **Resource Management**: Different token limits per session

## Testing

The configuration system has comprehensive test coverage:

### Schema Tests (`schemas.test.ts`) - 75 tests
- **Schema Validation**: All configuration schemas tested
- **Default Application**: Schema defaults properly applied
- **Error Handling**: Invalid configurations rejected with clear errors
- **Type Safety**: Input/output types correctly inferred

### Validation Utils Tests (`validation-utils.test.ts`) - 38 tests
- **LLM Config Building**: Provider inference and validation
- **Switch Request Validation**: Dynamic LLM switching validation
- **MCP Server Validation**: Server configuration validation
- **Error Message Generation**: User-friendly error formatting

### State Manager Tests (`agent-state-manager.test.ts`) - 7 tests
- **Session Override Management**: Per-session configuration overrides
- **Runtime State Tracking**: Dynamic configuration changes
- **Configuration Export**: Modified state serialization
- **Change Detection**: Runtime modification tracking

### Config Manager Tests (`config-manager.test.ts`) - 9 tests
- **Configuration Loading**: Raw config validation and processing
- **Immutability**: Configuration freeze and protection
- **Error Handling**: Invalid configuration rejection
- **Default Application**: Schema default merging

## Future Architecture

This design supports future enhancements:
- **Plugin Configuration**: Dynamic plugin discovery and configuration
- **Configuration Hot Reload**: Runtime configuration file updates
- **Multi-environment Support**: Development/staging/production configurations
- **Configuration Validation API**: External configuration validation service