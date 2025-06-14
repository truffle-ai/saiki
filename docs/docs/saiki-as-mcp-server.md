---
sidebar_position: 8
---

# Using Saiki as an MCP Server

Saiki can be used as a Model Context Protocol (MCP) server, allowing other applications and AI tools to connect to it and use its capabilities.

This lets Cursor/Claude desktop, any other client talk to your saiki agent, enabling multi-agent communication!

By default, saiki has tools to access files and browse the web, but you can configure this too by changing saiki's config file!
Check out our [Configuration guide](./configuring-saiki/overview)

## Local MCP Server guide


### Setup in Cursor

1. **Create or edit your `.cursor/mcp.json` file:**

Use the default saiki configuration
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

Using a custom saiki configuration:
Note: if you use a different llm in your config file, you will need to pass the env variable for that provider.

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
- `chat_with_agent`: Interact with saiki AI agent

**Available tools that saiki has:**

By default, saiki is an AI agent that has tools to:
- browse the web
- search files on your local system

But you can customize the tools by using a custom saiki configuration file. Check out our [Configuration guide](./configuring-saiki/overview).

**Example Usage in Cursor:**

1. **Ask Saiki for help:**
   ```bash
   Hey saiki help me refactor this function to be more efficient
   ```

2. **Get file analysis:**
   ```bash
   Hey saiki analyze the architecture of this project
   ```

3. **Browse the web:**
   ```ba
   Hey saiki search the web for soccer shoes under $100
   ```

4. **Any custom functionality**
    You can configure saiki to have any other custom functionality by setting up your own config file and using it here. Check out our [Configuration guide](./configuring-saiki/overview)

## Remote MCP Server Setup

### Step 1: Start Saiki in Server Mode

```bash
saiki --mode server
```

**Options:**
```bash
# Custom port using environment variable
API_PORT=8080 saiki --mode server

# Custom port for network access
API_PORT=3001 saiki --mode server

# Enable debug logging
saiki --mode server --debug
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
saiki --mode mcp --debug
``` 