---
sidebar_position: 2
---

# Create Your First Agent

Let's get you running with Saiki in under 5 minutes. We'll create a simple agent that can help with file operations.

## Your First Saiki Agent (5 minutes)

### Step 1: Create Your Project

```bash
mkdir my-first-agent
cd my-first-agent
saiki init
```

This creates a basic structure:
```
my-first-agent/
├── .env                    # Your API keys go here
├── saiki/
│   ├── agents/
│   │   └── saiki.yml      # Agent configuration
│   └── saiki-example.ts   # Ready-to-run example
```

### Step 2: Add Your API Key

Open `.env` and add your OpenAI key:
```bash
OPENAI_API_KEY=your_key_here
```

:::tip
Don't have an OpenAI key? You can also use [other providers](../../configuring-saiki/llm/providers) like Anthropic, Google, or even local models.
:::

### Step 3: Run Your First Agent

```bash
node --loader ts-node/esm saiki/saiki-example.ts
```

🎉 **Congratulations!** You just ran your first AI agent. Try asking it: *"What files are in this directory?"*

## Understanding What Just Happened

Before we build more complex applications, let's understand the basics of how Saiki works.

### The Configuration-First Approach

Open `saiki/agents/saiki.yml`. You'll see something like:

```yaml
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]

llm:
  provider: openai
  model: gpt-4.1-mini
  apiKey: $OPENAI_API_KEY
  systemPrompt: |
    You are a helpful AI assistant with access to tools.
    Use the filesystem tool to help users with file operations.
```

**What's happening here?**
- `mcpServers` gives your agent **capabilities** (in this case, file system access)
- `llm` defines which **AI model** to use and how it should behave
- The **system prompt** tells the AI how to act and what tools it has

This is Saiki's superpower: **you configure capabilities, not code them**.

### The Simplest Agent

Look at `saiki-example.ts`:

```typescript
import { loadConfigFile, createSaikiAgent } from '@truffle-ai/saiki';

const config = await loadConfigFile('./agents/saiki.yml');
const agent = await createSaikiAgent(config);

// That's it! Your agent is ready
const response = await agent.run("What can you help me with?");
console.log(response);
```

**Three lines of code** gave you an AI agent with file system capabilities. That's the Saiki philosophy: **powerful simplicity**.

## Key Concepts

### Configuration vs Code
- **Traditional approach**: Write code to integrate AI, handle errors, manage state
- **Saiki approach**: Configure what you want, let Saiki handle the complexity

### Agents vs Tools
- **Agent**: The AI brain that makes decisions and responds to users
- **Tools**: Capabilities like file access, web browsing, or API calls
- **MCP Servers**: The bridge that provides tools to agents

### System Prompts
- **Define personality**: How should your agent behave?
- **Set capabilities**: What tools does it have access to?
- **Guide decisions**: How should it use those tools?

## Troubleshooting

### Common Issues

**"Module not found" errors**
```bash
# Make sure you have ts-node installed
npm install -g ts-node
```

**"Invalid API key"**
- Check that your `.env` file is in the project root
- Verify the API key is correct and has credit
- Make sure there are no extra spaces in the `.env` file

**"Permission denied" on file operations**
- The filesystem server only has access to the current directory by default
- This is a security feature to prevent unauthorized file access

### Getting Help

If you run into issues:
1. Check the [troubleshooting section](../../configuring-saiki/llm/providers#troubleshooting) in the providers guide
2. Join our [Discord community](https://discord.gg/GFzWFAAZcm) for help
3. Look at the [examples repository](../../getting-started/examples-demos) for working code

## What You've Learned

In just 5 minutes, you've:
- ✅ Created your first AI agent
- ✅ Understood the configuration-first approach
- ✅ Seen how simple the Saiki API is
- ✅ Learned the key concepts

## Next Steps

Ready to build something more interesting?

- **Build real applications**: Check out [Building Applications](./building-applications) for practical examples
- **Customize your agent**: Learn about [LLM configuration](../../configuring-saiki/llm/) to change models and behavior
- **Add more tools**: Explore [MCP servers](../../configuring-saiki/mcpServers) to give your agent new capabilities

The foundation is set - now let's build something amazing! 🚀 