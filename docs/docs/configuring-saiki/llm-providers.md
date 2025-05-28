---
sidebar_position: 3
---

# LLM Providers & Setup Guide

Saiki supports multiple LLM providers out of the box, plus the ability to use any OpenAI SDK-compatible provider.

## Built-in Providers

### **OpenAI**
```yaml
llm:
  provider: openai
  model: gpt-4.1-mini  # Default
  apiKey: $OPENAI_API_KEY
```

**Supported models**: `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-4o`, `gpt-4o-mini`, `o4-mini`, `o3`, `o3-mini`, `o1`

### **Anthropic**
```yaml
llm:
  provider: anthropic
  model: claude-3-7-sonnet-20250219  # Default
  apiKey: $ANTHROPIC_API_KEY
```

**Supported models**: `claude-3-7-sonnet-20250219`, `claude-3-5-sonnet-20240620`, `claude-3-haiku-20240307`, `claude-3-opus-20240229`, `claude-3-sonnet-20240229`

### **Google**
```yaml
llm:
  provider: google
  model: gemini-2.5-pro-exp-03-25  # Default
  apiKey: $GOOGLE_GENERATIVE_AI_API_KEY
```

**Supported models**: `gemini-2.5-pro-exp-03-25`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-pro-latest`, `gemini-1.5-flash-latest`

### **Groq**
```yaml
llm:
  provider: groq
  model: llama-3.3-70b-versatile  # Default
  apiKey: $GROQ_API_KEY
```

**Supported models**: `gemma-2-9b-it`, `llama-3.3-70b-versatile`

## Custom/OpenAI-Compatible Providers

You can use any provider that implements the OpenAI SDK interface by setting `provider: openai` and providing a custom `baseURL`:

```yaml
llm:
  provider: openai
  model: your-custom-model
  apiKey: $YOUR_API_KEY
  baseURL: https://api.your-provider.com/v1
  maxTokens: 100000  # Required for custom providers
```

### Popular Compatible Providers

#### **Local Models**
Run models locally using Ollama, LM Studio, or similar:

```yaml
llm:
  provider: openai
  model: llama3.2
  apiKey: dummy  # Required but ignored for local
  baseURL: http://localhost:11434/v1  # Ollama default
  maxTokens: 8000
```

#### **Azure OpenAI**
```yaml
llm:
  provider: openai
  model: gpt-4
  apiKey: $AZURE_OPENAI_API_KEY
  baseURL: https://your-resource.openai.azure.com/openai/deployments/gpt-4
  maxTokens: 128000
```

#### **OpenRouter**
Access 100+ models through one API:

```yaml
llm:
  provider: openai
  model: anthropic/claude-3.5-sonnet
  apiKey: $OPENROUTER_API_KEY
  baseURL: https://openrouter.ai/api/v1
  maxTokens: 200000
```

#### **Together.ai**
```yaml
llm:
  provider: openai
  model: meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo
  apiKey: $TOGETHER_API_KEY
  baseURL: https://api.together.xyz/v1
  maxTokens: 8000
```

#### **Anyscale**
```yaml
llm:
  provider: openai
  model: meta-llama/Llama-2-70b-chat-hf
  apiKey: $ANYSCALE_API_KEY
  baseURL: https://api.endpoints.anyscale.com/v1
  maxTokens: 4000
```

#### **Perplexity**
```yaml
llm:
  provider: openai
  model: llama-3.1-sonar-huge-128k-online
  apiKey: $PERPLEXITY_API_KEY
  baseURL: https://api.perplexity.ai
  maxTokens: 128000
```

## Configuration Reference

### Core Fields

- **provider** (string, required):  
  The LLM provider to use (e.g., `openai`, `anthropic`, `google`, `groq`).

- **model** (string, required):  
  The model name (e.g., `gpt-4.1-mini`, `claude-3-opus-20240229`).

- **apiKey** (string, required):  
  API key for the provider. You can either directly pass the key, or link to environment variables (e.g., `$OPENAI_API_KEY`).

- **systemPrompt** (`string` or `SystemPromptConfig`, required):  
  The system prompt to guide the LLM's behavior. Can be a simple string, or a structured object for advanced prompt composition.

- **providerOptions** (object, optional):  
  Additional provider-specific options. Key-value pairs passed directly to the LLM provider SDK.

- **baseURL** (string, optional):  
  Custom API endpoint URL for OpenAI-compatible providers.

- **maxTokens** (number, optional):  
  Maximum tokens for the response. Required for custom providers.

### Environment Variables
Set API keys in your `.env` file:
```bash
# Built-in providers
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_GENERATIVE_AI_API_KEY=your_google_key
GROQ_API_KEY=your_groq_key

# Custom providers
OPENROUTER_API_KEY=your_openrouter_key
TOGETHER_API_KEY=your_together_key
AZURE_OPENAI_API_KEY=your_azure_key
ANYSCALE_API_KEY=your_anyscale_key
PERPLEXITY_API_KEY=your_perplexity_key
```

## Advanced Configuration

### System Prompts

#### Simple String Prompt
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

#### Advanced SystemPromptConfig
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

- **Static contributors** use the `content` field to directly add their content
- **Dynamic contributors** use the `source` field to map to functions that dynamically generate content
- Dynamic contributors are useful for ever-changing information like current time and agent memories
- The `dateTime` contributor adds knowledge of the current date and time to the LLM

### Provider-Specific Options
Fine-tune model behavior with provider options:

```yaml
llm:
  provider: openai
  model: gpt-4.1-mini
  apiKey: $OPENAI_API_KEY
  providerOptions:
    temperature: 0.7        # Creativity (0.0-1.0)
    top_p: 0.9             # Nucleus sampling
    max_tokens: 4000       # Response length limit
    frequency_penalty: 0.1  # Reduce repetition
    presence_penalty: 0.1   # Encourage topic diversity
```

### Router Selection
Choose between Vercel AI SDK or in-built implementations:

```yaml
llm:
  provider: openai
  model: gpt-4.1-mini
  apiKey: $OPENAI_API_KEY
  router: vercel      # Default: Better streaming, tool handling
  # router: in-built  # Alternative: Direct control; Currently OpenAI & Anthropic available
```

## Command Line Usage

### Model Selection
Override the model at runtime without changing config files:

```bash
# Switch to different providers
saiki -m claude-3-5-sonnet-20240620     # Anthropic
saiki -m gemini-2.0-flash                # Google
saiki -m llama-3.3-70b-versatile         # Groq

# Use custom models
saiki -m gpt-4o --config-file custom.yml
```

### Multiple Agent Configurations
Create specialized configurations for different use cases:

**`configs/coding-agent.yml`**:
```yaml
llm:
  provider: anthropic
  model: claude-3-5-sonnet-20240620
  apiKey: $ANTHROPIC_API_KEY
  systemPrompt: |
    You are an expert software engineer. Focus on clean, efficient code
    with proper error handling and documentation.
```

**`configs/writing-agent.yml`**:
```yaml
llm:
  provider: openai
  model: gpt-4.1
  apiKey: $OPENAI_API_KEY
  providerOptions:
    temperature: 0.8
  systemPrompt: |
    You are a professional writer. Create engaging, well-structured content
    with clear communication and proper tone.
```

**`configs/analysis-agent.yml`**:
```yaml
llm:
  provider: google
  model: gemini-2.5-pro-exp-03-25
  apiKey: $GOOGLE_GENERATIVE_AI_API_KEY
  systemPrompt: |
    You are a data analyst. Provide thorough, accurate analysis with
    clear insights and actionable recommendations.
```

Run with specific configs:
```bash
saiki --config-file ./configs/coding-agent.yml
saiki --config-file ./configs/writing-agent.yml
saiki --config-file ./configs/analysis-agent.yml
```

## Model Selection Guidelines

### **Speed vs Quality**
- **Fast inference**: Groq (llama-3.3-70b-versatile), Google (gemini-2.0-flash)
- **Balanced**: OpenAI (gpt-4.1-mini), Anthropic (claude-3-haiku)
- **Maximum quality**: OpenAI (o3, gpt-4.1), Anthropic (claude-3-7-sonnet)

### **Use Case Recommendations**
- **Coding**: Claude 3.5 Sonnet, GPT-4.1, o1
- **Writing**: GPT-4.1, Claude 3.7 Sonnet
- **Analysis**: Gemini 2.5 Pro, Claude 3.7 Sonnet
- **Chat/Support**: GPT-4.1-mini, Claude 3 Haiku
- **Local/Privacy**: Ollama with Llama 3.2, Code Llama

### **Cost Considerations**
- **Budget-friendly**: GPT-4.1-mini, Claude 3 Haiku, Groq models
- **Premium**: o3, Claude 3.7 Sonnet, GPT-4.1
- **Local**: Free (after initial setup costs)

## Troubleshooting

### Common Issues

**Authentication Errors**:
- Verify API key in `.env` file
- Check key permissions and billing status
- Ensure correct environment variable names

**Model Not Found**:
- Check supported models list above
- Verify model name spelling
- For custom providers, ensure model exists at that endpoint

**Rate Limiting**:
- Implement delays between requests
- Use provider-specific rate limit headers
- Consider upgrading your plan

**Custom Provider Issues**:
- Ensure `maxTokens` is specified
- Verify `baseURL` format (no trailing slash)
- Check if provider truly implements OpenAI API

### Getting Help

- **Discord Community**: [Join our Discord](https://discord.gg/GwxwQs8CN5)
- **Provider Documentation**: Check your LLM provider's specific docs
- **GitHub Issues**: Report bugs or request new provider support

## Next Steps

- Learn about [Building Applications](../user-guide/development.md) with different LLM configurations
- Explore [MCP Server Configuration](./mcpServers.md) to add tools to your agents
- Check out the [CLI Guide](../user-guide/cli.md) for command-line model switching 