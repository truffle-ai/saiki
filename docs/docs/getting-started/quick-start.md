---
sidebar_position: 2
---

# Quick Start

Get up and running with Saiki in minutes.

## Installation

Install Saiki globally using npm:

```bash
npm install -g @truffle-ai/saiki
```

## Basic Usage

### Interactive CLI

Start Saiki in interactive mode:

```bash
saiki
```

This opens an interactive terminal where you can chat with your AI agent using the default configuration.

### Single Commands

You can also run single commands directly:

```bash
saiki "what are the current files in my directory"
```

```bash
saiki "write a script to add two numbers in ./addition"
```

The CLI uses the default configuration defined in `configuration/saiki.yml`. You can customize this configuration as needed.

## Web Playground

For a visual interface, start Saiki in web mode:

```bash
saiki --mode web
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

The web playground provides an interactive way to:
- Connect to MCP servers
- Test different tools and servers
- Try out different LLMs
- Save your preferred combinations as AI agents

## Next Steps

- **Learn the Basics:** Check out our [CLI guide](../user-guide/cli) for more advanced usage
- **Configure Your Agent:** See [Configuration](../configuring-saiki/overview) to customize your setup
- **Add Tools:** Learn about [MCP Servers](../configuring-saiki/mcpServers) to enhance your agent's capabilities
- **Choose Your LLM:** Explore [LLM Providers](../configuring-saiki/llm/providers) for all supported models 