# Saiki - The Runtime For AI Agents

<p align="center">
  <img src="https://img.shields.io/badge/Status-Beta-yellow">
  <img src="https://img.shields.io/badge/License-Elastic%202.0-blue.svg">
  <a href="https://discord.gg/GFzWFAAZcm"><img src="https://img.shields.io/badge/Discord-Join%20Chat-7289da?logo=discord&logoColor=white"></a>
  <a href="https://deepwiki.com/truffle-ai/saiki"><img src="https://deepwiki.com/badge.svg"></a>
</p>

**The open-source runtime for building and running powerful AI agents.**  
Saiki turns natural-language requests into real actions across your tools, apps, and services.

<div align="center">
  <img src="https://github.com/user-attachments/assets/9a796427-ab97-4c8f-8ac2-09cf58135553" alt="Saiki Demo" width="900" />
</div>

---

## Table of Contents
1. [Why Saiki?](#why-saiki)
2. [Installation](#installation)
3. [Run Modes](#run-modes)
4. [Quick Start](#quick-start)
5. [Programmatic API](#programmatic-api)
6. [Configuration](#configuration)
7. [Examples & Demos](#examples--demos)
8. [Capabilities](#capabilities)
9. [Architecture Overview](#architecture-overview)
10. [LLM Providers](#llm-providers)
11. [Standalone MCP Manager](#standalone-mcp-manager)
12. [CLI Reference](#cli-reference)
13. [Next Steps](#next-steps)
14. [Community & Support](#community--support)
15. [Contributors](#contributors)
16. [License](#license)

---

## Why Saiki?

| 💡 Feature | What it means for you |
|------------|-----------------------|
| **Multi-interface** | Run the same agent via CLI, Web, Discord, Telegram, or a REST/WS server. |
| **Model-agnostic** | Hot-swap LLMs from OpenAI, Anthropic, Gemini, Groq, or local models. |
| **Unified Tooling** | Connect to remote tool servers (filesystem, browser, web-search) via the **Model Context Protocol (MCP)**. |
| **Config-driven** | Define agent behavior (prompts, tools, model, memory) in version-controlled YAML. |
| **Production-ready Core** | Leverage a multi-session chat manager, typed API, pluggable storage, and robust logging. |
| **Extensible** | Ship your own MCP tool servers or plug in custom services with a few lines of config. |
| **Interoperable** | Enable multi-agent collaboration via MCP and A2A(soon). |

Saiki is the missing **intelligence layer** of your stack—perfect for building agentic appilcations, standalone chatbots, or as the reasoning engine inside larger products.

---

## Installation

```bash
# NPM global
npm install -g @truffle-ai/saiki

# —or— build from source
git clone https://github.com/truffle-ai/saiki.git
cd saiki && npm i && npm run build && npm link
```

---

## Run Modes

| Mode | Command | Best for |
|------|---------|----------|
| **Interactive CLI** | `saiki` | Everyday automation & quick tasks |
| **Web UI** | `saiki --mode web` | Friendly chat interface w/ image support |
| **Headless Server** | `saiki --mode server` | REST & WebSocket micro-services |
| **MCP Server (Agent)** | `saiki --mode mcp` | Exposing your agent as a tool for others |
| **MCP Server (Aggregator)** | `saiki mcp --group-servers` | Re-exposing tools from multiple MCP servers |
| **Discord Bot** | `saiki --mode discord` | Community servers & channels |
| **Telegram Bot** | `saiki --mode telegram` | Mobile chat |

Run `saiki --help` for **all flags, sub-commands, and environment variables**.

---

## Quick Start

Set your API keys first:
```bash
export OPENAI_API_KEY=your_openai_api_key_here
```

Then, give Saiki a multi-step task that combines different tools:
```bash
saiki "create a new snake game in html, css, and javascript, then open it in the browser"
```

Saiki will use its **filesystem** tools to write the code and its **browser** tools to open the `index.html` file—all from a single prompt.

---

## Programmatic API

The `SaikiAgent` class is the core of the runtime. The following example shows its full lifecycle: initialization, running a single task, holding a conversation, and shutting down.

```ts
import 'dotenv/config';
import { SaikiAgent, loadConfigFile } from '@truffle-ai/saiki';

const cfg  = await loadConfigFile('./agents/agent.yml');
const agent = new SaikiAgent(cfg);

await agent.start();

// Single-shot task
console.log(await agent.run('List the 5 largest files in this repo'));

// Conversation
await agent.run('Write a haiku about TypeScript');
await agent.run('Make it funnier');

agent.resetConversation();

await agent.stop();
```

Everything in the CLI is powered by this same class—so whatever the CLI can do, your code can too.

---

## Configuration

Agents are defined in version-controlled YAML. A minimal example:

```yaml
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
  puppeteer:
    type: stdio
    command: npx
    args: ['-y', '@truffle-ai/puppeteer-server']

llm:
  provider: openai
  model: gpt-4o
  apiKey: $OPENAI_API_KEY

prompt: |
  You are Saiki, an expert coding assistant...
```

Change the file, reload the agent, and keep chatting—the conversation state, memory, and tools adapt on the fly.

---

## Examples & Demos

### 🛒 Amazon Shopping Assistant
**Task:** `Can you go to amazon and add some snacks to my cart? I like trail mix, cheetos and maybe surprise me with something else?`
```bash
# Default agent has browser tools
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

More ready-to-run recipes live in [`agents/examples`](agents/examples) and the [docs site](https://truffle-ai.github.io/saiki/docs/examples-demos/).

---

## Capabilities

* **Dynamic LLM Switching**: Change model, provider, or routing rules mid-conversation.
* **Streaming Responses**: Opt-in to receive tokens as they arrive for real-time output.
* **Multi-Session Management**: Create isolated, stateful chat sessions (think workspace tabs).  
* **Pluggable Memory Backends**: Use the in-memory default or connect your own DB via the `StorageManager`.
* **Lifecycle Event Bus**: Subscribe to agent events for metrics, logging, or custom side-effects.
* **Standalone MCP Manager**: Use Saiki's core `MCPManager` in your own projects without the full agent.

---

## LLM Providers

Saiki supports multiple LLM providers out-of-the-box, plus any OpenAI SDK-compatible provider.

- **OpenAI**: `gpt-4.1-mini`, `gpt-4o`, `o3`, `o1` and more
- **Anthropic**: `claude-3-7-sonnet-20250219`, `claude-3-5-sonnet-20240620` and more  
- **Google**: `gemini-2.5-pro-exp-03-25`, `gemini-2.0-flash` and more
- **Groq**: `llama-3.3-70b-versatile`, `gemma-2-9b-it`

### Quick Setup

Set your API key and run. You can switch providers instantly via the `-m` flag.
```bash
# OpenAI (default)
export OPENAI_API_KEY=your_openai_api_key_here
export ANTHROPIC_API_KEY=your_anthropic_api_key_here
export GOOGLE_GENERATIVE_AI_API_KEY=your_google_gemini_api_key_here
saiki

# Switch providers via CLI
saiki -m claude-3.5-sonnet-20240620
saiki -m gemini-1.5-flash-latest
```

For comprehensive setup instructions, see our **[LLM Providers Guide](https://truffle-ai.github.io/saiki/docs/configuring-saiki/llm/providers)**.

---

## Standalone MCP Manager

Need to manage MCP tool servers without the full agent? Use the `MCPManager` directly in your own applications.

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

// Get all available tools across servers
const tools = await manager.getAllTools();
console.log('Available tools:', Object.keys(tools));

// Execute a tool
const result = await manager.executeTool('readFile', { path: './README.md' });
console.log('File contents:', result);

// Disconnect when done
await manager.disconnectAll();
```

See the **[MCP Manager Documentation](https://truffle-ai.github.io/saiki/docs/mcp-manager)** for the complete API reference.

---

## CLI Reference

<details>
<summary>Click to expand for full CLI reference (`saiki --help`)</summary>

```
Usage: saiki [options] [command] [prompt...]

The Saiki CLI allows you to talk to Saiki, build custom AI Agents, and create complex AI applications. For full documentation, visit https://github.com/truffle-ai/saiki.

Arguments:
  prompt                    Natural-language prompt to run once. If empty, starts interactive CLI.

Options:
  -v, --version             output the current version
  -a, --agent <path>        Path to agent config file (default: "agents/agent.yml")
  -s, --strict              Require all server connections to succeed
  --no-verbose              Disable verbose output
  -m, --model <model>       Specify the LLM model to use.
  -r, --router <router>     Specify the LLM router to use (vercel or in-built)
  --mode <mode>             Runtime mode: cli | web | server | discord | telegram | mcp (default: "cli")
  --web-port <port>         Optional port for the web UI (default: "3000")
  -h, --help                display help for command

Commands:
  create-app                Scaffold a new Saiki Typescript app.
  init-app                  Initialize an existing Typescript app with Saiki.
  mcp                       Run Saiki as an MCP server.
```
</details>

---

## Next Steps

* **[Quick Start](https://truffle-ai.github.io/saiki/docs/getting-started/intro)** – Get up and running in minutes.
* **[Configuration Guide](https://truffle-ai.github.io/saiki/docs/category/guides)** – Configure agents, LLMs, and tools.
* **[Building with Saiki](https://truffle-ai.github.io/saiki/docs/category/tutorials)** – Developer guides and patterns.
* **[API Reference](https://truffle-ai.github.io/saiki/api)** – REST APIs, WebSocket, and SDKs.

---

## Contributing

We welcome contributions! Refer to our [Contributing Guide](./CONTRIBUTING.md) for more details.

## Community & Support

Saiki is built by the team at [Truffle AI](https://www.trytruffle.ai).  
Join our Discord to share projects, ask questions, or just say hi!

[![Discord](https://img.shields.io/badge/Discord-Join%20Chat-7289da?logo=discord&logoColor=white)](https://discord.gg/GFzWFAAZcm)

If you enjoy Saiki, please give us a ⭐ on GitHub—it helps a lot!

---

## Contributors

Thanks to all these amazing people for contributing to Saiki!

[![Contributors](https://contrib.rocks/image?repo=truffle-ai/saiki)](https://github.com/truffle-ai/saiki/graphs/contributors)

---

## License

Elastic License 2.0.  See [LICENSE](LICENSE) for full terms.