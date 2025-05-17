# Saiki

<p align="center">
  <img src="https://img.shields.io/badge/Status-Beta-yellow" alt="Status: Beta">
  <img src="https://img.shields.io/badge/License-Elastic%202.0-blue.svg" alt="License: Elastic License 2.0">
  <a href="https://discord.gg/GwxwQs8CN5"><img src="https://img.shields.io/badge/Discord-Join%20Chat-7289da?logo=discord&logoColor=white&style=flat" alt="Discord"></a>
  <a href="https://deepwiki.com/truffle-ai/saiki"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
</p>


**Use natural language to control your tools, apps, and services — connect once, command everything.**

<div align="center">
  <img src="assets/notion_webui_example.gif" alt="Saiki Demo" width="800" />
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
saiki --mode web --web-port 3000
```

<details><summary><strong>Alternative: without global install</strong></summary>

```bash
npm start -- --mode web --web-port 3000
```

</details>

Open http://localhost:3000 in your browser.

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

Saiki is a flexible, modular AI agent that lets you perform tasks across your tools, apps, and services using natural language. You describe what you want to do — Saiki figures out which tools to invoke and orchestrates them seamlessly.

Why developers choose Saiki:

1. **Open & Extensible**: Connect to any service via the Model Context Protocol (MCP). Drop in pre-built servers for GitHub, filesystem, terminal, or build your own.
2. **AI-Powered Orchestration**: Natural language tasks are parsed into multi-step tool calls executed in the correct sequence.
3. **Multi-Interface Support**: Use via CLI, wrap it in a web UI, or integrate into other systems – AI logic is decoupled from UI concerns.
4. **Production-Ready**: Robust error handling, structured logging, and pluggable LLM providers (OpenAI, Anthropic, Google) ensure reliability.

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
  <img src="https://github.com/user-attachments/assets/3f5be5e2-7a55-4093-a071-8c52f1a83ba3" alt="Saiki: Amazon shopping agent demo" width="800"/>
</a>

### 📧 Email Summary to Slack
**Task:** `Summarize emails and send highlights to Slack`
```bash
saiki --config-file ./configuration/examples/email_slack.yml
```
<img src="assets/email_slack_demo.gif" alt="Email to Slack Demo" width="800">

### 🎨 AI Website Designer
**Task:** `Design a landing page based on README.md`
```bash
saiki --config-file ./configuration/examples/website_designer.yml
```
<img src="assets/website_demo.gif" alt="Website Designer Demo" width="800">

_For more examples, see the [Examples](docs/README.md#examples--demos) section in the docs._

## CLI Reference

The `saiki` command supports several options to customize its behavior. Run `saiki --help` for the full list.

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

Saiki uses a YAML config file (`configuration/saiki.yml` by default) to configure tool servers (MCP servers) and LLM providers.

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


## Documentation

Find detailed guides, architecture, and API reference in the `docs/` folder:

- High-level design — [docs/architecture.md](docs/architecture.md)  
- Docker usage — [README.Docker.md](README.Docker.md)  

## Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository to your GitHub account.
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/saiki.git
   cd saiki
   ```
3. Create a new feature branch:
   ```bash
   git checkout -b feature/your-branch-name
   ```
4. Make your changes:
   - Follow existing TypeScript and code style conventions.
   - Run `npm run lint:fix` and `npm run format` before committing.
   - Add or update tests for new functionality.
5. Commit and push your branch:
   ```bash
   git commit -m "Brief description of changes"
   git push origin feature/your-branch-name
   ```
6. Open a Pull Request against the `main` branch with a clear description of your changes.

*Tip:* Open an issue first for discussion on larger enhancements or proposals.

## Community & Support

Saiki was built by the team at [Truffle AI](www.trytruffle.ai).

Saiki is better with you! Join our Discord whether you want to say hello, share your projects, ask questions, or get help setting things up:

[![Join our Discord server](https://img.shields.io/badge/Discord-Join%20Chat-7289da?logo=discord&logoColor=white&style=flat)](https://discord.gg/GwxwQs8CN5)

If you're enjoying Saiki, please give us a ⭐ on GitHub!

## License

Elastic License 2.0. See [LICENSE](LICENSE) for details.

## Contributors

Thanks to all these amazing people for contributing to Saiki! ([full list](https://github.com/truffle-ai/saiki/graphs/contributors)):

[![Contributors](https://contrib.rocks/image?repo=truffle-ai/saiki)](https://github.com/truffle-ai/saiki/graphs/contributors)

