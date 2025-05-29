---
sidebar_position: 1
---

# Introduction

Ready to build AI-powered applications? This comprehensive guide will take you from zero to shipping your first Saiki-powered app. We'll start simple and build your understanding step by step.

## What You'll Learn

This guide is structured to take you through the entire journey of building with Saiki:

### [Getting Started](./getting-started)
Your first 5 minutes with Saiki - get up and running quickly:
- Create your first project
- Set up API keys
- Run your first AI agent
- Understand the basic concepts

### [Building Applications](./building-applications)
Learn to build real-world applications:
- Smart file organizer
- Interactive code helper
- Web API service
- Understanding the Saiki philosophy

### [Advanced Patterns](./advanced-patterns)
Production-ready patterns and best practices:
- Specialized agents
- Error handling strategies
- Event-driven architecture
- Performance optimization

### [What's Next](./whats-next)
Resources and guidance for continued learning:
- Next steps in your journey
- Community resources
- Pro tips and best practices

## Prerequisites

Before you start, make sure you have:

- **Node.js 18+** installed
- **An API key** from one of the [supported LLM providers](../../configuring-saiki/llm/)
- **Basic TypeScript/JavaScript** knowledge
- **A code editor** (VS Code recommended)

## The Saiki Philosophy

Saiki follows a **configuration-first approach**. Instead of writing complex code to integrate AI capabilities, you:

1. **Configure capabilities** through YAML files
2. **Define behavior** with system prompts
3. **Connect tools** via MCP servers
4. **Build applications** with simple API calls

This approach means you can focus on **what your AI should do**, not **how to make it work**.

## Quick Example

Here's a complete AI agent in just a few lines:

```typescript
import { loadConfigFile, createSaikiAgent } from '@truffle-ai/saiki';

// Load configuration
const config = await loadConfigFile('./agents/saiki.yml');

// Create agent
const agent = await createSaikiAgent(config);

// Use it!
const response = await agent.run("What files are in this directory?");
console.log(response);
```

That's it! You now have an AI agent with file system capabilities.

## Ready to Start?

Choose your path:

- **🚀 New to Saiki?** Start with [Getting Started](./getting-started) for a quick introduction
- **⚡ Want to build something now?** Jump to [Building Applications](./building-applications) for real examples
- **🎯 Need production patterns?** Go straight to [Advanced Patterns](./advanced-patterns)

Let's build something amazing! 🎉 