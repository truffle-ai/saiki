---
sidebar_position: 9
sidebar_label: "Using Saiki to group MCP servers"
---

# Using Saiki CLI to group MCP servers together

Saiki can operate in **MCP Tools Mode**, where it acts as a local tool aggregation server that groups MCP servers and re-exposes them all under 1 common MCP servdr. 

Unlike the regular MCP server mode where you interact with a Saiki AI agent, this mode provides direct access to the underlying tools without an AI intermediary.

This is useful when you want to:
- Access tools from multiple MCP servers through a single connection
- Group tools directly without AI agent processing
- Create a centralized tool hub for your development environment

## How It Works

In MCP Tools Mode, Saiki:
1. Connects to multiple MCP servers as configured
2. Aggregates all available tools from these servers
3. Exposes them directly as its own local MCP server
4. Acts as a pass-through for tool execution

## Configuration

### Step 1: Create a Saiki Configuration File

Create a `saiki-tools.yml` configuration file with the MCP servers you want to aggregate:

```yaml
# saiki-tools.yml
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - "."
  
  puppeteer:
    type: stdio
    command: npx
    args:
      - -y
      - "@truffle-ai/puppeteer-server"
```

 - You don't need LLM configuration for tools mode
 - Only the mcpServers section is used

### Step 2: Setup in Cursor

Add the following to your `.cursor/mcp.json` file:

```json
{
  "mcpServers": {
    "saiki-tools": {
      "command": "npx",
      "args": [
        "-y", 
        "@truffle-ai/saiki", 
        "mcp-tools",
        "-c", 
        "path/to/your/saiki-tools.yml"
      ]
    }
  }
}
```

Or use the default Saiki configuration

```json
{
  "mcpServers": {
    "saiki-tools": {
      "command": "npx",
      "args": [
        "-y", 
        "@truffle-ai/saiki", 
        "mcp-tools",
      ]
    }
  }
}
```

### Step 3: Restart Cursor

After adding the configuration, restart Cursor to load the new MCP server.
