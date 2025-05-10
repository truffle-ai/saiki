---
sidebar_position: 1
---

# Introduction to Saiki

**Saiki** lets you use natural language to control your tools, apps, and services — connect once, command everything.

<div align="center">
  <img src="https://img.shields.io/badge/Status-Beta-yellow" alt="Status: Beta" />
  <img src="https://img.shields.io/badge/License-Elastic%202.0-blue.svg" alt="License: Elastic License 2.0" />
  <a href="https://discord.gg/GwxwQs8CN5">
    <img src="https://img.shields.io/badge/Discord-Join%20Chat-7289da?logo=discord&logoColor=white&style=flat" alt="Discord" />
  </a>
</div>

Saiki is a flexible, modular AI agent that enables you to perform tasks across your tools, apps, and services using natural language. You describe what you want to do — Saiki figures out which tools to invoke and orchestrates them seamlessly.

## Why Saiki?

- **Open & Extensible:** Connect to any service via the Model Context Protocol (MCP). Use pre-built servers for GitHub, filesystem, terminal, or build your own.
- **AI-Powered Orchestration:** Natural language tasks are parsed into multi-step tool calls executed in the correct sequence.
- **Multi-Interface Support:** Use via CLI, wrap it in a web UI, or integrate into other systems – AI logic is decoupled from UI concerns.
- **Production-Ready:** Robust error handling, structured logging, and pluggable LLM providers (OpenAI, Anthropic, Google) ensure reliability.

Saiki is the missing natural language layer across your stack. Whether you're automating workflows, building agents, or prototyping new ideas, Saiki gives you the tools to move fast — and bend it to your needs.

## Getting Started

- **Install globally:**
  ```bash
  npm install -g @truffle-ai/saiki
  ```
- **Run the CLI:**
  ```bash
  saiki
  ```
- **Try the Web UI:**
  ```bash
  saiki --mode web --web-port 3000
  ```
  Then open [http://localhost:3000](http://localhost:3000) in your browser.

For more details, see the [Installation](./installation.md) and [Usage](./usage.md) guides.

## Example Use Cases

- **Amazon Shopping Assistant:**
  > "Can you go to amazon and add some snacks to my cart? I like trail mix, cheetos and maybe surprise me with something else?"
- **Email Summary to Slack:**
  > "Summarize emails and send highlights to Slack."
- **AI Website Designer:**
  > "Design a landing page based on README.md."

Explore more in the [Examples & Demos](./examples-demos.md) section.

## Learn More

- [Basics of AI Agents](../ai-agents-basics/what-is-an-ai-agent.md) : If you're new to AI Agents and want to learn the basics
- [Configuration](../configuring-saiki/configuration.md): How to connect MCP servers and LLM providers
- [Architecture](../architecture/architecture.md): High-level design
- [Contributing](../contributing.md): How to get involved
- [Community & Support](https://discord.gg/GwxwQs8CN5)

---

Saiki is built by the team at Truffle AI. Join our community and help shape the future of natural language automation! 