# Saiki

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/Node.js-16+-green.svg" alt="Node.js: 16+">
</p>

> Your command center for controlling computers and services with natural language - connect once, command everything.

## 📑 Table of Contents
- [🌟 Overview](#-overview)
- [🎯 Why Saiki is Different](#-why-saiki-is-different)
- [🚀 Getting Started](#-getting-started)
- [💻 Using Saiki](#-using-saiki)
- [⚙️ Tool Configuration](#️-tool-configuration)
- [🔌 Connect Custom Tools](#-connect-custom-tools)
- [🧩 Architecture](#-architecture)
- [🔧 Development](#-development)
- [🤝 Contributing](#-contributing)
- [📜 License](#-license)

## 🌟 Overview

Saiki transforms how you interact with technology by bridging the gap between natural language and digital tools. You simply express what you want in plain language, and Saiki intelligently connects your intent to the right tools and commands. No more remembering different syntaxes for different systems—just one intuitive interface for everything. This is technology that finally adapts to you, not the other way around.

Key Features:
- **Natural Language Control**: Express your intent in plain English
- **Universal Connectivity**: Seamlessly connects to multiple tool servers
- **AI-Powered Understanding**: Leverages advanced AI to interpret your requests
- **Extensible Architecture**: Easily expand capabilities by connecting new tools
- **Cross-Platform**: Works via command line today, web interface coming soon
- **MCP Compatible**: Connect your own servers using the Model Context Protocol

## 🎯 Why Saiki is Different

Saiki stands out from other AI frameworks through four key principles:

#### 🏗️ Production-First Architecture
- Process isolation and robust error handling
- Standard DevOps practices and security controls
- Structured logging and debugging

#### 📡 Protocol-First Design
- Built on Model Context Protocol (MCP)
- Universal tool compatibility and sharing
- No framework lock-in

#### 🎯 Balanced Autonomy
- AI-powered decisions with predictable execution
- Clear boundaries and transparent operations
- Fine-grained tool access control

#### 💻 Developer Experience
- Standard workflows and familiar patterns
- Clear architecture and debugging tools
- Easy local development

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- npm
- OpenAI API key
- Internet connection (for OpenAI API and downloading servers)

### Installation

1. **Clone and install:**
```bash
git clone <repository-url>
cd saiki
npm install
npm run build
```

2. **Create a `.env` file with your OpenAI API key:**
```
OPENAI_API_KEY=your_openai_api_key_here
```

3. **Launch Saiki:**
```bash
npm start
```

### Troubleshooting
- If you encounter connection issues, ensure your OpenAI API key is valid
- For tool server errors, check your network connection and firewall settings
- Run with `--verbose` flag for detailed logging: `npm start -- --verbose`

## 💻 Using Saiki

Once running, interact naturally with your connected tools. Here are some example use cases:

### Code Operations
```bash
> Find all TODO comments in the src directory
> Create a new React component called UserProfile
> Show me files changed in the last commit
```

### Development Workflow
```bash
> Start the dev server
> Run tests for the auth module
> Show available npm scripts
```

For detailed examples and more use cases, check out our [examples directory](./examples).

## ⚙️ Tool Configuration

The configuration file (`configuration/mcp.json`) defines your tool servers and AI settings. Here's a complete example:

```json
{
    "mcpServers": {
        "desktopCommander": {
            "command": "npx",
            "args": ["-y", "@wonderwhy-er/desktop-commander"]
        },
        "filesystem": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
        },
        "github": {
            "command": "npx",
            "args": [
                "-y",
                "@modelcontextprotocol/server-github"
            ],
            "env": {
                "GITHUB_PERSONAL_ACCESS_TOKEN": "<YOUR_TOKEN>"
            }
        },
        "custom": {
            "command": "node",
            "args": ["--loader", "ts-node/esm", "src/servers/customServer.ts"],
            "env": {
                "API_KEY": "${MY_API_KEY}"
            }
        }
    },
    "llm": {
        "provider": "openai",
        "model": "gpt-4",
        "apiKey": "env:OPENAI_API_KEY"
    }
}
```

The configuration consists of two main sections:

### MCP Servers Configuration
Under `mcpServers`, each server entry can include:
- `command`: The executable to run
- `args`: Array of command-line arguments
- `env` (optional): Environment variables for the server process
  - Use `${VAR_NAME}` syntax to reference environment variables
  - Server-specific configuration options

### LLM Configuration
The `llm` section configures your AI provider:
- `provider`: AI provider (e.g., "openai", "anthropic")
- `model`: The model to use (e.g., "gpt-4o", "claude-3-7-sonnet-20250219")
- `apiKey`: API key configuration (use "env:" prefix for environment variables)

## 🔌 Connect Custom Tools

Saiki's power comes from its ability to connect to various tool servers. By default, it includes some basic capabilities, but you can extend it by:

1. Using additional [MCP-compatible servers](https://github.com/modelcontextprotocol/servers)
2. Creating your own custom servers

### Using Existing Servers

By default, Saiki uses the servers defined in `configuration/mcp.json`. To use your own configuration:

```bash
# Connect using a custom configuration file
npm start -- --config-file path/to/your/config.json

# Use strict mode to require all connections to succeed
npm start -- --config-file path/to/your/config.json --strict
```

### Creating Custom Servers

You can create your own MCP-compatible servers to add new capabilities. Check out the [Model Context Protocol documentation](https://github.com/microsoft/MCP/blob/main/specification/specification.md) to learn how to create custom tools.

## 🧩 Architecture

Saiki follows a modular design with four main components:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    Client       │◄──────┤   AI Service    │◄──────┤    Interface    │
│    Manager      │       │     Layer       │       │     Layer       │
└─────────────────┘       └─────────────────┘       └─────────────────┘
        ▲                        ▲                         ▲
        │                        │                         │
        ▼                        ▼                         ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Tool Servers   │       │  LLM Provider   │       │  Configuration  │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

1. **Client Manager**: Manages connections to tool servers and coordinates tool execution
   - Handles server initialization and connection management
   - Aggregates tools from multiple servers
   - Routes tool calls to appropriate servers

2. **AI Service Layer**: Processes natural language using LLM providers
   - Manages conversation context and history
   - Translates natural language to tool calls
   - Handles LLM provider integration (OpenAI, etc.)

3. **Interface Layer**: Provides user interaction
   - Currently implements CLI interface
   - Handles user input and output formatting
   - Manages interaction flow and command processing

4. **Supporting Components**:
   - **Tool Servers**: MCP-compatible servers providing various capabilities
   - **LLM Provider**: AI service integration (currently OpenAI)
   - **Configuration**: Unified config management for all components

## 🔧 Development

For development with automatic recompilation:

```bash
# In terminal 1: Watch TypeScript files and recompile on changes
npm run dev

# In terminal 2: Run the application
npm start
```

## 🤝 Contributing

We'd love your help making Saiki better! Here are some ways to contribute:

### Ways to Contribute
- **Add Tool Configs**: Connect existing MCP-compatible servers
- **Build Examples**: Create example scripts or use cases
- **Create Custom Servers**: Build your own MCP-compatible servers
- **Report Issues**: Let us know about bugs or feature requests

### Getting Started
1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Try adding a new tool server config or building an example
4. Submit a pull request

### MCP Resources
- [Smithery.ai](https://smithery.ai/) - Browse hundreds of ready-to-use MCP servers
- [MCP Documentation](https://modelcontextprotocol.io/introduction) - Official MCP specification
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - For building custom servers
