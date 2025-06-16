---
sidebar_position: 3
---

# Your First Agent Tutorial

In the [Quick Start](./quick-start), you created and ran a basic agent. Now, let's customize it. This tutorial will show you how to modify your agent's configuration to change its behavior and add new tools.

This is the **Framework** in action: defining your agent's capabilities in a simple configuration file.

**Prerequisite:** Make sure you have completed the [Quick Start](./quick-start) guide.

### 1. Understand Your Agent's Brain

Open the `saiki.yml` file in your `my-first-agent` directory. It looks something like this:

```yaml
llm:
  provider: openai
  model: gpt-4.1-mini
  apiKey: $OPENAI_API_KEY
  systemPrompt: |
    You are a helpful AI assistant.

mcpServers:
  filesystem:
    type: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
```

This file defines two key things:
*   `llm`: The language model your agent uses.
*   `mcpServers`: The tools your agent has access to. Currently, it only has `filesystem`.

### 2. Give Your Agent a Personality

Let's change the agent's personality. Modify the `systemPrompt` to make it a pirate.

```yaml
llm:
  provider: openai
  model: gpt-4.1-mini
  apiKey: $OPENAI_API_KEY
  systemPrompt: |
    Ahoy! Ye be chattin' with a pirate AI. I can sail the seven seas o' yer file system. Speak like a pirate in all yer responses, savvy?

mcpServers:
# ... (rest of the file is unchanged)
```

Now, run your agent again using the **CLI**:

```bash
saiki "Who are you?"
```

Your agent should now respond like a pirate! You've just changed your agent's behavior without writing a single line of code.

### 3. Give Your Agent a New Tool

Let's give our pirate agent the ability to browse the web. We'll add the `puppeteer` tool, which allows an agent to control a headless web browser.

Add a new entry under `mcpServers`:

```yaml
llm:
  # ... (llm config is unchanged)

mcpServers:
  filesystem:
    type: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
  
  puppeteer:
    type: stdio
    command: npx
    args: ["-y", "@truffle-ai/puppeteer-server"]
```

The first time you run the agent with this tool, Saiki's **Runtime** will automatically install it for you.

### 4. Use the New Tool

Now, let's use the new tool. Start an interactive session with your agent:

```bash
saiki
```

Once the session starts, ask it to do something with its new skill:

> `summarize the main points of the article at https://en.wikipedia.org/wiki/Piracy`

Your agent will now use the `puppeteer` tool to visit the webpage, read the content, and give you a summary (in a pirate voice, of course).

## What You've Learned

In this tutorial, you've learned how to:
- ✅ Modify an agent's personality using the `systemPrompt`.
- ✅ Add new tools to an agent by editing the `saiki.yml` file.
- ✅ Use the new tools from the Saiki CLI.

This is the core workflow of building with Saiki: define and configure your agent, then let the Runtime handle the rest.

## Programmatic Usage (Optional)

What if you want to use your agent inside your own application? Saiki provides a simple API for that.

Create a file named `run-agent.mjs` and add the following code:

```javascript
import 'dotenv/config';
import { createSaikiAgent, loadConfigFile } from '@truffle-ai/saiki';

// Load the agent definition
const config = await loadConfigFile('./saiki.yml');
const agent = await createSaikiAgent(config);

// Run the agent with a prompt
const response = await agent.run("Ahoy! What be on the Wikipedia page for 'treasure'?");
console.log(response);
```

Now, run this file from your terminal:

```bash
node run-agent.mjs
```

This demonstrates how you can take an agent you've configured and tested with the CLI and embed it into a larger application using just a few lines of code.

## Next Steps

- **Discover More Tools:** Explore the available [MCP Servers](../guides/integrations/) to add more capabilities.
- **Advanced Configuration:** Learn about all the options in the [Configuring Saiki](../guides/configuring-saiki/) guide.
- **Build Something Real:** Check out our [guides for building with Saiki](../guides/building-with-saiki/) for more complex examples. 