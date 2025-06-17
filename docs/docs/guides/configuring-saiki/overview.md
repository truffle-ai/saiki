---
sidebar_position: 1
sidebar_label: "Overview"
---

# Configuring Saiki

Saiki's power comes from its customizability. You can customize every part of your Saiki agent with one `yml` config file. 

This guide walks through all the different features you can customize, and the expected format.

We chose `yml` instead of the more popular `json` because of its support for comments (which we find super useful!), and better parsing libraries.

## Where to Place Your Config

By default, Saiki uses a configuration file named `configuration/saiki.yml`. You can also specify a custom config path using the CLI:

```bash
saiki --config-file path/to/your-config.yml
```

## Example Configuration File

```yaml
# saiki.yml
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - .
  puppeteer:
    type: stdio
    command: node
    args:
      - dist/src/servers/puppeteerServer.js

llm:
  provider: openai
  model: gpt-4.1-mini
  # you can update the system prompt to change the behavior of the llm
  systemPrompt: |
    You are Saiki, a helpful AI assistant with access to tools.
    Use these tools when appropriate to answer user queries.
    You can use multiple tools in sequence to solve complex problems.
    After each tool result, determine if you need more information or can provide a final answer.
  apiKey: $OPENAI_API_KEY
```

## Key Sections Explained

- **mcpServers:**
  - This section represents the different MCP servers that you want to connect to your agent
  - Each key represents a different MCP server
  - [Complete Reference](./mcpServers)
- **llm:**
  - This section defines the configuration for the LLM that your agent will use as its brain.
  - [Complete Reference](./llm)
- **storage:**
  - This section defines where the agent will store conversation history, settings, and other data. 
  - [Complete Reference](./storage)

## Best Practices

- **Use environment variables** for secrets and API keys. Reference them in YML as `$VARNAME`.
- **Keep your config in version control** (but never commit secrets!). Use `.env` files or CI secrets for sensitive values.
- **Document your config** for your team. Add comments to your YML files. We chose YML for this reason.
- **Validate your config** before running Saiki in production.
- **See the `configuration/examples/` folder for more templates and advanced use cases.**
 