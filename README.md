# MCP Connector with AI CLI

An AI-powered CLI for interacting with MCP servers using natural language. Connect to MCP servers like ClaudeDesktopCommander to gain powerful capabilities such as file operations, terminal commands, and more.

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

3. Connect to ClaudeDesktopCommander:

**Windows:**
```cmd
scripts\windows\ai-cli.bat
```

**Unix/Linux:**
```bash
chmod +x scripts/unix/ai-cli.sh
./scripts/unix/ai-cli.sh
```

## Using the AI CLI

Once connected, you can interact with the MCP server using natural language:

```
> List all files in this directory
> Create a new file called hello.txt with content "Hello, world!"
> Check the system CPU usage
> Find all JavaScript files in the current directory
```

The AI translates your natural language into MCP tool calls, enabling you to interact with your system seamlessly.

## Connect to Different MCP Servers

The AI CLI can connect to any MCP server. Here are some examples:

**Windows:**
```cmd
# Connect to file system MCP server
node dist\ai.js connect npx -- -y @modelcontextprotocol/server-filesystem

# Connect to a custom MCP server
node dist\ai.js connect node -- path\to\your-server.js
```

**Unix/Linux:**
```bash
# Connect to file system MCP server
node dist/ai.js connect npx -- -y @modelcontextprotocol/server-filesystem

# Connect to a custom MCP server
node dist/ai.js connect node -- path/to/your-server.js
```

## Using the Connect-MCP Script

If you prefer a standard command-line interface without AI interpretation, you can use the `connect-mcp` script. This provides direct access to MCP commands and is useful when you need precise control or when working with MCP tools programmatically.

**Windows:**
```cmd
scripts\windows\connect-mcp.bat npx -- -y @wonderwhy-er/desktop-commander
```

**Unix/Linux:**
```bash
chmod +x scripts/unix/connect-mcp.sh
./scripts/unix/connect-mcp.sh npx -- -y @wonderwhy-er/desktop-commander
```

Once connected, you'll get a standard MCP interface where you can run commands like:

```
MCP> list-tools
MCP> call filesystem.list_files {"path":"."}
MCP> server-info
MCP> help
MCP> exit
```

Unlike the AI CLI, this interface requires exact MCP command syntax but offers more direct and predictable interaction with the MCP server.

## MCP Server Configuration

The project now supports a configuration file for defining MCP servers. This makes it easy to add, modify, or share server configurations without changing code.

### Configuration File

Server configurations are stored in `configuration/mcp.json`:

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

### Using Server Aliases

With the configuration in place, you can use server aliases instead of full commands:

```bash
# Using an alias
./scripts/unix/ai-cli.sh desktopCommander

# List available server aliases
./scripts/unix/list-servers.sh
```

This makes it easier to switch between different MCP servers and share configurations with others.

## MCP Server Capabilities

Different MCP servers provide different capabilities:

- **ClaudeDesktopCommander**: File operations, terminal commands, system information
- **@modelcontextprotocol/server-filesystem**: File system operations
- **Custom servers**: Any capabilities you implement

## Features

- 🤖 **Natural Language Interface**: Interact with MCP servers using plain English
- 🔌 **MCP Integration**: Connect to any MCP-compatible server
- 🧠 **AI-Powered**: Uses OpenAI to translate natural language to specific MCP tool calls
- 🛠️ **Extensible**: Gain new capabilities by connecting to different MCP servers

## License

MIT