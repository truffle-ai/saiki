---
sidebar_position: 9
sidebar_label: "Configure Command"
---

# Interactive Configuration with `saiki configure`

The `saiki configure` command provides a streamlined, intelligent CLI experience for building agent configurations without manually editing YAML files. Recent improvements include smart load workflows, proper YAML export, and automatic file management.

## Quick Start

```bash
# Start the interactive configuration builder
saiki configure

# List saved configurations
saiki configure --list

# Load and modify an existing configuration (improved workflow)
saiki configure --load my-config-id

# Export a configuration to agents/ directory
saiki configure --export my-config-id
```

## Key Improvements

### ✨ **Streamlined User Experience**
- **Smart Load Workflow**: When loading configurations, only asks about changes you want to make
- **Context-Aware Prompts**: Different questions based on whether you're creating or modifying
- **Intelligent Defaults**: Remembers previous choices and suggests appropriate defaults
- **Preset-First Approach**: Recommends proven MCP server combinations

### 📁 **Better File Management**
- **Automatic `agents/` Directory**: All configurations export to `agents/` by default
- **Complete YAML Export**: Properly includes all configuration fields including system prompts
- **Clean Filenames**: Generates appropriate filenames based on configuration names

### 🔧 **Improved Configuration Flow**
- **No Redundant Prompts**: Removed unnecessary agent naming (not used in final config)
- **Better API Key Handling**: Smarter detection of existing configurations
- **Simplified MCP Selection**: Preset-focused with clear upgrade paths

### 🔄 **Fixed Configuration Lifecycle**
- **Update vs Create**: When loading and modifying configurations, updates the existing one instead of creating duplicates
- **Proper State Management**: Correctly tracks configuration IDs throughout the modification process
- **No Name Conflicts**: Loading and saving configurations maintains proper unique identifiers

## Features

### 📦 **MCP Server Registry**
Curated library of 13+ popular MCP servers organized by categories:

- **Development**: filesystem, github, terminal
- **Web**: puppeteer, search
- **Database**: sqlite, postgres
- **Cloud Storage**: aws-s3, google-drive
- **Communication**: slack, discord
- **Productivity**: notion, calendar
- **System**: docker, kubernetes

### 💾 **Configuration Management**
- **Save Configurations**: Store reusable setups with names and descriptions
- **Smart Load & Modify**: Intelligent change detection when loading existing configs
- **Export to YAML**: Generate complete agent configuration files in `agents/`
- **Search & Filter**: Find configurations by name and description

## Command Options

| Option | Description |
|--------|-------------|
| `--save` | Save the configuration for later use (default: true) |
| `--no-save` | Do not save the configuration |
| `-o, --output <path>` | Output configuration file path (default: `agents/`) |
| `--load <id>` | Load an existing configuration to modify |
| `--list` | List all saved configurations |
| `--delete <id>` | Delete a saved configuration |
| `--export <id>` | Export a saved configuration to file |

## Interactive Walkthrough

### Creating a New Configuration

```
┌   Saiki Agent Configuration
│
◇  Choose your LLM provider
│  ● OpenAI
│  ○ Anthropic  
│  ○ Google
│  ○ Groq
│
◇  Enter the model name for openai
│  gpt-4o-mini
│
◇  How do you want to handle the openai API key?
│  ● Use environment variable (Will use $OPENAI_API_KEY)
│  ○ Enter manually (Not recommended for production)
│  ○ Skip for now (Configure later)
│
◇  How would you like to choose MCP servers?
│  ● Choose a preset (Recommended - common combinations)
│  ○ Browse by category (Select from organized categories)
│  ○ Select individually (Full control over selection)
│  ○ Skip MCP servers (Add them later)
│
◇  Choose a preset configuration
│  ● Essential Tools (Filesystem + Web browsing)
│  ○ Developer Setup (Essential + GitHub + Terminal)
│  ○ Productivity Suite (Essential + Notion + Slack)
│  ○ Data & Analytics (Essential + Database tools)
│
◇  Customize the system prompt?
│  ○ Yes / ● No
```

### Loading an Existing Configuration (Improved!)

```
┌   Saiki Agent Configuration
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
◇  You have 3 MCP server(s) configured. What would you like to do?
│  ● Keep current servers (No changes to MCP servers)
│  ○ Modify server selection (Add or remove servers)
│  ○ Replace all servers (Start fresh with server selection)
│
◇  Modify the system prompt?
│  ○ Yes / ● No
```

### Smart MCP Server Presets

Choose from optimized combinations:

- **Essential Tools**: filesystem + puppeteer (web browsing)
- **Developer Setup**: Essential + github + terminal 
- **Productivity Suite**: Essential + notion + slack
- **Data & Analytics**: Essential + sqlite + postgres

## Generated Configuration Files

Configurations are automatically saved to `agents/` directory with complete YAML:

```yaml
# Saiki Agent Configuration
# Generated on 2024-01-15T10:30:00.000Z

systemPrompt: "You are a helpful AI assistant with access to tools. Use these tools when appropriate to answer user queries. You can use multiple tools in sequence to solve complex problems."

mcpServers:
  filesystem:
    type: stdio
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "/allowed/path"
    connectionMode: lenient
  
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

## Configuration Lifecycle

### 📝 **Creating New Configurations**
When you run `saiki configure` without `--load`, you're creating a **new** configuration:
- Generates a unique ID (e.g., `my-agent-abc123`)
- Saves with your chosen name and description
- Exports YAML to `agents/` directory

### 🔄 **Updating Existing Configurations**
When you use `--load` to modify an existing configuration:
- **Updates the same configuration** (same ID)
- **No duplicates created** - modifies the existing saved config
- Maintains creation date but updates modification timestamp
- Exports updated YAML to `agents/` directory

```bash
# Load and modify (updates existing, doesn't create new)
saiki configure --load my-config-id

# The updated config keeps the same ID but has modified content
```

### ⚠️ **Important Behavior Changes**
Previously, loading and modifying a configuration would create a new saved configuration with the same name. **This has been fixed** - now it properly updates the existing configuration instead of creating duplicates.

**Additional UX Improvements:**
- **No More Double-Save Confusion**: Split save/export decisions for clarity - no more "update and export" confusion
- **Fixed MCP Server Selection Bug**: Now correctly shows all 13 available servers instead of just current ones
- **Better Selection Display**: Current servers marked with ✓, shows total available count, improved labeling
- **Navigation Hints**: Clear guidance about using Ctrl+C to cancel and process flow
- **Contextual Prompts**: Different messages based on whether creating new or modifying existing configs
- **Debug Logging**: Added logging to help diagnose selection issues if they occur

## Best Practices

### 🔐 **Security**
- **Use Environment Variables**: API keys stored as `${OPENAI_API_KEY}` format
- **Never Commit Keys**: Generated files use environment variable references
- **Review Generated YAML**: Check configurations before sharing

### 📁 **Organization** 
- **Use `agents/` Directory**: Default location keeps configurations organized
- **Descriptive Names**: Choose clear names for saved configurations
- **Version Control Safe**: Generated YAML files safe to commit (no hardcoded keys)

### 🔄 **Workflow**
1. **Start with Presets**: Use proven MCP server combinations
2. **Load and Iterate**: Modify existing configurations as needs evolve (now properly updates!)
3. **Save Templates**: Keep reusable configurations for different projects
4. **Export for Deployment**: Generate clean YAML files for production

## Environment Setup

Set required environment variables for your chosen provider:

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

## Integration with Other Commands

Generated configurations work seamlessly with all Saiki commands:

```bash
# Run with generated configuration
saiki run --config agents/my-agent.yml

# Start server
saiki server --config agents/my-agent.yml

# Validate configuration
saiki validate --config agents/my-agent.yml
```

## Configuration Management Examples

### List and Manage Configurations

```bash
# List all saved configurations
saiki configure --list

# Output:
# My Development Agent [dev-agent-123]
#   Development-focused agent with GitHub and terminal access
#   Created: 1/15/2024

# Production Bot [prod-bot-456]  
#   Production agent with essential tools only
#   Created: 1/10/2024

# Load and modify
saiki configure --load dev-agent-123

# Export to file
saiki configure --export prod-bot-456

# Delete configuration
saiki configure --delete old-config-789
```

### Custom Export Paths

```bash
# Export to specific location
saiki configure --export my-config --output ./configs/production.yml

# Export to agents/ (default)  
saiki configure --export my-config
# Creates: agents/my-development-agent.yml
```

## Troubleshooting

### Common Issues

**"Configuration not found"**
- Run `saiki configure --list` to see available configurations
- Use the ID shown in brackets `[config-id]`

**"Model not recognized"** 
- Check model name against provider's supported models
- Use the suggested defaults or verify custom model names

**"Permission denied creating agents/ directory"**
- Ensure you have write permissions in the current directory
- Try running from a different directory or with appropriate permissions

### Getting Help

- `saiki configure --help` - Command-specific options and usage
- `saiki --help` - General Saiki CLI information
- [MCP Server Guide](./mcp-servers.md) - Detailed server setup instructions
- [Configuration Reference](../reference/configuration.md) - Complete YAML format documentation

## Migration Notes

If you have existing configurations from previous versions:
- **Saved configurations work unchanged** - All existing saved configs are compatible
- **Better load experience** - Loading now shows current values and asks for changes only
- **Improved output format** - New exports include all fields and proper formatting
- **New default location** - Files now export to `agents/` by default (can override with `--output`)

The improved configure command maintains full backward compatibility while providing a much better user experience. 