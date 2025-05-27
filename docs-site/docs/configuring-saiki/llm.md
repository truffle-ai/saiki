---
sidebar_position: 3
---

# llm Configuration

The `llm` section configures the Large Language Model (LLM) used by Saiki for natural language processing and tool reasoning.

## Type Definition

```typescript
export type LLMConfig = {
    provider: string;
    model: string;
    apiKey?: string;
    systemPrompt: string | SystemPromptConfig;
    providerOptions?: Record<string, any>;
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

## Fields

- **provider** (string, required):  
  The LLM provider to use (e.g., `openai`, `anthropic`, `google`).

- **model** (string, required):  
  The model name (e.g., `gpt-4.1-mini`, `claude-3-opus-20240229`).

- **apiKey** (string, required):  
API key for the provider. You can either directly pass the key, or link to environment variables (e.g., `$OPENAI_API_KEY`).

- **systemPrompt** (`string` or `SystemPromptConfig`, required):  
  The system prompt to guide the LLM's behavior. Can be a simple string, or a structured object for advanced prompt composition.
  - If a string: Used directly as the prompt.
  - If an object: Should match the `SystemPromptConfig` type, with a `contributors` array. We support both dynamic prompt contributors and static prompt contributors. Refer examples 

- **providerOptions** (object, optional):  
  Additional provider-specific options. Key-value pairs passed directly to the LLM provider SDK.

## Example (Simple)

```yaml
llm:
  provider: openai
  model: gpt-4.1-mini
  systemPrompt: |
    You are Saiki, a helpful AI assistant with access to tools.
    Use these tools when appropriate to answer user queries.
    You can use multiple tools in sequence to solve complex problems.
    After each tool result, determine if you need more information or can provide a final answer.
  apiKey: $OPENAI_API_KEY
```
Here we use a basic system prompt which is just a simple string

## Example (Advanced SystemPromptConfig)

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

Here, we have one static contributor and one dynamic contributor.

Static contributors use the `content` field to directly add their content
Dynamic contributors use the `source` field to map to the function that will dynamically generate the content. Dynamic contributor functions must be registered in [the registry](https://github.com/truffle-ai/saiki/blob/main/src/ai/systemPrompt/registry.ts).

Dynamic contributor is very useful for information that is ever changing - such as the current time and agent memories. 
We already have a `dateTime` contributor that can be used to add knowledge of the current date and time into the LLM.

## Notes

- Use environment variables for secrets (e.g., `apiKey: $OPENAI_API_KEY`).
- The advanced `systemPrompt` format allows for modular, multi-source dynamic prompt construction.
- See the [mcpServers Configuration](./mcpServers.md) for server setup details. 