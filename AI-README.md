# AI-Powered MCP Client

An intelligent CLI that uses OpenAI to interpret natural language commands and interact with MCP servers through a modular architecture.

## Overview

This project takes our universal MCP client and adds an AI orchestration layer, creating a seamless experience for interacting with MCP servers using natural language. The system architecture is fully modular:

1. **MCP Connection Layer**: Handles server connections and communication
2. **AI Service Layer**: Processes natural language and orchestrates tool calls
3. **CLI Interface Layer**: Provides the user experience and visualization

## Architecture

The system follows a clean, modular design:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│                 │       │                 │       │                 │
│  MCP Connection │◄──────┤   AI Service    │◄──────┤  CLI Interface  │
│     Layer       │       │     Layer       │       │     Layer       │
│                 │       │                 │       │                 │
└─────────────────┘       └─────────────────┘       └─────────────────┘
        │                        │                         │
        ▼                        ▼                         ▼
  Server Communication    Natural Language         User Interaction
                           Processing
```

This architecture allows each component to be developed, tested, and extended independently.

## Requirements

- Node.js and npm
- OpenAI API key
- Internet connection (for OpenAI API and downloading MCP servers)

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/mcp-connector.git
   cd mcp-connector
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your OpenAI API key:
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

4. Build the project:
   ```bash
   npm run build
   ```

## Usage

### Unified Entry Point

The recommended way to access all MCP Connector features is through the universal entry point:

```bash
mcp-connector.bat
```

This will display a menu where you can select option 5 for the AI-powered interface.

### Direct AI Client Launch

You can also launch the AI-powered client directly with:

```bash
ai-cli.bat
```

This will:
1. Check for your OpenAI API key
2. Build the project if needed
3. Connect to the ClaudeDesktopCommander MCP server
4. Start an interactive AI-powered CLI

### Manual Usage

For advanced scenarios, you can run the AI CLI manually with any MCP server defined in your configuration:

```bash
node dist/ai.js connect <serverAlias> [options]
```

Examples:
```bash
# Connect to ClaudeDesktopCommander
node dist/ai.js connect desktopCommander

# Connect to a local server with verbose output
node dist/ai.js connect local -v

# Use a specific OpenAI model
node dist/ai.js connect local -m gpt-4-turbo
```

To add or modify server configurations, edit the `configuration/mcp.json` file.

## Extension Points

The modular architecture provides several natural extension points:

### MCP Connection Layer
- Add support for different transport types
- Implement connection pooling for multiple servers
- Add authentication and security features

### AI Service Layer
- Support different LLM providers
- Implement custom prompt engineering
- Add tool discovery and mapping

### CLI Interface Layer
- Create different visualization styles
- Implement web-based interfaces
- Add telemetry and logging

## Components

### McpConnection

Handles the connection to MCP servers:
- Creates and manages the transport
- Establishes the client connection
- Provides access to server capabilities

### AiService

Orchestrates the AI interaction:
- Processes natural language with OpenAI
- Maps MCP tools to OpenAI function calling
- Maintains conversation history for context

### CLI Interface

Provides the user experience:
- Takes user input and displays results
- Visualizes tool calls and their results
- Handles error reporting and status updates

## License

MIT
