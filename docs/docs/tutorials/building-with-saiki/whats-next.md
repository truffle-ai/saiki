---
sidebar_position: 6
---

# What's Next

You now understand how to build AI applications with Saiki! Here's how to keep growing and take your applications to the next level.

## Immediate Next Steps

### 1. Experiment with Different Providers
Try different LLM providers to find what works best for your use case:

```yaml
# Fast and cost-effective
llm:
  provider: groq
  model: llama-3.3-70b-versatile
  apiKey: $GROQ_API_KEY

# Large context for complex tasks
llm:
  provider: anthropic
  model: claude-3-5-sonnet-20240620
  apiKey: $ANTHROPIC_API_KEY

# Multimodal capabilities
llm:
  provider: google
  model: gemini-2.0-flash
  apiKey: $GOOGLE_GENERATIVE_AI_API_KEY
```

**Learn more**: [LLM Providers Guide](../../guides/configuring-saiki/llm/providers)

### 2. Add More Tools
Expand your agents' capabilities with additional MCP servers:

```yaml
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
  
  puppeteer:
    type: stdio
    command: npx
    args: ["-y", "@truffle-ai/puppeteer-server"]
  
  # Add database access, API calls, and more!
```

**Learn more**: [MCP Server Configuration](../../guides/configuring-saiki/mcpServers)

### 3. Deploy Your Application
Take your application to production:

- **Development**: Run locally with `npm start`
- **Production**: Use Docker containers with proper monitoring

**Learn more**: [Deployment Guide](../../guides/deployment)

## Going Deeper

### Join Our Community
Connect with other developers building AI applications:

- **[Discord Community](https://discord.gg/GFzWFAAZcm)** - Get help, share projects, discuss ideas
- **[GitHub Discussions](https://github.com/truffle-ai/saiki/discussions)** - Technical discussions and feature requests
- **[GitHub Issues](https://github.com/truffle-ai/saiki/issues)** - Report bugs and request features

### Explore Examples
See what others have built and get inspiration:

- **[Examples Repository](../../examples-demos/)** - Working code you can run
- **Community showcase** in our Discord
- **Blog posts** and tutorials from the community

### Read the Advanced Docs
Dive deeper into Saiki's capabilities:

- **[API Reference](../../api-reference/)** - Complete API documentation
- **[Architecture Overview](../../architecture/overview)** - How Saiki works under the hood
- **[Contributing Guide](https://github.com/truffle-ai/saiki/blob/main/CONTRIBUTING.md)** - Help improve Saiki

## Pro Tips for Saiki Success

### ✅ Use Specific Prompts
```yaml
# ❌ Vague
systemPrompt: "You are a helpful assistant."

# ✅ Specific
systemPrompt: |
  You are a code review assistant specializing in security.
  Always check for SQL injection, XSS, and authentication issues.
  Provide specific line numbers and fix suggestions.
```

### ✅ Handle Errors Gracefully in Your Application
When interacting with Saiki agents:
```typescript
try {
  const response = await agent.run(message); // Assuming 'agent' is your Saiki agent instance
  return response;
} catch (error) {
  // Log the error for debugging
  console.error('Saiki Agent error:', error);
  
  // Return helpful message to user
  return "I'm having trouble processing that request with the AI agent. Could you try rephrasing it?";
}
```

### ✅ Optimize for Your Use Case with Saiki Configurations

**For Speed**:
```yaml
llm:
  provider: groq
  model: llama-3.3-70b-versatile
  temperature: 0.1  # More deterministic
```

**For Quality**:
```yaml
llm:
  provider: anthropic
  model: claude-3-5-sonnet-20240620
  temperature: 0.3  # Balanced creativity
```

**For Cost**:
```yaml
llm:
  provider: openai
  model: gpt-4.1-mini  # Cheaper than full GPT-4
```

## Common Saiki Patterns to Explore

### 1. Agent Specialization
Create different Saiki agents for different tasks:
- **Code Reviewer** - Focus on security and best practices
- **Documentation Writer** - Generate clear, comprehensive docs
- **Data Analyst** - Analyze and visualize data
- **Customer Support** - Handle user questions

### 2. Workflow Automation with Saiki
Chain multiple Saiki agents or calls together:
1. **Analyzer Agent** - Understand the problem
2. **Planner Agent** - Create a solution plan based on Analyzer's output
3. **Executor Agent** - Implement the solution using tools
4. **Reviewer Agent** - Validate the results

## Scaling Your Saiki Applications

### Performance Considerations for Saiki
- **Use faster models** configured in Saiki for latency-sensitive tasks.
- **Cache LLM responses** where appropriate to reduce redundant API calls, especially for frequently requested information.
- **Optimize tool usage** within your agents to ensure they perform efficiently.

### Cost Optimization with Saiki
- **Choose appropriate LLM models** in your Saiki configuration for each task's complexity and budget.
- **Optimize prompts** for your Saiki agents to reduce token usage.
- **Cache results** from Saiki agents or LLM calls if the same information is requested repeatedly.

### Security Best Practices for Saiki
- **Never hardcode API keys** in your Saiki configurations. Use environment variables (e.g., `$ANTHROPIC_API_KEY`).
- **Validate and sanitize user inputs** before passing them to Saiki agents to prevent prompt injection or misuse of tools.
- **Restrict tool permissions** for MCP servers to only what is necessary for the agent's function.

## Stay Updated

### Follow Our Progress
- **[GitHub Releases](https://github.com/truffle-ai/saiki/releases)** - New features and fixes
- **[Twitter/X](https://x.com/truffleai_)** - Updates and announcements
- **[Blog](https://truffle.ai/blog)** - Deep dives and tutorials

### Community Events
- **Office hours** in Discord
- **Community showcases** of projects
- **Workshops** on advanced techniques
- **Hackathons** with prizes and recognition

## Ready to Ship?

You have everything you need to build amazing AI applications with Saiki:

- ✅ **Understanding** of how Saiki works
- ✅ **Practical experience** building applications
- ✅ **Advanced patterns** for production use with Saiki
- ✅ **Community support** when you need help
- ✅ **Resources** for continued learning

## Final Thoughts

The AI landscape is evolving rapidly, and Saiki is designed to evolve with it. By focusing on configuration over code, you can:

- **Adapt quickly** to new models and providers via Saiki's configuration.
- **Experiment freely** with different Saiki setups without rewriting entire applications.
- **Scale efficiently** as your needs grow by optimizing Saiki configurations and tool usage.
- **Build confidently** with Saiki using proven patterns.

The only limit is your imagination! 🚀

**What will you build next with Saiki?**

Share your creations in our [Discord community](https://discord.gg/GFzWFAAZcm) - we'd love to see what you create! 