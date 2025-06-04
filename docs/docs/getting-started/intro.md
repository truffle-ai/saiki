---
sidebar_position: 1
---

# Introduction

<!-- Saiki is an open, modular and extensible AI agent that lets you perform tasks across your tools, apps, and services using natural language. You describe what you want to do — Saiki figures out which tools to invoke and orchestrates them seamlessly, whether that means running a shell command, summarizing a webpage, or calling an API. -->

Saiki is an open-source, modular and extensible framework that lets you build AI Agents and AI powered applications seamlessly. 

Why developers choose Saiki:

- **Customizable, Config-Driven Agents**: Create a Saiki agent by creating one config file. Configure your tools, LLM configuration, prompts, context management strategies in one file and re-use that anywhere. 
- **Feature-rich developer tools**: Saiki has a powerful CLI and web UI playground you can use to build, test and experiment with different AI agents.
- **First-class MCP support** : Connect to any MCP servers to your Saiki agents to enhance their functionality
- **Multi-LLM support**: Saiki supports OpenAI, Anthropic, Google and Groq LLMs. Saiki is open
- **Powerful in-built APIs**: Saiki agents come with powerful in-built APIs - your AI Agent already has most of the functionality you will need. Saiki core library makes it extremely easy to build your own APIs as well.
- **Use saiki agents in any application**: Saiki agents can be used on telegram, discord, slack, and even as their own MCP servers - all out of the box! 
- **In-built context management**: Saiki agents have in-built context management to handle the token limits of LLMs. Even this is customizable!

Saiki is the missing natural language layer across your stack. Its powerful in-built features and high customizability means that whether you're automating workflows, building agents, or prototyping new ideas, Saiki gives you the tools to move fast — and bend it to your needs. 

## Ready to Start?

**[Get started with Saiki in 5 minutes →](./quick-start)**

## Learn More

- **New to AI Agents?** Start with [Basics of AI Agents](../learn/what-is-an-ai-agent) to learn the fundamentals
- **Building Applications?** See the [Building with Saiki Guide](../building-with-saiki/) for patterns and examples
- **LLM Configuration:** Check out [LLM Providers & Setup Guide](../configuring-saiki/llm/providers) for all supported models
- **Adding Tools:** Learn about [MCP Server Configuration](../configuring-saiki/mcpServers) to enhance your agents
- **Core Configuration:** Understand [Configuration](../configuring-saiki/configuration) for complete setup
- **System Design:** Explore [Architecture](../architecture/overview) for Saiki's high-level design
- **Get Involved:** See [Contributing Guide](../contribution-guide/overview) to help improve Saiki
- **Community & Support:** Join our [Discord](https://discord.gg/GFzWFAAZcm) for help and discussions

### 🤖 LLM-Ready Reference

<details>
<summary>📋 Quick copy reference for LLM context</summary>

<div style={{"maxHeight": "400px", "overflow": "auto", "padding": "1rem", "border": "1px solid #ccc", "borderRadius": "8px", "fontSize": "0.85em", "fontFamily": "monospace"}}>

```
SAIKI FRAMEWORK REFERENCE

Saiki: Configuration-driven AI agent framework
- Config over code: Define agents in YAML
- Multi-LLM: OpenAI, Anthropic, Google, Groq, OpenAI-compatible 
- Tools: Connect via MCP (Model Context Protocol) servers
- Interfaces: CLI, Web UI, Discord/Telegram bots, APIs

BASIC CONFIG:
llm:
  provider: openai|anthropic|google|groq
  model: gpt-4.1-mini|claude-4-sonnet-20250514|gemini-2.5-pro-exp-03-25|llama-3.3-70b-versatile
  apiKey: $API_KEY
  systemPrompt: "Your role and instructions"
mcpServers:
  filesystem: {type: stdio, command: npx, args: ["-y", "@modelcontextprotocol/server-filesystem", "."]}
  puppeteer: {type: stdio, command: npx, args: ["-y", "@truffle-ai/puppeteer-server"]}

USAGE:
- CLI: saiki "command" or saiki (interactive)
- Web: saiki --mode web (http://localhost:3000)
- Bots: saiki --mode discord|telegram
- Code: import {createSaikiAgent} from '@truffle-ai/saiki'

POPULAR MCP SERVERS:
- @modelcontextprotocol/server-filesystem (file ops)
- @truffle-ai/puppeteer-server (web automation)  
- @modelcontextprotocol/server-git (git ops)
- @modelcontextprotocol/server-sqlite (database)

API (when in web mode):
- POST /api/message-sync {"message": "text"}
- POST /api/mcp/servers/{id}/tools/{name}/execute {"arguments": {}}
- WebSocket: ws://localhost:3001/ws

PROGRAMMATIC:
import {loadConfigFile, createSaikiAgent} from '@truffle-ai/saiki';
const agent = await createSaikiAgent(await loadConfigFile('./config.yml'));
const response = await agent.run("request");

BEST PRACTICES:
- Specific system prompts with tool usage guidance
- Choose minimal necessary tools (reduces tokens)
- Use environment variables for API keys
- Error handling with try-catch
- gpt-4.1-mini for speed, temperature: 0.1 for determinism

QUICK START:
npm install -g @truffle-ai/saiki
saiki init project-name
# Add API keys to .env
# Configure saiki/agents/saiki.yml
saiki "what can you help with?"
```

</div>

</details>

---

Saiki is built by the team at Truffle AI. Join our community and help shape the future of natural language automation!
Saiki is built by the team at Truffle AI. Join our community and help shape the future of natural language automation!