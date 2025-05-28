---
sidebar_position: 3
---

# LLM Configuration

The `llm` section configures the Large Language Model (LLM) used by Saiki for natural language processing and tool reasoning.

:::tip
For a comprehensive guide to all supported LLM providers, models, and setup instructions, see the [LLM Providers & Setup Guide](./llm-providers.md).
:::

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

## Quick Examples

### Basic Configuration
```yaml
llm:
  provider: openai
  model: gpt-4.1-mini
  systemPrompt: |
    You are Saiki, a helpful AI assistant with access to tools.
    Use these tools when appropriate to answer user queries.
  apiKey: $OPENAI_API_KEY
```

### Multiple Providers
```yaml
# OpenAI
llm:
  provider: openai
  model: gpt-4.1-mini
  apiKey: $OPENAI_API_KEY

# Anthropic
llm:
  provider: anthropic
  model: claude-3-5-sonnet-20240620
  apiKey: $ANTHROPIC_API_KEY

# Google
llm:
  provider: google
  model: gemini-2.0-flash
  apiKey: $GOOGLE_GENERATIVE_AI_API_KEY

# Custom/Local Provider
llm:
  provider: openai
  model: llama3.2
  apiKey: dummy
  baseURL: http://localhost:11434/v1
  maxTokens: 8000
```

## Configuration Fields

- **provider** (string, required): The LLM provider (`openai`, `anthropic`, `google`, `groq`)
- **model** (string, required): The model name (see [LLM Providers Guide](./llm-providers.md) for full list)
- **apiKey** (string, required): API key or environment variable (e.g., `$OPENAI_API_KEY`)
- **systemPrompt** (string | SystemPromptConfig, required): System prompt configuration
- **providerOptions** (object, optional): Provider-specific options like temperature, top_p
- **baseURL** (string, optional): Custom API endpoint for OpenAI-compatible providers
- **maxTokens** (number, optional): Maximum response tokens (required for custom providers)
- **router** (string, optional): Choose between `vercel` (default) or `in-built` routers

## Advanced System Prompt Configuration

```yaml
llm:
  provider: openai
  model: gpt-4.1-mini
  systemPrompt:
    contributors:
      - id: default
        type: static
        priority: 1
        content: |
          You are Saiki, a helpful AI assistant with access to tools.
      - id: date-time
        type: dynamic
        priority: 2
        source: dateTime
  apiKey: $OPENAI_API_KEY
```

- **Static contributors**: Use `content` field for fixed text
- **Dynamic contributors**: Use `source` field for dynamically generated content
- **dateTime contributor**: Automatically adds current date/time context

## Next Steps

- **Comprehensive Provider Guide**: See [LLM Providers & Setup Guide](./llm-providers.md) for all supported models and providers
- **MCP Servers**: Learn about [MCP Server Configuration](./mcpServers.md) to add tools
- **Building Apps**: Check out [Building with Saiki](../user-guide/development.md) for implementation patterns 