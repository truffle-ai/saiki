---
sidebar_position: 3
---

# Build Your First Agent

In the Quick Start, you interacted with the default Saiki agent. Now, it's time to build your own.

This tutorial will guide you through creating a `saiki.yml` file to define a custom agent with a unique personality and a new tool. This is the core workflow of building with Saiki.

### 1. Create Your Agent Definition
The heart of a Saiki agent is the `saiki.yml` file. This is where you use the **Framework** to define its identity and skills.

Create a new directory for your project and inside it, create a `saiki.yml` file with the following content:
```bash
mkdir my-pirate-agent
cd my-pirate-agent
```

```yaml
# saiki.yml
llm:
  provider: openai
  model: gpt-4o
  systemPrompt: |
    You are a helpful AI assistant.
```
This is the most basic agent definition. It tells Saiki to use OpenAI's `gpt-4o` model and gives it a simple instruction.

### 2. Give Your Agent a Personality
Let's customize your agent by giving it a distinct personality. Modify the `systemPrompt` to turn it into a pirate.

```yaml
# saiki.yml
llm:
  provider: openai
  model: gpt-4o
  systemPrompt: |
    Ahoy! Ye be chattin' with a pirate AI. Speak like a pirate in all yer responses, savvy?
```
Now, run your agent from inside the `my-pirate-agent` directory. The `-c` flag tells Saiki to use your local configuration file.
```bash
saiki -c saiki.yml "Who are you?"
```
Your agent should now respond like a pirate. You've just changed your agent's behavior without writing a single line of code.

### 3. Give Your Agent a New Tool
A core feature of Saiki is giving agents `Tools` to interact with the world. Let's give your pirate agent the ability to browse the web.

Add the `puppeteer` tool to your `saiki.yml` under a new `mcpServers` section:
```yaml
# saiki.yml
llm:
  provider: openai
  model: gpt-4o
  systemPrompt: |
    Ahoy! Ye be chattin' with a pirate AI. Speak like a pirate in all yer responses, savvy?

mcpServers:
  puppeteer:
    type: stdio
    command: npx
    args: ["-y", "@truffle-ai/puppeteer-server"]
```
The **Runtime** will automatically install this tool the first time you run the agent.

### 4. Use the New Tool
Now, let's put your agent's new skill to use. Start an interactive chat session, making sure to point to your local configuration:
```bash
saiki -c saiki.yml
```
Once the session starts, ask it to do something that requires web access:
> `summarize the main points of the article at https://en.wikipedia.org/wiki/Piracy`

Your agent will now use the `puppeteer` tool to visit the webpage, read the content, and give you a summary (in a pirate voice, of course).

## Congratulations!
You've just built and customized your first AI agent. You've learned how to:
- ✅ Create a custom agent with `saiki.yml`.
- ✅ Give it a unique personality.
- ✅ Grant it a new tool to browse the web.
- ✅ Interact with it using the Saiki CLI.

This is the fundamental development loop of Saiki. You can now explore adding more [tools](../guides/integrations/overview.md) or building more complex behaviors.
