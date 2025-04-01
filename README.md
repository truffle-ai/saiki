# Saiki

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/Node.js-16+-green.svg" alt="Node.js: 16+">
</p>

> Your command center for controlling computers and services with natural language - connect once, command everything.

## 🌟 Overview

Saiki creates a unified interface where your natural language commands are routed to the right tools. Whether you're managing files, running development tasks, or integrating with external services, just say what you want done - Saiki handles the rest.

### What makes Saiki special:

- **Natural Language Control**: Express your intent in plain English
- **Universal Connectivity**: Seamlessly connects to multiple tool servers
- **AI-Powered Understanding**: Leverages advanced AI to interpret your requests
- **Extensible Architecture**: Easily expand capabilities by connecting new tools
- **Cross-Platform**: Works via command line today, web interface coming soon
- **MCP Compatible**: Connect your own servers using the Model Context Protocol

### Why Saiki is Different

While Saiki is an AI agent framework at its core, it takes a unique approach to agent architecture:

#### 🏗️ Production-First Architecture
Unlike research-focused frameworks, Saiki is built for production environments:
- Process-level tool isolation for reliability
- Robust error handling and recovery
- Standard DevOps practices and configurations
- Clear security boundaries and controls
- Structured logging and debugging

#### 📡 Protocol-First Design
Built on the Model Context Protocol (MCP), enabling:
- Self-describing, discoverable tools
- No framework lock-in
- Universal tool compatibility
- Standardized capability exposure
- Easy tool sharing across projects

#### 🎯 Balanced Autonomy
Combines autonomous capabilities with structured control:
- AI-powered decision making
- Predictable tool execution
- Clear execution boundaries
- Transparent operation flow
- Controllable tool access

#### 💻 Developer Experience
Created by developers, for developers:
- Standard development workflows
- Familiar configuration patterns
- Clear architectural boundaries
- Extensive debugging capabilities
- Easy local development

## 🚀 Quick Start

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

## 💻 Using Saiki

Once running, interact naturally with your connected tools. Here are some real-world examples:

### Example 1: Project Analysis
```
> Find all TODO comments in the src directory

📁 Scanning source files...
Found 3 TODOs:
src/components/Auth.tsx:45 - TODO: Add refresh token handling
src/utils/api.ts:23 - TODO: Implement rate limiting
src/app/index.ts:12 - TODO: Add error logging
```

### Example 2: Code Generation
```
> Create a new React component called UserProfile with typescript

✨ Creating src/components/UserProfile.tsx...

Generated component:
import React from 'react';

interface UserProfileProps {
  username: string;
  email: string;
  avatar?: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  username,
  email,
  avatar
}) => {
  return (
    <div className="user-profile">
      {avatar && <img src={avatar} alt={username} className="avatar" />}
      <h2>{username}</h2>
      <p>{email}</p>
    </div>
  );
};
```

### Example 3: Git Operations
```
> Show me files changed in the last commit

📦 Last commit changes:
Modified:
  - src/utils/auth.ts (+25/-12)
  - src/components/Login.tsx (+45/-8)
Added:
  - src/types/auth.types.ts (+67)
Deleted:
  - src/old-auth.ts

Total: 3 files changed, 137 additions, 20 deletions
```

### Example 4: Development Workflow
```
> Start the dev server and show me the package.json scripts

🚀 Starting development server...
Server running at http://localhost:3000

📄 Available scripts in package.json:
- dev: "next dev"
- build: "next build"
- start: "next start"
- lint: "eslint ."
- test: "jest"
- format: "prettier --write ."
```

Each command can be expressed naturally, and Saiki will figure out the best way to accomplish the task using your connected tools.

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

The architecture is designed to be:
- **Modular**: Each component is independent and replaceable
- **Extensible**: Easy to add new tool servers and capabilities
- **Flexible**: Supports multiple interface types and AI providers
- **Maintainable**: Clear separation of concerns and responsibilities

## 🔧 Development

For development with automatic recompilation:

```bash
# In terminal 1: Watch TypeScript files and recompile on changes
npm run dev

# In terminal 2: Run the application
npm start
```

## 📋 Requirements

- Node.js 16+
- npm
- OpenAI API key
- Internet connection (for OpenAI API and downloading servers)

## 🤝 Contributing

We'd love your help making Saiki better! Here are some easy ways to contribute:

### Ways to Contribute

- **Add Tool Configs**: Connect existing MCP-compatible servers to expand Saiki's capabilities
- **Build Examples**: Create example scripts or use cases showing what Saiki can do
- **Create Custom Servers**: Build your own MCP-compatible servers for unique functionality
- **Report Issues**: Let us know if you find bugs or have feature requests

### Getting Started

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Try adding a new tool server config or building an example
4. Submit a pull request

### MCP Resources

To help you get started with building and using MCP servers:

- [Smithery.ai](https://smithery.ai/) - Browse hundreds of ready-to-use MCP servers
- [MCP Documentation](https://modelcontextprotocol.io/introduction) - Official MCP specification and docs
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - For building your own MCP servers

We believe in keeping things simple and focused on making Saiki even more powerful through community contributions.

## 📜 License

MIT
