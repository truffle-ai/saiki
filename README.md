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