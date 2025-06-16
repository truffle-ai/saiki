---
sidebar_position: 1
---

# Introduction

Saiki is an open-source, modular and extensible AI Agent framework that you can use to build AI powered applications seamlessly. 

Why developers choose Saiki:

- **<ins>Customizable, Config-Driven Agents</ins>**: Create a Saiki agent by creating one config file. Configure your tools, LLM configuration, prompts, context management strategies in one file and re-use that anywhere. 
- **<ins>Feature-rich developer tools</ins>**: Saiki has a powerful CLI and web UI playground you can use to build, test and experiment with different AI agents.
- **<ins>First-class MCP support</ins>**: Connect any MCP servers to your Saiki agents to enhance their functionality. Saiki supports prompts, resources and tools for all your MCP needs.
- **<ins>Multi-LLM support</ins>**: Saiki supports OpenAI, Anthropic, Google and Groq LLMs. Use custom models as well! 
- **<ins>Powerful APIs</ins>**: Saiki agents come with powerful in-built APIs - your AI Agent already has most of the functionality you will need. This includes APIs to change LLMs, connect MCP servers, manage context, start new sessions, configure storage, and more!
- **<ins>In-built context management</ins>**: Saiki agents have in-built context management to handle the token limits of LLMs. Even this is customizable!
- **<ins>Long lived agents</ins>**: Saiki agents are designed for long-running tasks and long-lived communications.
- **<ins>Event driven architecture</ins>**: Saiki agents use an event driven architecture that also allows you to easily integrate agents into your existing systems.

Saiki is the missing natural language layer across your stack. Its powerful in-built features and high customizability means that whether you're automating workflows, building agents, or prototyping new ideas, Saiki gives you the tools to move fast — and bend it to your needs. 


## Ready to Start?

**[Get started with Saiki in 5 minutes →](./quick-start)**

## Learn More

- **New to AI Agents?** Start with [Basics of AI Agents](../learn/what-is-an-ai-agent) to learn the fundamentals
- **Building Applications?** See the [Building with Saiki Guide](../tutorials/building-with-saiki/) for patterns and examples
- **LLM Configuration:** Check out [LLM Providers & Setup Guide](../guides/configuring-saiki/llm/providers) for all supported models
- **Adding Tools:** Learn about [MCP Server Configuration](../guides/configuring-saiki/mcpServers) to enhance your agents
- **Core Configuration:** Understand [Configuration](../guides/configuring-saiki/overview) for complete setup
- **System Design:** Explore [Architecture](../architecture/overview) for Saiki's high-level design
- **Get Involved:** See our [Contributing Guide](https://github.com/truffle-ai/saiki/blob/main/CONTRIBUTING.md) to help improve Saiki
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

Saiki is built by the team at [Truffle AI](https://trytruffle.ai). Join our community and help shape the future of natural language automation!