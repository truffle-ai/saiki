---
sidebar_position: 9
sidebar_label: "Config Commands"
---

# Configuration Management with `saiki config`

The `saiki config` command provides an interactive CLI for building and managing agent configurations without manually editing YAML files. Create, save, load, and export configurations with an intuitive wizard-style interface.

## Quick Start

```bash
# Create a new configuration interactively
saiki config create

# Update an existing configuration
saiki config update my-config-id

# List all saved configurations
saiki config list

# Export a configuration to YAML file
saiki config export my-config-id

# Delete a saved configuration
saiki config delete my-config-id
```

## Commands

### `saiki config create`

Create a new agent configuration through an interactive wizard.

**Options:**
- `--save` - Save the configuration for reuse (default: true)
- `--no-save` - Don't save the configuration
- `--output <path>` - Specify output file path
- `--quick` - Use quick mode with sensible defaults

**Examples:**
```bash
# Create a new configuration
saiki config create

# Create with quick setup (skips most prompts)
saiki config create --quick

# Create and save to specific location
saiki config create --output ./my-config.yml

# Create without saving (export only)
saiki config create --no-save
```

### `saiki config update [id]`

Update an existing saved configuration. If no ID is provided, shows an interactive list to choose from.

**Options:**
- `--save` - Save the updated configuration (default: true)
- `--no-save` - Don't save the updated configuration
- `--output <path>` - Specify output file path

**Examples:**
```bash
# Update specific configuration
saiki config update my-config-123

# Interactive selection of configuration to update
saiki config update

# Update and export to specific path
saiki config update my-config-123 --output ./updated-config.yml
```

### `saiki config list`

Display all saved configurations with their details.

```bash
saiki config list
```

**Output:**
```
My Development Agent [dev-agent-123]
  Development-focused agent with GitHub and terminal access
  Created: 1/15/2024

Production Bot [prod-bot-456]  
  Production agent with essential tools only
  Created: 1/10/2024
```

### `saiki config export [id]`

Export a saved configuration to a YAML file. If no ID is provided, shows an interactive list to choose from.

**Options:**
- `--output <path>` - Specify output file path (defaults to `agents/<name>.yml`)

**Examples:**
```bash
# Export with interactive selection
saiki config export

# Export specific configuration to default location
saiki config export my-config-123

# Export to specific path
saiki config export my-config-123 --output ./custom/path.yml
```

### `saiki config delete [id]`

Remove a saved configuration permanently. If no ID is provided, shows an interactive list to choose from.

**Examples:**
```bash
# Delete with interactive selection
saiki config delete

# Delete specific configuration
saiki config delete my-config-123
```

## Interactive Configuration Wizard

### Creating a New Configuration

The wizard offers two modes:

#### Quick Mode
Uses sensible defaults with minimal prompts:
- **Provider**: OpenAI
- **Model**: gpt-4o-mini
- **API Key**: Environment variable (`$OPENAI_API_KEY`)
- **MCP Servers**: Essential preset (filesystem + puppeteer)
- **System Prompt**: Default assistant prompt

#### Full Interactive Mode
Complete customization with guided prompts:

```
┌   Create Agent Configuration
│
◇  Use quick setup with defaults? (Recommended for new users)
│  ○ Yes / ● No
│
◇  Choose your LLM provider
│  ● OpenAI (GPT-4, GPT-3.5, etc.)
│  ○ Anthropic (Claude models)
│  ○ Google (Gemini models)
│  ○ Groq (Fast inference)
│
◇  Choose the model for openai
│  ● gpt-4o-mini
│  ○ gpt-4o
│  ○ gpt-4.1
│  ○ o3-mini
│
◇  How do you want to handle the openai API key?
│  ● Use environment variable (Will use $OPENAI_API_KEY)
│  ○ Enter manually (Not recommended for production)
│  ○ Skip for now (Configure later)
│
◇  Select MCP servers (space to select/deselect, arrows to navigate, enter to confirm)
│  □ Filesystem (Development) - Secure file operations
│  □ Git (Development) - Git repository tools
│  □ GitHub (Development) - GitHub API integration
│  □ Puppeteer (Web) - Browser automation
│  □ Brave Search (Web) - Web search API
│  □ PostgreSQL (Database) - Database access
│  ... [22 total servers available]
│
◇  Customize the system prompt?
│  ○ Yes / ● No
```

### Updating Existing Configurations

When updating, the wizard shows current values and asks what to change:

```
┌   Update Agent Configuration
│
◆  Loaded configuration: My Development Agent
│
◇  Current LLM provider: openai. Change?
│  ● Keep openai
│  ○ OpenAI
│  ○ Anthropic
│  ○ Google
│  ○ Groq
│
◇  Current model: gpt-4o-mini. Press Enter to keep, or type new model:
│  gpt-4o-mini
│
◇  Current API key: $OPENAI_API_KEY. Change?
│  ● Keep current API key configuration
│  ○ Use environment variable
│  ○ Enter manually
│
◇  You have 3 MCP server(s) configured. What would you like to do?
│  ● Keep current servers
│  ○ Modify server selection
│  ○ Replace all servers
│
◇  Modify the system prompt?
│  ○ Yes / ● No
```

## MCP Server Registry

The configuration wizard includes **22 official MCP servers** organized by category:

### Available Categories and Servers

#### **Development (6 servers)**
- **filesystem** - Secure file operations with configurable access controls
- **git** - Tools to read, search, and manipulate Git repositories  
- **github** - Repository management, file operations, and GitHub API integration
- **gitlab** - GitLab API integration for project management
- **sentry** - Retrieving and analyzing issues from Sentry.io
- **everything** - Reference/test server with prompts, resources, and tools

#### **Web (3 servers)**
- **puppeteer** - Browser automation and web scraping
- **brave_search** - Web and local search using Brave's Search API
- **fetch** - Web content fetching and conversion for efficient LLM usage

#### **Database (2 servers)**
- **postgres** - Read-only PostgreSQL database access with schema inspection
- **sqlite** - Database interaction and business intelligence capabilities

#### **Productivity (3 servers)**
- **google_drive** - File access and search capabilities for Google Drive
- **google_maps** - Location services, directions, and place details
- **slack** - Channel management and messaging capabilities

#### **AI Services (3 servers)**
- **sequential_thinking** - Dynamic and reflective problem-solving through thought sequences
- **everart** - AI image generation using various models
- **hf_mcp_server** - Access to Hugging Face models and datasets through MCP

#### **System (1 server)**
- **memory** - Knowledge graph-based persistent memory system

#### **Utility (2 servers)**
- **time** - Time and timezone conversion capabilities
- **google_maps** - Location services, directions, and place details

#### **Cloud (1 server)**
- **aws_kb_retrieval** - Retrieval from AWS Knowledge Base using Bedrock Agent Runtime

### Quick Start Presets

In quick mode, you get the **Essential** preset:
- **filesystem** - Local file operations
- **puppeteer** - Web browsing and automation

### System Prompt Options

When customizing the system prompt, you can choose from:

1. **Default prompt** - General-purpose assistant
2. **Specialist prompts** with predefined roles:
   - **Software Developer** - Code-focused assistant
   - **Content Writer** - Writing and editing assistance
   - **Data Analyst** - Data and research focused
   - **Project Manager** - Planning and coordination
3. **Custom prompt** - Write your own system prompt

## Configuration Files

Generated configurations are saved as YAML files in the `agents/` directory:

```yaml
# Saiki Agent Configuration
# Generated by saiki config

systemPrompt: "You are a helpful AI assistant with access to tools. Use these tools when appropriate to answer user queries. You can use multiple tools in sequence to solve complex problems."

mcpServers:
  filesystem:
    type: stdio
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "."
    connectionMode: strict
  
  puppeteer:
    type: stdio
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-puppeteer"
    connectionMode: lenient

llm:
  provider: openai
  model: gpt-4o-mini
  apiKey: ${OPENAI_API_KEY}
```

## Environment Setup

Set the required environment variables for your chosen LLM provider:

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

For MCP servers requiring setup, additional environment variables may be needed:

```bash
# GitHub integration
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_..."

# Brave Search
export BRAVE_API_KEY="BSA..."

# PostgreSQL
export POSTGRES_CONNECTION_STRING="postgresql://user:pass@host:5432/db"

# Slack integration
export SLACK_BOT_TOKEN="xoxb-..."

# Google services
export GOOGLE_MAPS_API_KEY="AIza..."

# AWS services
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="us-east-1"

# Other services
export SENTRY_AUTH_TOKEN="sntrys_..."
export SENTRY_ORG_SLUG="my-org"
export EVERART_API_KEY="..."
export HUGGINGFACE_TOKEN="hf_..."
```

## Using Generated Configurations

Generated configuration files work with all Saiki CLI commands:

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

## Configuration Management Workflow

### 1. Create Base Configuration
```bash
# Quick start with defaults
saiki config create --quick

# Or full interactive setup
saiki config create
```

### 2. Save and Iterate
```bash
# List your configurations
saiki config list

# Update as needed
saiki config update my-config-id
```

### 3. Export and Deploy
```bash
# Export to YAML for deployment
saiki config export my-config-id

# Use in different environments
saiki --agent agents/my-agent.yml
```

## Best Practices

### Security
- **Use environment variables** for API keys - they're stored as `${API_KEY}` references
- **Never commit hardcoded keys** - generated files use environment variable syntax
- **Review exported YAML** before sharing or committing to version control

### Organization
- **Use descriptive names** when saving configurations
- **Keep the `agents/` directory** organized with meaningful filenames
- **Version control YAML files** - they're safe to commit (no hardcoded secrets)

### Workflow
- **Start with quick mode** for simple use cases
- **Use full mode** for complex, specialized agents
- **Update existing configs** instead of recreating from scratch
- **Test configurations** before deploying to production


## Getting Help

```bash
# Command help
saiki config --help

# Subcommand help
saiki config create --help
saiki config update --help

# General CLI help
saiki --help
```