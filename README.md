# Saiki

<p align="center">
  <img src="https://img.shields.io/badge/Status-Beta-yellow" alt="Status: Beta">
  <img src="https://img.shields.io/badge/License-Elastic%202.0-blue.svg" alt="License: Elastic License 2.0">
  <a href="https://discord.gg/GFzWFAAZcm"><img src="https://img.shields.io/badge/Discord-Join%20Chat-7289da?logo=discord&logoColor=white&style=flat" alt="Discord"></a>
  <a href="https://deepwiki.com/truffle-ai/saiki"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
</p>


**Use natural language to control your tools, apps, and services — connect once, command everything.**

<div align="center">
  <img src="https://github.com/user-attachments/assets/9a796427-ab97-4c8f-8ac2-09cf58135553" alt="Saiki Demo" width="900" />
</div>

## Installation

**Global (npm)**
```bash
npm install -g @truffle-ai/saiki
```

<details><summary><strong>Build & Link from source</strong></summary>

```bash
git clone https://github.com/truffle-ai/saiki.git
cd saiki
npm install
npm run build
npm link
```

After linking, the `saiki` command becomes available globally.

</details>

## Quick Start

### CLI Mode

Invoke the interactive CLI:
```bash
saiki
```

<details><summary><strong>Alternative: without global install</strong></summary>

You can also run directly via npm:
```bash
npm start
```

</details>


### Web UI Mode

Serve the experimental web interface:
```bash
saiki --mode web
```

<details><summary><strong>Alternative: without global install</strong></summary>

```bash
npm start -- --mode web
```

</details>

Open http://localhost:3000 in your browser.

### Server Mode

Run Saiki as a server with just REST APIs and WebSockets:
```bash
saiki --mode server
```

This mode is perfect for:
- Backend integrations 
- Microservice architectures
- Custom frontend development
- API-only deployments

The server exposes REST endpoints for messaging, MCP server management, and WebSocket support for real-time communication.

### Bot Modes

Run Saiki as a Discord or Telegram bot.

**Discord Bot:**
```bash
saiki --mode discord
```
Make sure you have `DISCORD_BOT_TOKEN` set in your environment. See [here](src/app/discord/README.md) for more details.

**Telegram Bot:**
```bash
saiki --mode telegram
```
Make sure you have `TELEGRAM_BOT_TOKEN` set in your environment. See [here](src/app/telegram/README.md) for more details.

### MCP Server Mode

Spin up an agent that acts as an MCP server

```bash
saiki --mode mcp
```

## Overview

Saiki is an open, modular and extensible AI agent that lets you perform tasks across your tools, apps, and services using natural language. You describe what you want to do — Saiki figures out which tools to invoke and orchestrates them seamlessly, whether that means running a shell command, summarizing a webpage, or calling an API.

Why developers choose Saiki:

1. **Open & Extensible**: Connect to any service via the Model Context Protocol (MCP).
2. **Config-Driven Agents**: Define & save your agent prompts, tools (via MCP), and model in YAML.
3. **Multi-Interface Support**: Use via CLI, wrap it in a web UI, or integrate into other systems.
4. **Runs Anywhere**: Local-first runtime with logging, retries, and support for any LLM provider.
5. **Interoperable**: Expose as an API or connect to other agents via MCP/A2A(soon).

Saiki is the missing natural language layer across your stack. Whether you're automating workflows, building agents, or prototyping new ideas, Saiki gives you the tools to move fast — and bend it to your needs. Interact with Saiki via the command line or the new experimental web UI.

Ready to jump in? Follow the [Installation](#installation) guide or explore demos below.

## Examples & Demos

### 🛒 Amazon Shopping Assistant
**Task:** `Can you go to amazon and add some snacks to my cart? I like trail mix, cheetos and maybe surprise me with something else?`
```bash
# Use default config which supports puppeteer for navigating the browser
saiki
```
<a href="https://youtu.be/C-Z0aVbl4Ik">
  <img src="https://github.com/user-attachments/assets/3f5be5e2-7a55-4093-a071-8c52f1a83ba3" alt="Saiki: Amazon shopping agent demo" width="600"/>
</a>


### 📧 Send Email Summaries to Slack
**Task:** `Summarize emails and send highlights to Slack`
```bash
saiki --agent ./agents/examples/email_slack.yml
```
<img src="assets/email_slack_demo.gif" alt="Email to Slack Demo" width="600">

### 📝 Use Notion As A Second Brain
```bash
saiki --agent ./agents/examples/notion.yml #Requires setup
```
<img src="assets/notion_webui_example.gif" alt="Notion Integration Demo" width="600">


## CLI Reference

The `saiki` command supports several options to customize its behavior. Run `saiki --help` for the full list.

```
> saiki -h
Usage: saiki [options] [command] [prompt...]

Saiki CLI allows you to talk to Saiki, build custom AI Agents, build complex AI applications like Cursor, and more.

Run saiki interactive CLI with `saiki` or run a one-shot prompt with `saiki <prompt>`
Run saiki web UI with `saiki --mode web`
Run saiki as a server (REST APIs + WebSockets) with `saiki --mode server`
Run saiki as a discord bot with `saiki --mode discord`
Run saiki as a telegram bot with `saiki --mode telegram`
Run saiki as an MCP server with `saiki --mode mcp`

Check subcommands for more features. Check https://github.com/truffle-ai/saiki for documentation on how to customize saiki and other examples

Arguments:
  prompt                    Natural-language prompt to run once. If not passed, saiki will start as an interactive CLI

Options:
  -v, --version             output the current version
  -a, --agent <path>        Path to agent config file (default: "agents/agent.yml")
  -s, --strict              Require all server connections to succeed
  --no-verbose              Disable verbose output
  -m, --model <model>       Specify the LLM model to use.
  -r, --router <router>     Specify the LLM router to use (vercel or in-built)
  --mode <mode>             The application in which saiki should talk to you - cli | web | server | discord | telegram | mcp (default: "cli")
  --web-port <port>         optional port for the web UI (default: "3000")
  -h, --help                display help for command

Commands:
  create-app                Scaffold a new Saiki Typescript app
  init-app                  Initialize an existing Typescript app with Saiki
```

**Common Examples:**

*   **Specify a custom agent:**
    ```bash
    cp agents/agent.yml agents/custom_config.yml
    saiki --agent agents/custom_config.yml
    ```

*   **Use a specific AI model (if configured):**
    ```bash
    saiki -m gemini-2.5-pro-exp-03-25
    ```

## Configuration

Saiki defines agents using a YAML config file (`agents/agent.yml` by default). To configure an agent, use tool servers (MCP servers) and LLM providers.

```yaml
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - .
  puppeteer:
    type: stdio
    command: npx
    args:
      - -y
      - "@truffle-ai/puppeteer-server"

llm:
  provider: openai
  model: gpt-4.1-mini
  apiKey: $OPENAI_API_KEY
```

## LLM Providers & Setup

Saiki supports multiple LLM providers out of the box, plus any OpenAI SDK-compatible provider.

### Built-in Providers

- **OpenAI**: `gpt-4.1-mini`, `gpt-4o`, `o3`, `o1` and more
- **Anthropic**: `claude-3-7-sonnet-20250219`, `claude-3-5-sonnet-20240620` and more  
- **Google**: `gemini-2.5-pro-exp-03-25`, `gemini-2.0-flash` and more
- **Groq**: `llama-3.3-70b-versatile`, `gemma-2-9b-it`

You will need to set your provider specific API keys accordingly.

### Quick Setup

Set your API key and run:
```bash
# OpenAI (default)
export OPENAI_API_KEY=your_key
saiki

# Switch providers via CLI
saiki -m claude-3-5-sonnet-20240620
saiki -m gemini-2.0-flash
```

For comprehensive setup instructions, all supported models, advanced configuration, and troubleshooting, see our **[LLM Providers Guide](https://truffle-ai.github.io/saiki/docs/configuring-saiki/llm/providers)**.


## Building with Saiki

Saiki can be easily integrated into your applications as a powerful AI agent library. Here's a simple example to get you started:

### Quick Start: Programmatic Usage

```typescript
import 'dotenv/config';
import { loadConfigFile, createSaikiAgent } from '@truffle-ai/saiki';

// Load your agent configuration
const config = await loadConfigFile('./agent.yml');
const agent = await createSaikiAgent(config);

// Use the agent for single tasks
const result = await agent.run("Analyze the files in this directory and create a summary");
console.log(result);

// Or have conversations
const response1 = await agent.run("What files are in the current directory?");
const response2 = await agent.run("Create a README for the main.py file");

// Reset conversation when needed
agent.resetConversation();
```

For detailed information on the available API endpoints and WebSocket communication protocol, please see the [Saiki API and WebSocket Interface documentation](https://truffle-ai.github.io/saiki/docs/api).

### Learn More

For comprehensive guides on building different types of applications with Saiki, including:
- **Web backends and APIs**
- **Discord/Telegram bots** 
- **Advanced patterns and best practices**
- **Multi-agent systems**

See our **[Building with Saiki Developer Guide](https://truffle-ai.github.io/saiki/docs/tutorials/building-with-saiki/)**.

## MCP Server Management

Saiki includes a powerful MCPManager that can be used as a standalone utility for managing MCP servers in your own applications. This is perfect for developers who need MCP server management without the full Saiki agent framework.

### Quick Start: MCP Manager

```typescript
import { MCPManager } from '@truffle-ai/saiki';

// Create manager instance
const manager = new MCPManager();

// Connect to MCP servers
await manager.connectServer('filesystem', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
});

await manager.connectServer('web-search', {
  type: 'stdio', 
  command: 'npx',
  args: ['-y', 'tavily-mcp@0.1.2'],
  env: { TAVILY_API_KEY: process.env.TAVILY_API_KEY }
});

// Get all available tools across servers
const tools = await manager.getAllTools();
console.log('Available tools:', Object.keys(tools));

// Execute a tool
const result = await manager.executeTool('readFile', { path: './README.md' });
console.log('File contents:', result);

// List connected servers
const clients = manager.getClients();
console.log('Connected servers:', Array.from(clients.keys()));

// Disconnect when done
await manager.disconnectAll();
```

The MCPManager provides a simple, unified interface for connecting to and managing multiple MCP servers simultaneously. See our **[MCP Manager Documentation](https://truffle-ai.github.io/saiki/docs/mcp-manager)** for complete API reference and advanced usage patterns.

## Documentation & Learning Resources

Find detailed guides, architecture, and API reference in our comprehensive [documentation](https://truffle-ai.github.io/saiki/docs/getting-started):

- **[Quick Start](https://truffle-ai.github.io/saiki/docs/getting-started/quick-start)** - Get up and running in minutes
- **[Configuration Guide](https://truffle-ai.github.io/saiki/docs/guides/configuring-saiki/overview)** - Configure agents, LLMs, and tools
- **[Building with Saiki](https://truffle-ai.github.io/saiki/docs/tutorials/building-with-saiki/)** - Developer guide with examples and patterns
- **[Multi-Agent Systems](https://truffle-ai.github.io/saiki/docs/tutorials/building-with-saiki/multi-agent-systems)** - Agent collaboration patterns
- **[API Reference](https://truffle-ai.github.io/saiki/docs/api-reference/)** - REST APIs, WebSocket, and SDKs
- **[MCP Manager](https://truffle-ai.github.io/saiki/docs/guides/mcp-manager)** - Standalone MCP server management
- **[Architecture](https://truffle-ai.github.io/saiki/docs/architecture/overview)** - System design and concepts

### Learning Resources

- **[What is an AI Agent?](https://truffle-ai.github.io/saiki/docs/learn/what-is-an-ai-agent)** - Understanding AI agents
- **[Model Context Protocol](https://truffle-ai.github.io/saiki/docs/learn/mcp)** - Learn about MCP
- **[Examples & Demos](https://truffle-ai.github.io/saiki/docs/examples-demos/)** - See Saiki in action

## Contributing
We welcome contributions! Refer to our [Contributing Guide](https://truffle-ai.github.io/saiki/docs/contribution-guide/overview) for more details.

## Community & Support

Saiki was built by the team at [Truffle AI](https://www.trytruffle.ai).

Saiki is better with you! Join our Discord whether you want to say hello, share your projects, ask questions, or get help setting things up:

[![Join our Discord server](https://img.shields.io/badge/Discord-Join%20Chat-7289da?logo=discord&logoColor=white&style=flat)](https://discord.gg/GFzWFAAZcm)

If you're enjoying Saiki, please give us a ⭐ on GitHub!

## License

Elastic License 2.0. See [LICENSE](LICENSE) for details.

## Contributors

Thanks to all these amazing people for contributing to Saiki! ([full list](https://github.com/truffle-ai/saiki/graphs/contributors)):

[![Contributors](https://contrib.rocks/image?repo=truffle-ai/saiki)](https://github.com/truffle-ai/saiki/graphs/contributors)