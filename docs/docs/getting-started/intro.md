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

## Getting Started

- **Install globally:**
  ```bash
  npm install -g @truffle-ai/saiki
  ```
- **Run the interactive CLI:**
  ```bash
  saiki
  ```
- **Ask saiki anything, in your terminal!:**
  <!-- ```bash
  saiki what is the best way to build AI agents
  ``` -->
  ```bash
  saiki what are the current files in my directory
  ```
  ```bash
  saiki write a script to add two numbers in ./addition
  ```

  Saiki CLI uses the default configuration defined in `configuration/saiki.yml`

  You can customize this as well.
- Check out [Saiki CLI guide](../user-guide/cli.md)
- **Try the Web Playground:**
  ```bash
  saiki --mode web
  ```

  Then open [http://localhost:3000](http://localhost:3000) in your browser.
  
  The web playground gives you an interactive way to use your connect to MCP servers, test out the servers, try out different LLMs, and finally save your preferred combinations as AI agents

  Check our WEb playground

<!-- ## Example Use Cases

- **Amazon Shopping Assistant:**
  > "Can you go to amazon and add some snacks to my cart? I like trail mix, cheetos and maybe surprise me with something else?"
- **Email Summary to Slack:**
  > "Summarize emails and send highlights to Slack."
- **AI Website Designer:**
  > "Design a landing page based on README.md."

Explore more in the [Examples & Demos](./examples-demos.md) section. -->

## Learn More

- **New to AI Agents?** Start with [Basics of AI Agents](../learn/what-is-an-ai-agent.md) to learn the fundamentals
- **Building Applications?** See the [Building with Saiki Guide](../user-guide/development.md) for patterns and examples
- **LLM Configuration:** Check out [LLM Providers & Setup Guide](../configuring-saiki/llm-providers.md) for all supported models
- **Adding Tools:** Learn about [MCP Server Configuration](../configuring-saiki/mcpServers.md) to enhance your agents
- **Core Configuration:** Understand [Configuration](../configuring-saiki/configuration.md) for complete setup
- **System Design:** Explore [Architecture](../architecture/overview.md) for Saiki's high-level design
- **Get Involved:** See [Contributing Guide](../contribution-guide/overview.md) to help improve Saiki
- **Community & Support:** Join our [Discord](https://discord.gg/GFzWFAAZcm) for help and discussions

---

Saiki is built by the team at Truffle AI. Join our community and help shape the future of natural language automation! 