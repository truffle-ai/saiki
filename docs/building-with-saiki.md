# Building with Saiki: Developer Guide

Saiki is designed to be a powerful foundation for building AI-powered applications. This guide will help you understand the core patterns and build your own applications using Saiki.

## Quick Setup: Initialize a New Project

The fastest way to get started is using Saiki's built-in initialization:

```bash
# Create a new project with Saiki
mkdir my-saiki-app
cd my-saiki-app
saiki init

# This creates:
# ├── .env                    # Environment variables
# ├── saiki/
# │   ├── agents/
# │   │   └── saiki.yml      # Agent configuration
# │   └── saiki-example.ts   # Example code to get started
```

Run the example:
```bash
node --loader ts-node/esm saiki/saiki-example.ts
```

## Core Design Patterns

### 1. **Configuration-Driven Architecture**

Saiki follows a configuration-driven approach where agents are defined by YAML files. This allows for:
- **Declarative setup**: Define your agent's capabilities without code
- **Environment-specific configs**: Different configs for dev, staging, production
- **Easy sharing**: Configuration files can be version controlled and shared

```yaml
# saiki.yml - Your agent configuration
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
    You are a specialized assistant for [your use case].
    [Custom instructions for your agent]
```

### 2. **Dependency Injection Pattern**

Saiki uses top-down dependency injection for clean separation of concerns:

```typescript
// Basic pattern: Create agent from config
import { loadConfigFile, createSaikiAgent } from '@truffle-ai/saiki';

const config = await loadConfigFile('./saiki.yml');
const agent = await createSaikiAgent(config);
```

For advanced use cases, you can override specific services:

```typescript
// Advanced: Override services for testing or customization
const agent = await createSaikiAgent(config, cliOverrides, {
  // Inject custom services
  messageManager: customMessageManager,
  connectionMode: 'strict' // or 'lenient'
});
```

### 3. **Event-Driven Architecture**

Saiki uses an event bus for reactive programming patterns:

```typescript
// Listen to agent events
agent.agentEventBus.on('saiki:conversationReset', () => {
  console.log('Conversation was reset');
});

agent.agentEventBus.on('llmservice:toolCall', (toolInfo) => {
  console.log(`Tool called: ${toolInfo.toolName}`);
});

agent.agentEventBus.on('saiki:llmSwitched', (switchInfo) => {
  console.log(`LLM switched to: ${switchInfo.newConfig.model}`);
});
```

## Building Different Types of Applications

### **1. Simple Script/Automation**

Perfect for one-off tasks, scripts, or automation workflows:

```typescript
import 'dotenv/config';
import { loadConfigFile, createSaikiAgent } from '@truffle-ai/saiki';

const config = await loadConfigFile('./saiki.yml');
const agent = await createSaikiAgent(config);

// Single task execution
const result = await agent.run("Analyze the files in this directory and create a summary");
console.log(result);

// Multiple interactions
const response1 = await agent.run("What files are in the current directory?");
const response2 = await agent.run("Create a README for the main.py file");
```

### **2. Interactive CLI Application**

For building custom command-line interfaces:

```typescript
import 'dotenv/config';
import { loadConfigFile, createSaikiAgent } from '@truffle-ai/saiki';
import readline from 'readline';

const config = await loadConfigFile('./saiki.yml');
const agent = await createSaikiAgent(config);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("Welcome to My Custom Saiki App!");

function promptUser() {
  rl.question('You: ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
      return;
    }
    
    try {
      const response = await agent.run(input);
      console.log(`Agent: ${response}`);
    } catch (error) {
      console.error('Error:', error.message);
    }
    
    promptUser();
  });
}

promptUser();
```

### **3. Web Application Backend**

Integrate Saiki into web services:

```typescript
import express from 'express';
import { loadConfigFile, createSaikiAgent } from '@truffle-ai/saiki';

const app = express();
app.use(express.json());

// Initialize agent
const config = await loadConfigFile('./saiki.yml');
const agent = await createSaikiAgent(config);

// API endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message, image } = req.body;
    
    const imageData = image ? {
      image: image.data,
      mimeType: image.mimeType
    } : undefined;
    
    const response = await agent.run(message, imageData);
    
    res.json({ 
      success: true, 
      response,
      conversationId: req.sessionID // if using sessions
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Reset conversation endpoint
app.post('/reset', (req, res) => {
  agent.resetConversation();
  res.json({ success: true, message: 'Conversation reset' });
});

app.listen(3000, () => {
  console.log('Saiki web service running on port 3000');
});
```

### **4. Chat Bot (Discord/Telegram/Slack)**

Build platform-specific bots:

```typescript
// Discord bot example
import { Client, GatewayIntentBits } from 'discord.js';
import { loadConfigFile, createSaikiAgent } from '@truffle-ai/saiki';

const config = await loadConfigFile('./saiki.yml');
const agent = await createSaikiAgent(config);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  // Respond to mentions or DMs
  if (message.mentions.has(client.user) || message.channel.type === 'DM') {
    try {
      const response = await agent.run(message.content);
      await message.reply(response);
    } catch (error) {
      await message.reply(`Error: ${error.message}`);
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
```

## Advanced Patterns

### **Dynamic Agent Configuration**

Switch between different configurations at runtime:

```typescript
// Load different configs based on context
const configs = {
  support: await loadConfigFile('./configs/support-agent.yml'),
  sales: await loadConfigFile('./configs/sales-agent.yml'),
  technical: await loadConfigFile('./configs/technical-agent.yml')
};

let currentAgent = await createSaikiAgent(configs.support);

// Switch agent type based on user input or context
async function switchAgentType(type: keyof typeof configs) {
  currentAgent = await createSaikiAgent(configs[type]);
  console.log(`Switched to ${type} agent`);
}
```

### **Custom Event Handling**

Create sophisticated workflows with event handling:

```typescript
class CustomSaikiApp {
  private agent: SaikiAgent;
  private taskQueue: Array<{id: string, task: string}> = [];
  
  constructor(agent: SaikiAgent) {
    this.agent = agent;
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    // Track tool usage
    this.agent.agentEventBus.on('llmservice:toolCall', (toolInfo) => {
      this.logToolUsage(toolInfo);
    });
    
    // Handle conversation resets
    this.agent.agentEventBus.on('saiki:conversationReset', () => {
      this.onConversationReset();
    });
  }
  
  private logToolUsage(toolInfo: any) {
    console.log(`[${new Date().toISOString()}] Tool used: ${toolInfo.toolName}`);
    // Log to database, metrics service, etc.
  }
  
  private onConversationReset() {
    this.taskQueue = []; // Clear any pending tasks
    console.log('Conversation and task queue reset');
  }
  
  async processTask(task: string): Promise<string> {
    const taskId = Date.now().toString();
    this.taskQueue.push({id: taskId, task});
    
    try {
      const result = await this.agent.run(task);
      this.taskQueue = this.taskQueue.filter(t => t.id !== taskId);
      return result;
    } catch (error) {
      this.taskQueue = this.taskQueue.filter(t => t.id !== taskId);
      throw error;
    }
  }
}
```

## Best Practices

### **1. Configuration Management**

```yaml
# Use environment variables for sensitive data
llm:
  provider: openai
  apiKey: $OPENAI_API_KEY  # Never hardcode API keys

# Use descriptive system prompts
systemPrompt: |
  You are a customer support assistant for [Company Name].
  
  Guidelines:
  - Always be polite and helpful
  - If you can't help, escalate to human support
  - Use the knowledge base tool to find answers
  
  Available tools:
  - knowledge_base: Search company documentation
  - ticket_system: Create support tickets
  - user_lookup: Find user account information
```

### **2. Error Handling**

```typescript
// Robust error handling
async function safeAgentRun(agent: SaikiAgent, input: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await agent.run(input);
      if (result) return result;
      
      // Handle empty responses
      if (i === retries - 1) {
        return "I couldn't process your request. Please try again.";
      }
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error.message);
      
      if (i === retries - 1) {
        // Final attempt failed
        throw new Error(`Failed after ${retries} attempts: ${error.message}`);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### **3. Performance Monitoring**

```typescript
// Add performance monitoring
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  trackAgentCall(agent: SaikiAgent) {
    const originalRun = agent.run.bind(agent);
    
    agent.run = async (input: string, imageData?: any) => {
      const startTime = Date.now();
      try {
        const result = await originalRun(input, imageData);
        this.recordMetric('success', Date.now() - startTime);
        return result;
      } catch (error) {
        this.recordMetric('error', Date.now() - startTime);
        throw error;
      }
    };
  }
  
  private recordMetric(type: string, duration: number) {
    if (!this.metrics.has(type)) {
      this.metrics.set(type, []);
    }
    this.metrics.get(type)!.push(duration);
  }
  
  getStats() {
    const stats: any = {};
    for (const [type, durations] of this.metrics) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      stats[type] = {
        count: durations.length,
        avgDuration: avg,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations)
      };
    }
    return stats;
  }
}
```

## Common Pitfalls to Avoid

1. **Don't hardcode configuration**: Always use config files and environment variables
2. **Handle empty responses**: The agent may return `null` for empty responses
3. **Manage conversation state**: Use `resetConversation()` when appropriate
4. **Error handling**: Always wrap agent calls in try-catch blocks
5. **Resource cleanup**: Properly dispose of resources in long-running applications
6. **Rate limiting**: Be mindful of API rate limits when making frequent calls

## Example Projects

Check out these example configurations in the `configuration/examples/` directory:
- **Email to Slack bot**: `email_slack.yml` - Summarizes emails and posts to Slack
- **Notion integration**: `notion.yml` - Uses Notion as a knowledge base
- **Website designer**: `website_designer.yml` - Creates and modifies websites

## Getting Help

- **Discord Community**: Join our [Discord](https://discord.gg/GwxwQs8CN5) for real-time help
- **GitHub Issues**: Report bugs or request features
- **Examples**: Check `configuration/examples/` for more patterns
- **Source Code**: All patterns are demonstrated in `src/app/` directories 