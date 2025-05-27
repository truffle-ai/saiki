---
sidebar_position: 1
---

# Configuring Saiki

Saiki's power comes from its customizability. You can customize every facet of saiki with yml config files. This guide walks through all the different features of saiki you can customize.

We chose `yml` instead of the more popular `json` because of its support for comments (which we find super useful!), and better parsing libraries.

One of our core tenets is that for every new feature we add, we will add a configuration entry for it to allow users to use it easily.

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
  - This section represents the different MCP servers that you want to connect to Saiki
  - Each key represents a different MCP server
  - [Complete Reference](./mcpServers). 
- **llm:**
  - This section defines the configuration for the LLM that Saiki will use as its brain.
  - [Complete Reference](./llm)

## Best Practices

- **Use environment variables** for secrets and API keys. Reference them in YML as `$VARNAME`.
- **Keep your config in version control** (but never commit secrets!). Use `.env` files or CI secrets for sensitive values.
- **Document your config** for your team. Add comments to your YML files. We chose YML for this reason.
- **Validate your config** before running Saiki in production.
- **See the `configuration/examples/` folder for more templates and advanced use cases.**
 