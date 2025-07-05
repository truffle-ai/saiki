# Saiki Usage Guide for LLM Agents

This document provides a concise guide for using the Saiki agent runtime, optimized for RAG and consumption by other LLMs.

---

## 1. Core Concepts

### What is Saiki?
Saiki is a lightweight runtime for creating and running AI agents. It translates natural language prompts into actions using configured tools and LLMs. It can be controlled via CLI, a programmatic SDK, or a REST API.

### Installation
Install the Saiki CLI globally via npm:
```bash
npm install -g @truffle-ai/saiki
```

### LLM API Keys
Saiki requires API keys for the desired LLM provider. Set them as environment variables.
```bash
# For OpenAI (e.g., gpt-4o)
export OPENAI_API_KEY="your_key"

# For Anthropic (e.g., claude-3-sonnet)
export ANTHROPIC_API_KEY="your_key"

# For Google (e.g., gemini-1.5-pro)
export GOOGLE_GENERATIVE_AI_API_KEY="your_key"
```

### Agent Configuration (`agent.yml`)
Agent behavior is defined in a YAML file (default: `agents/agent.yml`). This file specifies the LLM, tools (via MCP servers), and system prompt.

**Example `agent.yml`:**
```yaml
# Connect to tool servers via Model Context Protocol (MCP)
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
  puppeteer:
    type: stdio
    command: npx
    args: ['-y', '@truffle-ai/puppeteer-server']

# Configure the Large Language Model
llm:
  provider: openai
  model: gpt-4o
  apiKey: $OPENAI_API_KEY # Reads from environment variable

# Define the agent's persona and instructions
systemPrompt: |
  You are Saiki, an expert coding assistant.
  You have access to a filesystem and a browser.
  Think step-by-step to solve the user's request.
```

### Advanced System Prompt Configuration

For more complex system prompts, you can use the contributor-based configuration format that allows mixing static content, dynamic content, and file-based context:

```yaml
systemPrompt:
  contributors:
    - id: main-prompt
      type: static
      priority: 0
      content: |
        You are Saiki, an expert coding assistant.
        You have access to a filesystem and a browser.
    
    - id: project-context
      type: file
      priority: 10
      files:
        - ./README.md
        - ./docs/architecture.md
        - ./CONTRIBUTING.md
      options:
        includeFilenames: true
        separator: "\n\n---\n\n"
        errorHandling: skip
        maxFileSize: 50000
        includeMetadata: false
    
    - id: current-time
      type: dynamic
      priority: 20
      source: dateTime
```

**File Contributor Options:**
- `files`: Array of file paths to include (.md and .txt files only)
- `options.includeFilenames`: Whether to include filename headers (default: true)
- `options.separator`: Text to separate multiple files (default: "\n\n---\n\n")
- `options.errorHandling`: How to handle missing files - "skip", "placeholder", or "error" (default: "skip")
- `options.maxFileSize`: Maximum file size in bytes (default: 100000)
- `options.encoding`: File encoding (default: "utf-8")
- `options.includeMetadata`: Include file size and modification time (default: false)

**Use Cases for File Contributors:**
- Include project documentation and guidelines
- Add code style guides and best practices
- Provide domain-specific knowledge from markdown files
- Include API documentation or specification files
- Add context-specific instructions for different projects

---

## 2. Usage Methods

Saiki can be used via its CLI, a TypeScript SDK, or as a server with a REST API.

### Method 1: CLI Usage

The `saiki` command can run one-shot prompts or start in different modes.

**One-shot prompt:**
Execute a task directly from the command line.
```bash
saiki "create a new file named 'test.txt' with the content 'hello world'"
```

**Interactive CLI:**
Start a chat session in the terminal.
```bash
saiki
```

**Key CLI Flags:**
- `-m, --model <model_name>`: Switch LLM model (e.g., `claude-3-sonnet-20240229`). Overrides config file.
- `-a, --agent <path/to/agent.yml>`: Use a specific agent configuration file.
- `--mode <mode>`: Change the run mode.
- `--new-session [id]`: Start a new chat session.

**CLI Run Modes (`--mode`):**

| Mode       | Command                       | Description                               |
|------------|-------------------------------|-------------------------------------------|
| `cli`      | `saiki`                       | Interactive or one-shot terminal commands.|
| `web`      | `saiki --mode web`            | Starts a web UI (default port: 3000).     |
| `server`   | `saiki --mode server`         | Starts a REST/WebSocket server (port: 3001).|
| `mcp`      | `saiki --mode mcp`            | Exposes the agent as a tool via MCP/stdio.|
| `discord`  | `saiki --mode discord`        | Runs the agent as a Discord bot.          |
| `telegram` | `saiki --mode telegram`       | Runs the agent as a Telegram bot.         |

**Project Scaffolding:**
- `saiki create-app`: Create a new Saiki project structure.
- `saiki init-app`: Initialize Saiki in an existing TypeScript project.

### Method 2: Programmatic SDK (`SaikiAgent`)

Use the `SaikiAgent` class in your TypeScript/JavaScript projects for full programmatic control.

**Installation for a project:**
```bash
npm install @truffle-ai/saiki
```

**Example SDK Usage:**
```ts
import 'dotenv/config';
import { SaikiAgent, loadAgentConfig } from '@truffle-ai/saiki';

// Load configuration from a file
const config = await loadAgentConfig('./agents/agent.yml');

// Create and start the agent
const agent = new SaikiAgent(config);
await agent.start(); // Initializes services like MCP servers

// Run a single task
const response = await agent.run('List the 3 largest files in the current directory.');
console.log(response);

// Hold a conversation (state is maintained automatically)
await agent.run('Write a function that adds two numbers.');
await agent.run('Now add type annotations to it.');

// Reset the conversation history
agent.resetConversation();

// Stop the agent and disconnect services
await agent.stop();
```

### Method 3: REST API (Server Mode)

Run Saiki as a headless server to interact with it via HTTP requests.

**Start the server:**
```bash
# The server will run on http://localhost:3001 by default
saiki --mode server
```

**Key API Endpoints:**
- `POST /api/message`: Send a prompt asynchronously. The agent will process it and you can receive events via WebSocket.
  - Body: `{ "message": "your prompt here" }`
- `POST /api/message-sync`: Send a prompt and wait for the complete response.
  - Body: `{ "message": "your prompt here" }`
- `POST /api/reset`: Resets the current conversation session.
- `GET /api/mcp/servers`: Lists the connected MCP tool servers.

---

## 3. Tools and the Model Context Protocol (MCP)

Saiki uses the **Model Context Protocol (MCP)** to communicate with tools. Tools run as separate server processes. You connect Saiki to them by listing them under `mcpServers` in your `agent.yml`.

**Common Tool Servers:**
- **`@modelcontextprotocol/server-filesystem`**: Provides tools for reading, writing, and listing files.
- **`@truffle-ai/puppeteer-server`**: Provides tools for web browsing and scraping.
- **`@truffle-ai/web-search`**: Provides tools for performing web searches.

**Executing Tools:**
When an LLM agent uses Saiki, it should issue natural language commands. Saiki's LLM will determine which tool to call. The agent's `systemPrompt` should inform the LLM about the available tools (e.g., "You have access to a filesystem and a browser"). The LLM then generates tool calls that Saiki executes. 