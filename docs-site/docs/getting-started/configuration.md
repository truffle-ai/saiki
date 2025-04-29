---
sidebar_position: 5
---

# Configuring Saiki with YAML [WIP]

Saiki supports flexible configuration using YAML files, allowing you to customize connections, providers, and runtime options.

## Where to Place Your Config

By default, Saiki looks for a configuration file named `saiki.config.yml` in your project root or the current working directory. You can also specify a custom config path using the CLI:

```bash
saiki --config path/to/your-config.yml
```

## Example Configuration File

```yaml
# saiki.config.yml
llm:
  provider: openai
  api_key: $OPENAI_API_KEY
  model: gpt-4o
  temperature: 0.7

mcp_servers:
  - name: github
    url: http://localhost:3001
    token: $GITHUB_TOKEN
  - name: terminal
    url: http://localhost:3002

logging:
  level: info
  file: ./logs/saiki.log

timeout: 120
```

## Key Fields Explained

- **llm:**
  - `provider`: The LLM provider to use (e.g., `openai`, `anthropic`, `google`).
  - `api_key`: API key for the provider. You can use environment variables (recommended).
  - `model`: The model name (e.g., `gpt-4o`, `claude-3-opus-20240229`).
  - `temperature`: Controls randomness of responses.
- **mcp_servers:**
  - List of MCP servers Saiki should connect to. Each entry should include at least a `name` and `url`.
  - `token`: (Optional) Auth token for the server, can use env vars.
- **logging:**
  - `level`: Log verbosity (`debug`, `info`, `warn`, `error`).
  - `file`: (Optional) Path to a log file.
- **timeout:**
  - Maximum time (in seconds) to wait for tool responses.

## Best Practices

- **Use environment variables** for secrets and API keys. Reference them in YAML as `$VARNAME`.
- **Keep your config in version control** (but never commit secrets!). Use `.env` files or CI secrets for sensitive values.
- **Document your config** for your team. Add comments to your YAML files.
- **Validate your config** before running Saiki in production.

For advanced configuration options, see the [Configuration Reference](../configuring-saiki/configuration.md). 