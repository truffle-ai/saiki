---
sidebar_position: 2
---

# Quick Start

Get Saiki running in under a minute. This guide walks you through installing the Saiki CLI, setting up your API key, and running your first command.

### 1. Installation

First, install the Saiki CLI from npm:

```bash
npm install -g @truffle-ai/saiki
```

This gives you access to the global `saiki` command.

### 2. Set Your API Key

Saiki needs an LLM API key to function. The simplest way to provide it is by setting an environment variable. By default, Saiki uses OpenAI.

```bash
export OPENAI_API_KEY="sk-..."
```

Saiki automatically detects and uses this key. For other providers like Anthropic or Google, you can set `ANTHROPIC_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`.

### 3. Run Your Agent

Now you're ready to interact with Saiki.

Run a single command for a quick answer:
```bash
saiki "What is the current version of typescript?"
```

Or start an interactive chat session:
```bash
saiki
```
This will start a chat session with the default agent directly in your terminal. You've now successfully run Saiki!

## Next Steps

You've just scratched the surface. Here's what you can do next:

- **Learn the Basics:** Check out our [CLI guide](../guides/cli) for more advanced usage
- **Configure Your Agent:** See [Configuration](../guides/configuring-saiki/overview) to customize your setup
- **Add Tools:** Learn about [MCP Servers](../guides/configuring-saiki/mcpServers) to enhance your agent's capabilities
- **Choose Your LLM:** Explore [LLM Providers](../guides/configuring-saiki/llm/providers) for all supported models 