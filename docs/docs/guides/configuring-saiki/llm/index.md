---
sidebar_position: 3
---

# LLM Configuration

Large Language Models (LLMs) are the brain of your Saiki agents. This section covers everything you need to know about configuring LLMs for your agents.

## Overview

Saiki supports multiple LLM providers out-of-the-box via the Vercel AI SDK. You can also use any OpenAI SDK-compatible provider. You can easily switch between different models and providers without changing your application code.

## Quick Start

### Basic Configuration
```yaml
llm:
  provider: openai
  model: gpt-4.1-mini
  apiKey: $OPENAI_API_KEY
  systemPrompt: |
    You are Saiki, a helpful AI assistant with access to tools.
    Use these tools when appropriate to answer user queries.
```

### Environment Variables
Set API keys in your `.env` file:
```bash
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_GENERATIVE_AI_API_KEY=your_google_key
GROQ_API_KEY=your_groq_key
```

## What's in This Section

### [Configuration Reference](./configuration)
Complete guide to all LLM configuration options including:
- Required and optional fields
- System prompt configuration
- Provider-specific options
- Advanced settings

### [Supported Providers](./providers)
Detailed guide to all supported LLM providers:
- **Built-in providers**: OpenAI, Anthropic, Google, Groq
- **Custom providers**: Azure OpenAI, OpenRouter, Together.ai, local models
- **Setup instructions** for each provider
- **Supported models** and their capabilities

## Key Concepts

### Providers vs Models
- **Provider**: The service hosting the LLM (e.g., OpenAI, Anthropic)
- **Model**: The specific AI model to use (e.g., gpt-4.1-mini, claude-3-5-sonnet)

### System Prompts
System prompts define how your agent behaves. They can be:
- **Simple strings** for basic use cases
- **Advanced configurations** with multiple contributors for complex scenarios

### Routers
Saiki uses routers to handle LLM requests:
- **Vercel router** (default): Optimized for performance and reliability
- **In-built router**: Direct communication with providers

## Next Steps

1. **New to LLMs?** Start with the [Configuration Reference](./configuration) to understand the basics
2. **Looking for a specific provider?** Check the [Providers Guide](./providers) for setup instructions
3. **Building an agent?** Head to [Building with Saiki](../../../tutorials/building-with-saiki/introduction) for implementation patterns 