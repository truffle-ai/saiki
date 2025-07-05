---
sidebar_position: 2
sidebar_label: "Config Commands"
---

# Configuration Management with `saiki config`

The `saiki config` command provides both interactive and non-interactive CLI interfaces for building and managing agent configurations. Create, save, load, and export configurations either through an intuitive wizard-style interface or with comprehensive command-line flags for automation.

## Quick Start

```bash
# Interactive mode - create a new configuration with prompts
saiki config create

# Non-interactive mode - create a complete configuration with flags
saiki config create \
  --provider openai \
  --model gpt-4o-mini \
  --name "My Dev Agent" \
  --description "Development-focused agent"

# List all saved configurations
saiki config list

# Show a configuration in different formats
saiki config show my-config-id --format table

# Update specific settings
saiki config update my-config-id \
  --model gpt-4o \
  --add-mcp-servers github,slack

# Export to different formats
saiki config export my-config-id --format json

# Validate a configuration file
saiki config validate ./my-config.yml
```

## Available Commands

### `saiki config create`

Create a new agent configuration through interactive prompts or command-line flags.

#### Interactive Mode
```bash
# Launch interactive wizard
saiki config create

# Quick setup with defaults
saiki config create --quick
```

#### Non-Interactive Mode
```bash
# Complete configuration with flags
saiki config create \
  --provider anthropic \
  --model claude-4-sonnet-20250514 \
  --mcp-servers filesystem,puppeteer,github \
  --system-prompt "You are a helpful coding assistant" \
  --name "Code Helper" \
  --description "Assistant for coding tasks" \
  --router vercel \
  --temperature 0.7 \
  --max-iterations 25
```

#### All Options

**Basic Options:**
- `--save` / `--no-save` - Save configuration for reuse (default: true)
- `--output <path>` - Output file path
- `--quick` - Quick mode with sensible defaults

**LLM Configuration:**
- `--provider <provider>` - LLM provider (`openai`, `anthropic`, `google`, `groq`)
- `--model <model>` - Model name (e.g., `gpt-4o-mini`, `claude-4-sonnet-20250514`)
- `--api-key <key>` - API key (not recommended, use environment variables)
- `--env-var <var>` - Environment variable name for API key
- `--base-url <url>` - Custom base URL (OpenAI only)
- `--router <router>` - LLM router (`vercel`, `in-built`) (default: `vercel`)
- `--max-iterations <num>` - Maximum iterations for agentic loops (default: `50`)
- `--max-input-tokens <num>` - Maximum input tokens for conversation history
- `--max-output-tokens <num>` - Maximum output tokens per response
- `--temperature <temp>` - Temperature for response randomness (0-1)

**MCP Server Configuration:**
- `--mcp-preset <preset>` - Server preset (`essential`, `developer`, `productivity`, `data`)
- `--mcp-servers <servers>` - Comma-separated list of server IDs
- `--no-mcp` - Skip MCP server configuration

**System Prompt Configuration:**
- `--system-prompt <prompt>` - Custom system prompt text
- `--prompt-type <type>` - Prompt type (`default`, `specialist`, `custom`)
- `--specialist-role <role>` - Specialist role (`developer`, `writer`, `analyst`, `manager`)

**Metadata:**
- `--name <name>` - Configuration name for saving
- `--description <desc>` - Configuration description

#### Examples

**Quick Development Setup:**
```bash
saiki config create \
  --provider openai \
  --model gpt-4o-mini \
  --mcp-preset developer \
  --specialist-role developer \
  --name "Dev Agent"
```

**Production Configuration:**
```bash
saiki config create \
  --provider anthropic \
  --model claude-4-sonnet-20250514 \
  --mcp-servers filesystem,puppeteer \
  --system-prompt "You are a production assistant with security awareness" \
  --temperature 0.3 \
  --max-iterations 10 \
  --name "Production Bot" \
  --description "Conservative agent for production environments"
```

### `saiki config update [id]`

Update an existing saved configuration. Supports both interactive selection and direct flag updates.

#### Interactive Mode
```bash
# Interactive selection and prompts
saiki config update

# Update specific configuration interactively
saiki config update my-config-123
```

#### Non-Interactive Mode
```bash
# Update specific settings with flags
saiki config update my-config-123 \
  --model gpt-4o \
  --add-mcp-servers github,slack \
  --temperature 0.8

# Switch providers completely
saiki config update my-config-123 \
  --provider anthropic \
  --model claude-4-sonnet-20250514
```

#### Update-Specific Options

All create options plus:

**MCP Server Management:**
- `--add-mcp-servers <servers>` - Add servers to existing configuration
- `--remove-mcp-servers <servers>` - Remove specific servers
- `--clear-mcp` - Remove all MCP servers

#### Examples

**Add Tools to Existing Agent:**
```bash
saiki config update dev-agent-123 \
  --add-mcp-servers github,slack \
  --description "Dev agent with GitHub and Slack integration"
```

**Switch to More Powerful Model:**
```bash
saiki config update my-config \
  --model gpt-4o \
  --max-input-tokens 128000 \
  --temperature 0.9
```

**Remove Expensive Tools:**
```bash
saiki config update cost-conscious-agent \
  --remove-mcp-servers puppeteer,brave_search \
  --max-iterations 5
```

### `saiki config list`

Display all saved configurations with flexible formatting options.

#### Options
- `--format <format>` - Output format (`table`, `json`, `yaml`) (default: `table`)
- `--verbose` - Show detailed information

#### Examples

**Default Table View:**
```bash
saiki config list
```

**JSON Output for Scripting:**
```bash
saiki config list --format json
```

**Detailed Information:**
```bash
saiki config list --verbose
```

**YAML Output:**
```bash
saiki config list --format yaml --verbose
```

### `saiki config show [id]`

Display a specific configuration with detailed information.

#### Options
- `--format <format>` - Output format (`yaml`, `json`, `table`) (default: `yaml`)
- `--minify` - Minify JSON output

#### Examples

**Human-Readable Table:**
```bash
saiki config show my-config --format table
```

**Complete YAML Configuration:**
```bash
saiki config show my-config --format yaml
```

**Minified JSON for APIs:**
```bash
saiki config show my-config --format json --minify
```

### `saiki config export [id]`

Export a saved configuration to a file with multiple format options.

#### Options
- `--output <path>` - Output file path (defaults to `agents/<name>.yml`)
- `--format <format>` - Export format (`yaml`, `json`) (default: `yaml`)
- `--minify` - Minify JSON output

#### Examples

**Export to Default Location:**
```bash
saiki config export my-config
```

**Export as JSON:**
```bash
saiki config export my-config --format json --output ./config.json
```

**Export Minified for Production:**
```bash
saiki config export prod-config --format json --minify --output ./dist/config.json
```

### `saiki config validate <file>`

Validate a configuration file against the schema with detailed error reporting.

#### Options
- `--format <format>` - Input format (`auto`, `yaml`, `json`) (default: `auto`)
- `--strict` - Enable strict validation mode

#### Examples

**Validate YAML File:**
```bash
saiki config validate ./my-config.yml
```

**Validate JSON with Strict Mode:**
```bash
saiki config validate ./config.json --format json --strict
```

**Auto-Detect Format:**
```bash
saiki config validate ./unknown-format-file --format auto
```

### `saiki config delete [id]`

Remove saved configurations with force options for automation.

#### Options
- `--force` - Skip confirmation prompt
- `--all` - Delete all configurations (requires `--force`)

#### Examples

**Interactive Deletion:**
```bash
saiki config delete
```

**Force Delete Specific Config:**
```bash
saiki config delete old-config-123 --force
```

**Delete All Configurations:**
```bash
saiki config delete --all --force
```

## Configuration Files

Generated configurations are saved as YAML files:

```yaml
# Saiki Agent Configuration
# Generated on 2024-01-15T10:30:00.000Z

systemPrompt: "You are a helpful AI assistant with access to tools."

mcpServers:
  filesystem:
    type: stdio
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "."
    connectionMode: strict
  
  github:
    type: stdio
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-github"
    connectionMode: lenient

llm:
  provider: openai
  model: gpt-4o-mini
  apiKey: ${OPENAI_API_KEY}
  router: vercel
  maxIterations: 50
  temperature: 0.7
```

## Environment Setup

Set required environment variables for your chosen LLM provider:

```bash
# OpenAI
export OPENAI_API_KEY="sk-..."

# Anthropic  
export ANTHROPIC_API_KEY="sk-ant-..."

# Google
export GOOGLE_API_KEY="AIza..."

# Groq
export GROQ_API_KEY="gsk_..."
```

## Using Generated Configurations

All generated configuration files work with Saiki CLI commands:

```bash
# Start interactive session  
saiki --agent agents/my-agent.yml

# Start as MCP server
saiki --mode mcp --agent agents/my-agent.yml

# Start Discord bot
saiki --mode discord --agent agents/my-agent.yml

# Start Telegram bot
saiki --mode telegram --agent agents/my-agent.yml
```

## Best Practices

### Interactive vs Non-Interactive

**Use Interactive Mode When:**
- Learning about available options
- Exploring MCP servers and their capabilities
- Creating one-off configurations
- You want guided assistance

**Use Non-Interactive Mode When:**
- Automating configuration creation
- CI/CD pipelines
- Scripting batch operations
- You know exactly what you want

### Security
- **Use environment variables** for API keys
- **Never commit hardcoded keys** to version control
- **Review exported YAML** before sharing
- **Use `--force` carefully** in automation scripts

### Organization
- **Use descriptive names** for saved configurations
- **Keep consistent naming** across environments
- **Version control YAML files** (they're safe to commit)
- **Validate configurations** before deployment

### Performance
- **Use appropriate models** for your use case
- **Set reasonable `maxIterations`** to control costs
- **Choose `temperature`** based on task requirements
- **Configure `maxInputTokens`** for large contexts


### Getting Help

```bash
# Command help
saiki config --help

# Subcommand help
saiki config create --help
saiki config update --help

# List available options
saiki config create --help | grep -E "^\s*--"
```
