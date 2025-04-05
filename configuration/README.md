# Configuration Guide

Saiki uses a YAML configuration file to define tool servers and AI settings. This guide provides detailed information on all available configuration options.

## Configuration File Location

By default, Saiki looks for a configuration file at `configuration/saiki.yml` in the project directory. You can specify a different location using the `--config-file` command-line option:

```bash
npm start -- --config-file path/to/your/config.yml
```

## Configuration Structure

The configuration file has two main sections:

1. `mcpServers`: Defines the tool servers to connect to
2. `llm`: Configures the AI provider settings

### Basic Example

```yaml
mcpServers:
  github:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-github"
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: your-github-token
  filesystem:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - .
llm:
  provider: openai
  model: gpt-4
  apiKey: env:OPENAI_API_KEY
```

## Tool Server Configuration

Each entry under `mcpServers` defines a tool server to connect to. The key (e.g., "github", "filesystem") is used as a friendly name for the server.

Tool servers can either be local servers (stdio) or remote servers (sse)

### Stdio Server Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `type` | string | Yes | The type of the server, needs to be 'stdio' |
| `command` | string | Yes | The executable to run |
| `args` | string[] | No | Array of command-line arguments |
| `env` | object | No | Environment variables for the server process |

### SSE Server Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `type` | string | Yes | The type of the server, needs to be 'sse' |
| `url` | string | Yes | The url of the server |
| `headers` | map | No | Optional headers for the url |

## LLM Configuration

The `llm` section configures the AI provider settings.

### LLM Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `provider` | string | Yes | AI provider (e.g., "openai", "anthropic") |
| `model` | string | Yes | The model to use |
| `apiKey` | string | Yes | API key or environment variable reference |
| `providerOptions` | object | No | Provider-specific options like temperature and maxTokens |

### API Key Configuration

You can specify the API key directly or reference an environment variable:

```yaml
apiKey: sk-actual-api-key  # Direct specification (not recommended)
apiKey: env:OPENAI_API_KEY  # Reference to environment variable
```

### Windows Support

On Windows systems, some commands like `npx` may have different paths. The system attempts to automatically detect and uses the correct paths for these commands on Windows. If you run into any issues during server initialization, you may need to adjust the path to your `npx` command.

## Supported Tool Servers

Here are some commonly used MCP-compatible tool servers:

### GitHub

```yaml
github:
  type: stdio
  command: npx
  args:
    - -y
    - "@modelcontextprotocol/server-github"
  env:
    GITHUB_PERSONAL_ACCESS_TOKEN: your-github-token
```

### Filesystem

```yaml
filesystem:
  type: stdio
  command: npx
  args:
    - -y
    - "@modelcontextprotocol/server-filesystem"
    - .
```

### Terminal

```yaml
terminal:
  type: stdio
  command: npx
  args:
    - -y
    - "@modelcontextprotocol/server-terminal"
```

### Desktop Commander

```yaml
desktop:
  type: stdio
  command: npx
  args:
    - -y
    - "@wonderwhy-er/desktop-commander"
```

### Custom Server

```yaml
custom:
  type: stdio
  command: node
  args:
    - --loader
    - ts-node/esm
    - src/servers/customServer.ts
  env:
    API_KEY: your-api-key
```

### Remote Server

This example uses a remote github server provided by composio.
The URL is just a placeholder which won't work out of the box since the URL is customized per user.
Go to mcp.composio.dev to get your own MCP server URL.

```yaml
github-remote:
  type: sse
  url: https://mcp.composio.dev/github/repulsive-itchy-alarm-ABCDE
```

### Remote Server

This example uses a remote github server provided by composio.
The URL is just a placeholder which won't work out of the box since the URL is customized per user.
Go to mcp.composio.dev to get your own MCP server URL.

```json
"custom": {
    "type": "sse",
    "url": "https://mcp.composio.dev/github/repulsive-itchy-alarm-ABCDE"
}
```

## Command-Line Options

Saiki supports several command-line options:

| Option | Description |
|--------|-------------|
| `--config-file` | Specify a custom configuration file |
| `--strict` | Require all connections to succeed |
| `--verbose` | Enable verbose logging |
| `--help` | Show help |

## Complete Example

Here's a comprehensive configuration example using multiple tool servers:

```yaml
mcpServers:
  github:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-github"
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: your-github-token
  filesystem:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - .
  terminal:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-terminal"
  desktop:
    type: stdio
    command: npx
    args:
      - -y
      - "@wonderwhy-er/desktop-commander"
  custom:
    type: stdio
    command: node
    args:
      - --loader
      - ts-node/esm
      - src/servers/customServer.ts
    env:
      API_KEY: your-api-key
llm:
  provider: openai
  model: gpt-4
  apiKey: env:OPENAI_API_KEY
``` 