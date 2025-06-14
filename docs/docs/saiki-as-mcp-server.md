---
sidebar_position: 8
title: "Using Saiki as an MCP Server"
sidebar_label: "MCP Server"
---

# Using Saiki as an MCP Server

Saiki can act as a Model Context Protocol (MCP) server, enabling external tools like Cursor or Claude Desktop to connect and interact with your Saiki agent.

This allows Cursor, Claude Desktop, or any other client to communicate with your Saiki agent and enable multi-agent workflows.

By default, Saiki has tools to access files and browse the web, but you can configure this too by changing Saiki's config file!
Check out our [Configuration guide](./configuring-saiki/overview)

## Local MCP Server Guide


### Setup in Cursor

1. **Create or edit your `.cursor/mcp.json` file:**

Use the default Saiki configuration
```json
{
  "mcpServers": {
    "saiki": {
      "command": "npx",
      "args": ["-y", "@truffle-ai/saiki", "--mode", "mcp"],
      "env": {
        "OPENAI_API_KEY": "your_openai_api_key"
      }
    }
  }
}
```

Using a custom Saiki configuration:
Note: if you use a different LLM in your config file, you will need to pass the appropriate environment variable for that provider.

```json
{
  "mcpServers": {
    "saiki": {
      "command": "npx",
      "args": ["-y", "@truffle-ai/saiki", "--mode", "mcp", "--config-file", "path/to/your/saiki.yml"],
      "env": {
        "OPENAI_API_KEY": "your_openai_api_key"
      }
    }
  }
}
```


2. **Restart Cursor**

### Using Saiki in Cursor

**Available Tools in Cursor:**
- `chat_with_agent`: Interact with Saiki AI agent

**Available Saiki tools:**

By default, Saiki is an AI agent that has tools to:
- browse the web
- search files on your local system

But you can customize the tools by using a custom Saiki configuration file. Check out our [Configuration guide](./configuring-saiki/overview).

**Example Usage in Cursor:**

1. **Ask Saiki for help:**
   ```bash
   Ask Saiki to help me refactor this function to be more efficient
   ```

2. **Get file analysis:**
   ```bash
   Ask Saiki to analyze the architecture of this project
   ```

3. **Browse the web:**
   ```bash
   Ask Saiki to search the web for soccer shoes under $100
   ```

4. **Any custom functionality:**
    You can configure Saiki to have any other custom functionality by setting up your own config file and using it here. Check out our [Configuration guide](./configuring-saiki/overview)

## Remote MCP Server Setup

### Step 1: Start Saiki in Server Mode

```bash
# If installed globally
saiki --mode server

# Or via npx
npx @truffle-ai/saiki --mode server
```

**Options:**
```bash
# Custom port using environment variable
API_PORT=8080 saiki --mode server
# Or via npx
API_PORT=8080 npx @truffle-ai/saiki --mode server

# Custom port for network access
API_PORT=3001 saiki --mode server
# Or via npx
API_PORT=3001 npx @truffle-ai/saiki --mode server

# Enable debug logging
saiki --mode server --debug
# Or via npx
npx @truffle-ai/saiki --mode server --debug
```

### Step 2: Configure the Connection URL

**HTTP MCP Endpoint:**
```bash
http://localhost:3001/mcp
```

**For network access:**
```bash
http://YOUR_SERVER_IP:3001/mcp
```

### Remote Server in Cursor (WIP)
Cursor/Claude desktop don't support streamable http yet

## Troubleshooting

**Cursor not detecting MCP server:**
- Verify `.cursor/mcp.json` syntax is correct
- Restart Cursor after configuration changes
- Ensure @truffle-ai/saiki is installed and accessible
- Verify environment variables are set correctly

**Debug mode:**
```bash
# If installed globally
saiki --mode mcp --debug

# Or via npx
npx @truffle-ai/saiki --mode mcp --debug
``` 