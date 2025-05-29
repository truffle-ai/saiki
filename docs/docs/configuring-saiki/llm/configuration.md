---
sidebar_position: 1
---

# Configuration Reference

This page covers all the technical details of configuring LLMs in Saiki.

## Type Definition

```typescript
export type LLMConfig = {
    provider: string;
    model: string;
    apiKey: string;
    systemPrompt: string | SystemPromptConfig;
    providerOptions?: Record<string, any>;
    baseURL?: string;
    maxTokens?: number;
    router?: 'vercel' | 'in-built';
};

export interface SystemPromptConfig {
    contributors: ContributorConfig[];
}

export interface ContributorConfig {
    id: string;
    type: 'static' | 'dynamic';
    priority: number;
    enabled?: boolean;
    content?: string; // for static
    source?: string; // for dynamic
}
```

## Configuration Fields

### Required Fields

- **provider** (string): The LLM provider to use (e.g., `openai`, `anthropic`, `google`, `groq`)
- **model** (string): The model name (see [Providers Guide](./providers) for full list)
- **apiKey** (string): API key or environment variable (e.g., `$OPENAI_API_KEY`)
- **systemPrompt** (string | SystemPromptConfig): System prompt configuration

### Optional Fields

- **providerOptions** (object): Provider-specific options like temperature, top_p
- **baseURL** (string): Custom API endpoint for OpenAI-compatible providers
- **maxTokens** (number): Maximum response tokens (required for custom providers)
- **router** (string): Choose between `vercel` (default) or `in-built` routers

## System Prompt Configuration

### Simple String Prompt

The simplest way to configure a system prompt is with a string:

```yaml
llm:
  provider: openai
  model: gpt-4.1-mini
  apiKey: $OPENAI_API_KEY
  systemPrompt: |
    You are Saiki, a helpful AI assistant with access to tools.
    Use these tools when appropriate to answer user queries.
    You can use multiple tools in sequence to solve complex problems.
    After each tool result, determine if you need more information or can provide a final answer.
```

### Advanced SystemPromptConfig

For more complex scenarios, you can use the structured approach:

```yaml
llm:
  provider: openai
  model: gpt-4.1-mini
  apiKey: $OPENAI_API_KEY
  systemPrompt:
    contributors:
      - id: default
        type: static
        priority: 1
        content: |
          You are Saiki, a helpful AI assistant with access to tools.
          Use these tools when appropriate to answer user queries.
      - id: date-time
        type: dynamic
        priority: 2
        source: dateTime
      - id: custom-instructions
        type: static
        priority: 3
        enabled: true
        content: |
          Additional custom instructions for this specific agent.
```

### System Prompt Contributors

**Static Contributors**
- Use `content` field for fixed text
- Perfect for consistent agent behavior instructions
- Higher priority numbers are appended last

**Dynamic Contributors**
- Use `source` field for dynamically generated content
- Available sources:
  - `dateTime`: Automatically adds current date/time context
- Enable/disable with the `enabled` field

## Provider Options

Different providers support various options that can be passed through `providerOptions`:

### OpenAI Provider Options
```yaml
llm:
  provider: openai
  model: gpt-4.1-mini
  apiKey: $OPENAI_API_KEY
  providerOptions:
    temperature: 0.7
    top_p: 0.9
    frequency_penalty: 0
    presence_penalty: 0
```

### Anthropic Provider Options
```yaml
llm:
  provider: anthropic
  model: claude-3-5-sonnet-20240620
  apiKey: $ANTHROPIC_API_KEY
  providerOptions:
    temperature: 0.7
    top_p: 0.9
    top_k: 40
```

### Google Provider Options
```yaml
llm:
  provider: google
  model: gemini-2.0-flash
  apiKey: $GOOGLE_GENERATIVE_AI_API_KEY
  providerOptions:
    temperature: 0.7
    topP: 0.9
    topK: 40
    maxOutputTokens: 8192
```

## Custom Providers

For OpenAI-compatible providers, you'll need additional configuration:

```yaml
llm:
  provider: openai
  model: your-custom-model
  apiKey: $YOUR_API_KEY
  baseURL: https://api.your-provider.com/v1
  maxTokens: 100000  # Required for custom providers
  providerOptions:
    temperature: 0.7
```

**Important Notes for Custom Providers:**
- Always set `provider: openai` for OpenAI-compatible APIs
- The `maxTokens` field is required
- Use `baseURL` to point to the custom endpoint
- The `model` field should match what the provider expects

## Router Configuration

Saiki offers two router options:

### Vercel Router (Default)
```yaml
llm:
  provider: openai
  model: gpt-4.1-mini
  apiKey: $OPENAI_API_KEY
  router: vercel  # This is the default
```

**Benefits:**
- Optimized for performance and reliability
- Built-in error handling and retries
- Better streaming support

### In-built Router
```yaml
llm:
  provider: openai
  model: gpt-4.1-mini
  apiKey: $OPENAI_API_KEY
  router: in-built
```

**When to use:**
- Direct control over LLM communication
- Custom provider configurations
- Debugging provider issues

## Complete Configuration Examples

### Production-Ready Configuration
```yaml
llm:
  provider: openai
  model: gpt-4.1-mini
  apiKey: $OPENAI_API_KEY
  router: vercel
  systemPrompt:
    contributors:
      - id: core
        type: static
        priority: 1
        content: |
          You are Saiki, a helpful AI assistant designed to work with tools and data.
          Always use available tools when they can help answer user questions.
          Provide clear, accurate, and helpful responses.
      - id: timestamp
        type: dynamic
        priority: 2
        source: dateTime
  providerOptions:
    temperature: 0.3
    top_p: 0.9
```

### Local Development Configuration
```yaml
llm:
  provider: openai
  model: llama3.2
  apiKey: dummy
  baseURL: http://localhost:11434/v1
  maxTokens: 8000
  router: in-built
  systemPrompt: |
    You are a helpful AI assistant running locally.
    Use the available tools to help users with their tasks.
```

## Next Steps

- **Learn about providers**: Check the [Providers Guide](./providers) for specific setup instructions
- **Start building**: Head to [Building with Saiki](../../building-with-saiki/) to put this configuration to use
- **Explore MCP**: Learn about [MCP Server Configuration](../mcpServers) to add tools to your agents 