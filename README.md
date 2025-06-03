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
Make sure you have `DISCORD_BOT_TOKEN` set in your environment. See [here](app/discord/README.md) for more details.

**Telegram Bot:**
```bash
saiki --mode telegram
```
Make sure you have `TELEGRAM_BOT_TOKEN` set in your environment. See [here](app/telegram/README.md) for more details.

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

### 🎮 Create AI NPCs For Your Games

Spin up new agents out-of-the-box and use them to power AI NPCs in your game environment. You can configure these agents to go beyond simple LLMs responses to take real actions in-game.

*Example project repo coming soon...*

<img src="https://github.com/user-attachments/assets/c1fc6b60-d85c-4920-84f9-918949ef1ddb" alt="AI NPC Example" width="600">


### 📧 Send Email Summaries to Slack
**Task:** `Summarize emails and send highlights to Slack`
```bash
saiki --config-file ./configuration/examples/email_slack.yml
```
<img src="assets/email_slack_demo.gif" alt="Email to Slack Demo" width="600">

### 📝 Use Notion As A Second Brain
```bash
saiki --config-file ./configuration/examples/notion.yml #Requires setup
```
<img src="assets/notion_webui_example.gif" alt="Notion Integration Demo" width="600">


## CLI Reference

The `saiki` command supports several options to customize its behavior. Run `saiki --help` for the full list.

```
> saiki -h
17:51:31 INFO: Log level set to: INFO
Usage: saiki [options] [prompt...]

AI-powered CLI and WebUI for interacting with MCP servers

Arguments:
  prompt                    Optional headless prompt for single command mode

Options:
  -c, --config-file <path>  Path to config file (default: "configuration/saiki.yml")
  -s, --strict              Require all server connections to succeed
  --no-verbose              Disable verbose output
  --mode <mode>             Run mode: cli, web, server, discord, or telegram (default: "cli")
  --web-port <port>         Port for WebUI (default: "3000")
  -m, --model <model>       Specify the LLM model to use
  -r, --router <router>     Specify the LLM router to use (vercel or in-built)
  -V, --version             output the version number
```

**Common Examples:**

*   **Specify a custom configuration file:**
    ```bash
    cp configuration/saiki.yml configuration/custom_config.yml
    saiki --config-file configuration/custom_config.yml
    ```

*   **Use a specific AI model (if configured):**
    ```bash
    saiki -m gemini-2.5-pro-exp-03-25
    ```

## Configuration

Saiki defines agents using a YAML config file (`configuration/saiki.yml` by default). To configure an agent, use tool servers (MCP servers) and LLM providers.

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

## Discovering & Connecting MCP Servers

Saiki communicates with your tools via Model Context Protocol (MCP) servers. You can discover and connect to MCP servers in several ways:

1. Browse pre-built servers:
   - Model Context Protocol reference servers: https://github.com/modelcontextprotocol/reference-servers
   - Smithery.ai catalog: https://smithery.ai/tools
   - Composio MCP registry: https://mcp.composio.dev/

2. Search on npm:
```bash
npm search @modelcontextprotocol/server
```
3. Add servers to your `configuration/saiki.yml` under the `mcpServers` key (see the snippet above).

4. Create custom servers:
   - Use the MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
   - Follow the MCP spec: https://modelcontextprotocol.io/introduction


## Advanced Usage

Saiki is designed to be a flexible component in your AI and automation workflows. Beyond the CLI and Web UI, you can integrate Saiki's core agent capabilities into your own applications or have it communicate with other AI agents.

### Embedding Saiki in Your Applications

When Saiki runs in `web` mode (`saiki --mode web`), it exposes a comprehensive REST API and a WebSocket interface, allowing you to control and interact with the agent programmatically. This is ideal for building custom front-ends, backend integrations, or embedding Saiki into existing platforms.

For detailed information on the available API endpoints and WebSocket communication protocol, please see the [Saiki API and WebSocket Interface documentation](docs/api_and_websockets.md).

### Inter-Agent Communication with MCP

Saiki embraces the Model Context Protocol (MCP) not just for connecting to tools, but also for **Agent-to-Agent communication**. This means Saiki can:

1.  **Act as an MCP Client**: Connect to other AI agents that expose an MCP server interface, allowing Saiki to delegate tasks or query other agents as if they were any other tool.
2.  **Act as an MCP Server**: Saiki itself exposes an MCP server interface (see `src/app/api/mcp_handler.ts` and `src/app/api/a2a.ts`). This makes Saiki discoverable and usable by other MCP-compatible agents or systems. Another agent could connect to Saiki and utilize its configured tools and LLM capabilities.

This framework-agnostic approach allows Saiki to participate in a broader ecosystem of AI agents, regardless of their underlying implementation. By defining an `AgentCard` (a standardized metadata file, based on A2A protocol, describing an agent's capabilities and MCP endpoint), Saiki can be discovered and interact with other agents seamlessly. *(We also plan to integrate support for the A2A protocol soon)*

This powerful A2A capability opens up possibilities for creating sophisticated multi-agent systems where different specialized agents collaborate to achieve complex goals.

## Documentation

Find detailed guides, architecture, and API reference in the `docs/` folder:

- [High-level design](docs/architecture.md)
- [Docker usage](README.Docker.md)
- [API Endpoints](docs/api_and_websockets.md)

## Contributing
We welcome contributions! Refer [here](CONTRIBUTING.md) for more details.

## Community & Support

Saiki was built by the team at [Truffle AI](www.trytruffle.ai).

Saiki is better with you! Join our Discord whether you want to say hello, share your projects, ask questions, or get help setting things up:

[![Join our Discord server](https://img.shields.io/badge/Discord-Join%20Chat-7289da?logo=discord&logoColor=white&style=flat)](https://discord.gg/GFzWFAAZcm)

If you're enjoying Saiki, please give us a ⭐ on GitHub!

## License

Elastic License 2.0. See [LICENSE](LICENSE) for details.

## Contributors

Thanks to all these amazing people for contributing to Saiki! ([full list](https://github.com/truffle-ai/saiki/graphs/contributors)):

[![Contributors](https://contrib.rocks/image?repo=truffle-ai/saiki)](https://github.com/truffle-ai/saiki/graphs/contributors)