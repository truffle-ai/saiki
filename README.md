# MCP Connector with AI CLI

An AI-powered CLI for interacting with multiple MCP servers using natural language. Connect to multiple MCP servers simultaneously to gain powerful capabilities such as file operations, terminal commands, and more, all through a single interface.

## Quick Start

1. Clone and install:
```bash
git clone <repository-url>
cd mcp-connector
npm install
npm run build
```

2. Create a `.env` file with your OpenAI API key:
```
OPENAI_API_KEY=your_openai_api_key_here
```

3. Run the AI CLI:

```bash
npm start
```

## Development

For development with automatic recompilation:

```bash
# In terminal 1: Watch TypeScript files and recompile on changes
npm run dev

# In terminal 2: Run the application
npm start
```

## Using the AI CLI

Once connected, you can interact with all MCP servers using natural language:

```
> List all files in this directory
> Create a new file called hello.txt with content "Hello, world!"
> Check the system CPU usage
> Find all JavaScript files in the current directory
```

The AI translates your natural language into MCP tool calls, choosing the appropriate server for each task automatically.

## Connect to Custom MCP Servers

By default, the AI CLI uses the servers defined in `configuration/mcp.json`. To use a custom set of servers, create your own configuration file:

```bash
# Connect using a custom configuration file
npm start -- --config-file path/to/your/config.json

# Use strict mode to require all connections to succeed
npm start -- --config-file path/to/your/config.json --strict

# Disable verbose output
npm start -- --no-verbose

# Specify a different model
npm start -- --model gpt-4o
```

## Server Configuration File

The server configuration file defines the MCP servers to connect to. Each server is specified with a command to execute and arguments:

```json
{
  "desktopCommander": {
    "command": "npx",
    "args": ["-y", "@wonderwhy-er/desktop-commander"]
  },
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem"]
  },
  "local": {
    "command": "node",
    "args": ["dist/host.js", "stdio"]
  }
}
```

Each key is a server alias, and the value contains:
- `command`: The executable to run
- `args`: Array of command-line arguments
- `env` (optional): Environment variables for the server process

The AI CLI will connect to all servers in the configuration file and make all of their tools available in a single interface. If any server fails to connect, the CLI will continue with the successful connections unless strict mode is enabled.

## Connection Modes

The AI CLI supports two connection modes:

- **Lenient mode** (default): Allows the CLI to start as long as at least one server connects successfully
- **Strict mode**: Requires all configured servers to connect successfully

## Common MCP Server Types

Different MCP servers provide different capabilities:

- **ClaudeDesktopCommander**: File operations, terminal commands, system information
- **@modelcontextprotocol/server-filesystem**: File system operations
- **Custom servers**: Any capabilities you implement

By connecting to multiple servers simultaneously, you can access all of these capabilities through a single interface.

## Features

- 🤖 **Natural Language Interface**: Interact with MCP servers using plain English
- 🔌 **Multi-Server Support**: Connect to multiple MCP servers simultaneously
- 🧠 **AI-Powered**: Uses OpenAI to translate natural language to specific MCP tool calls
- 🛠️ **Extensible**: Gain new capabilities by connecting to different MCP servers
- 🔄 **Connection Resilience**: Continue operating even if some servers fail to connect

## License

MIT