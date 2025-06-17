---
sidebar_position: 2
---

# Quick Start

Get your first Saiki agent running in 5 minutes. This guide will walk you through installing Saiki, creating a new project, and interacting with your agent.

### 1. Installation

First, install the Saiki CLI from npm:

```bash
npm install -g @truffle-ai/saiki
```

This gives you access to the global `saiki` command.

### 2. Create a Project

Next, create a new Saiki project. This will set up a directory with a default agent configuration.

```bash
saiki init my-first-agent
cd my-first-agent
```

This creates a `my-first-agent` directory containing a `saiki.yml` file. This file is the heart of our **Framework**—it defines how your agent will behave.

### 3. Configure your API Key

The default agent is configured to use OpenAI. To run it, you need to provide an API key.

Open the `.env` file in your new project and add your OpenAI API key:

```.env
OPENAI_API_KEY="sk-..."
```

Saiki's **Runtime** automatically loads variables from this file.

### 4. Run Your Agent

Now you're ready to start your agent. Use the **CLI** to interact with the Saiki **Runtime**.

Run a single command:
```bash
saiki "What is the current working directory?"
```

Or start an interactive session:
```bash
saiki
```
This will start a chat session with your agent directly in your terminal. You've now successfully built and run your first Saiki agent!

## Run agent as a server

To run a Saiki agent as a server, use the following command:

```bash
saiki --mode server
```

You can now talk to your agent via REST or WebSocket APIs.

Check out the [API Reference](../api-reference/overview) for more details.

## Next Steps

- **Learn the Basics:** Check out our [CLI guide](../guides/cli) for more advanced usage
- **Configure Your Agent:** See [Configuration](../guides/configuring-saiki/overview) to customize your setup
- **Add Tools:** Learn about [MCP Servers](../guides/configuring-saiki/mcpServers) to enhance your agent's capabilities
- **Choose Your LLM:** Explore [LLM Providers](../guides/configuring-saiki/llm/providers) for all supported models 