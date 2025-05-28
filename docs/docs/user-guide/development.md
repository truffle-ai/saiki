---
sidebar_position: 4
---

# Building with Saiki: Developer Guide

Ready to build AI-powered applications? This guide will take you from zero to shipping your first Saiki-powered app. We'll start simple and build your understanding step by step.

## Your First Saiki Agent (5 minutes)

Let's get you running with Saiki in under 5 minutes. We'll create a simple agent that can help with file operations.

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

### Step 3: Run Your First Agent

```bash
node --loader ts-node/esm saiki/saiki-example.ts
```

🎉 **Congratulations!** You just ran your first AI agent. Try asking it: *"What files are in this directory?"*

---

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

### The Simple API

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

---

## Building Real Applications

Now let's build something useful. We'll create three types of applications, each building on what you've learned.

### Application 1: Smart File Organizer

Let's build an agent that can organize messy directories:

```typescript
// file-organizer.ts
import 'dotenv/config';
import { loadConfigFile, createSaikiAgent } from '@truffle-ai/saiki';

const config = await loadConfigFile('./agents/saiki.yml');
const agent = await createSaikiAgent(config);

console.log("🗂️ Smart File Organizer");
console.log("I can help organize your files by type, date, or project.\n");

const task = "Look at the current directory and suggest how to organize these files. Create folders if needed.";
const response = await agent.run(task);
console.log(response);
```

**What you're learning:** Single-purpose agents with clear objectives work best.

### Application 2: Interactive Code Helper

Now let's build something interactive:

```typescript
// code-helper.ts
import 'dotenv/config';
import { loadConfigFile, createSaikiAgent } from '@truffle-ai/saiki';
import readline from 'readline';

const agent = await createSaikiAgent(
  await loadConfigFile('./agents/saiki.yml')
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("💻 Your Code Helper is ready!");
console.log("Ask me about code, files, or type 'exit' to quit.\n");

function askQuestion() {
  rl.question("You: ", async (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
      return;
    }
    
    try {
      const response = await agent.run(input);
      console.log(`\n🤖 ${response}\n`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }
    
    askQuestion();
  });
}

askQuestion();
```

**What you're learning:** Adding interaction is just a few lines of code. The agent handles the complexity.

### Application 3: Web API Service

Ready for something more advanced? Let's create a web service:

```typescript
// web-service.ts
import express from 'express';
import { loadConfigFile, createSaikiAgent } from '@truffle-ai/saiki';

const app = express();
app.use(express.json());

// Initialize our agent once
const agent = await createSaikiAgent(
  await loadConfigFile('./agents/saiki.yml')
);

// Simple chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await agent.run(message);
    
    res.json({ 
      success: true, 
      response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', agent: 'ready' });
});

app.listen(3000, () => {
  console.log('🚀 Saiki web service running on http://localhost:3000');
});
```

**What you're learning:** The same agent works everywhere - CLI, web, mobile, anywhere Node.js runs.

---

## Level Up: Advanced Patterns

Once you're comfortable with the basics, these patterns will help you build production-ready applications.

### Pattern 1: Specialized Agents

Instead of one do-everything agent, create specialized ones:

```yaml
# agents/code-reviewer.yml
llm:
  provider: anthropic
  model: claude-3-5-sonnet-20240620
  apiKey: $ANTHROPIC_API_KEY
  systemPrompt: |
    You are a senior code reviewer. Focus on:
    - Code quality and best practices
    - Security vulnerabilities
    - Performance optimizations
    - Clear, actionable feedback

mcpServers:
  filesystem:
    type: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
```

```yaml
# agents/documentation-writer.yml
llm:
  provider: openai
  model: gpt-4.1
  apiKey: $OPENAI_API_KEY
  systemPrompt: |
    You are a technical writer. Create clear, comprehensive documentation.
    Always include examples and explain complex concepts simply.
```

**Why this works:** Specialized agents give better results than generalists.

### Pattern 2: Smart Error Handling

```typescript
async function safeAgentCall(agent, message, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await agent.run(message);
      return result;
    } catch (error) {
      console.log(`Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === retries) {
        throw new Error(`Failed after ${retries} attempts: ${error.message}`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

**Why this matters:** LLM APIs can be unreliable. Graceful handling keeps your apps running.

### Pattern 3: Event-Driven Architecture

```typescript
class SmartAgent {
  constructor(agent) {
    this.agent = agent;
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    // Track when tools are used
    this.agent.agentEventBus.on('llmservice:toolCall', (toolInfo) => {
      console.log(`🔧 Used tool: ${toolInfo.toolName}`);
      // Log to analytics, notify users, etc.
    });
    
    // Handle conversation resets
    this.agent.agentEventBus.on('saiki:conversationReset', () => {
      console.log('🔄 Conversation reset');
      // Clean up state, notify users, etc.
    });
  }
  
  async processTask(task) {
    console.log(`📋 Processing: ${task}`);
    const result = await this.agent.run(task);
    console.log(`✅ Completed: ${task}`);
    return result;
  }
}
```

**Why this helps:** Events let you build reactive applications that respond to what's happening.

---

## What's Next?

You now understand how to build AI applications with Saiki! Here's how to keep growing:

### Immediate Next Steps
1. **Experiment** with different [LLM providers](../configuring-saiki/llm-providers.md)
2. **Add tools** by exploring [MCP servers](../configuring-saiki/mcpServers.md)
3. **Deploy** using our [deployment guide](./deployment.md)

### Going Deeper
- **Join our [Discord](https://discord.gg/GwxwQs8CN5)** - Get help and share what you're building
- **Explore [examples](../getting-started/examples-demos.md)** - See what others have built
- **Read the [API docs](./api.md)** - Understand all the capabilities

### Pro Tips
- ✅ **Start simple** - Build the simplest version that works first
- ✅ **Use specific prompts** - Tell your agent exactly what you want
- ✅ **Handle errors gracefully** - LLMs can be unpredictable
- ✅ **Monitor your usage** - Keep track of API costs and performance
- ✅ **Test with real data** - Don't just test with perfect examples

---

**Ready to ship?** You have everything you need to build amazing AI applications. The only limit is your imagination! 🚀