---
sidebar_position: 2
---

# Quick Start

Get your first Saiki agent running in 5 minutes. This guide will walk you through installing Saiki, creating a new project, and interacting with your agent.

### 1. Installation

First, install the Saiki CLI from npm:

```bash
npm install -g @truffle-ai/saiki
```

This gives you access to the global `saiki` command.

### 2. Create a Project

Next, create a new Saiki project. This will set up a directory with a default agent configuration.

```bash
saiki init my-first-agent
cd my-first-agent
```

This creates a `my-first-agent` directory containing a `saiki.yml` file. This file is the heart of our **Framework**—it defines how your agent will behave.

### 3. Configure your API Key

The default agent is configured to use OpenAI. To run it, you need to provide an API key.

Open the `.env` file in your new project and add your OpenAI API key:

```.env
OPENAI_API_KEY="sk-..."
```

Saiki's **Runtime** automatically loads variables from this file.

### 4. Run Your Agent

Now you're ready to start your agent. Use the **CLI** to interact with the Saiki **Runtime**.

Run a single command:
```bash
saiki "What is the current working directory?"
```

Or start an interactive session:
```bash
saiki
```
This will start a chat session with your agent directly in your terminal. You've now successfully built and run your first Saiki agent!

## Next Steps

You've just scratched the surface. Here's where to go next:

- **Dive Deeper into the CLI:** Explore all the available commands in the [User Guide](../guides/user-guide/).
- **Customize Your Agent:** Learn how to edit your `saiki.yml` in the [Configuring Saiki](../guides/configuring-saiki/) guide.
- **Understand the Concepts:** Get a firmer grasp on how Saiki works by reading about the [Core Concepts](../concepts/agents-vs-workflows).
- **Follow a Detailed Tutorial:** Build a more advanced agent in the [First Agent Tutorial](./first-agent-tutorial). 