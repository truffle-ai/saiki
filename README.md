# Saiki

<p align="center">
  <img src="https://img.shields.io/badge/License-Elastic%202.0-blue.svg" alt="License: Elastic License 2.0">
  <img src="https://img.shields.io/badge/Node.js-16+-green.svg" alt="Node.js: 16+">
  <a href="https://discord.gg/GwxwQs8CN5"><img src="https://img.shields.io/badge/Discord-Join%20Chat-7289da?logo=discord&logoColor=white&style=flat" alt="Discord"></a>
  <img src="https://img.shields.io/badge/Backed_by-Y_Combinator-orange" alt="Backed by YC">
</p>

Your command center for controlling computers, applications and services with natural language - connect once, command everything.

## 📑 Table of Contents
- [🌟 Overview](#overview)
- [🚀 Getting Started](#getting-started)
- [💻 Use Cases](#use-cases)
- [⚙️ Configuration](#configuration)
- [🔌 Extensions](#extensions)
- [📚 Documentation](#documentation)
- [🤝 Contributing](#contributing)
- [📜 License](#license)

## 🌟 Overview

Saiki is an AI Agent created by Truffle AI, that makes it easy to use computers, applications and services using natural language. You type what you want to do and Saiki figures out which tools to use and how to execute them correctly.

What makes Saiki powerful for developers:

1. **Flexible Integrations**: Easily connect multiple existing systems and services to Saiki using Model Context Protocol (MCP) servers. Integrate with GitHub, filesystem operations, terminal commands, and more without complex setup. Saiki's modular design means you can add exactly the capabilities you need. More on this [here](https://github.com/truffle-ai/saiki/edit/release/docs/README.md#-extensions)

2. **In-built Orchestration**: Once you've configured your servers and start using Saiki, it will automatically figure out when and how to use the tools to accomplish your task.
   
3. **Customizable Interfaces**: Create tailored interfaces for your specific use cases - from CLI to web interfaces. Saiki's architecture separates the AI logic from the presentation layer.

Saiki eliminates the need to learn different syntaxes or switch between multiple tools. Whether you're automating development workflows, creating specialized assistants, or building productivity tools, Saiki provides the foundation you need.

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- npm
- OpenAI/Anthropic API key

### Quick Start

1. **Install and build:**
```bash
git clone https://github.com/truffle-ai/saiki/ && cd saiki
npm install
npm run build
```

2. **Configure your API key:**
Create a .env file and add your API key
```bash
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
```

3. **Launch Saiki:**
```bash
npm start
```

That's it! You're now ready to interact with Saiki through the command line.

## 💻 Use Cases

Here are some examples of what you can do with Saiki:

### Code Operations
```
> Find all TODO comments in the src directory
> Create a new React component called UserProfile
> Show me files changed in the last commit
```

### Development Workflow
```
> Start the dev server
> Run tests for the auth module
> Show available npm scripts
```

### File Management
```
> Find all files modified in the last week
> Create a new directory called "reports"
> Zip all log files into an archive
```

### GitHub Integration
```
> Show open pull requests on this repository
> Create an issue for the performance bug
> Check the status of the CI pipeline
```

## ⚙️ Configuration

Saiki uses a simple JSON configuration file (`configuration/mcp.json`) to define which tools you want to connect:

```json
{
    "mcpServers": {
        "github": {
            "type": "stdio",
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-github"],
            "env": {
                "GITHUB_PERSONAL_ACCESS_TOKEN": "your-github-token"
            }
        },
        "filesystem": {
            "type": "stdio",
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
        }
    },
    "llm": {
        "provider": "openai",
        "model": "gpt-4",
        "apiKey": "env:OPENAI_API_KEY",
        "providerOptions": {
            "temperature": 0.7,
            "maxTokens": 1000
        }
    }
}
```

You can use `configuration/mcp.json` directly, or you can use a custom configuration file:
```bash
npm start -- --config-file path/to/your/config.json
```

## 🔌 Extensions

Saiki's power comes from its extensibility. You can easily add new capabilities by:

1. **Using Existing Tool Servers**: Connect pre-built MCP-compatible servers for services GitHub, filesystem, terminal, etc. [Smithery.ai](https://smithery.ai/) has a large set of pre-built MCP servers.

2. **Creating Custom Servers**: Build your own tool servers to add specialized functionality.

Popular tool servers:
- GitHub: Manage repositories, issues, PRs
- Filesystem: File and directory operations
- Terminal: Run shell commands
- Desktop Commander: Control desktop applications

For creating custom servers, check out the [MCP Documentation](https://github.com/microsoft/MCP/blob/main/specification/specification.md).

## 📚 Documentation

For more detailed information:

- [Architecture Overview](./docs/architecture.md) - How Saiki works under the hood
- [Configuration Guide](./configuration/configuration.md) - Detailed configuration options
- [Example Usage](./docs/examples.md) - More usage examples
- [Troubleshooting](./docs/troubleshooting.md) - Solutions to common issues
- [Adding a New LLM Service](./src/ai/llm/README.md) - How to add support for new LLM providers

## 🤝 Contributing

We welcome contributions! Here's how you can help:

- **Add Tool Configurations**: Connect existing MCP-compatible servers
- **Build Examples**: Create example scripts or use cases
- **Create Custom Servers**: Build new MCP-compatible servers
- **Report Issues**: Help us identify bugs or suggest features

Ready to contribute? Fork the repo, make your changes, and submit a pull request!

Resources:
- [Smithery.ai](https://smithery.ai/) - Browse MCP servers
- [MCP Documentation](https://modelcontextprotocol.io/introduction)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

## 📜 License

Saiki is licensed under the Elastic License 2.0 (ELv2). See the [LICENSE](./LICENSE) file for details.
