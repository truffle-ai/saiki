---
sidebar_position: 2
---

# Installation

This guide will walk you through installing the Saiki CLI and setting up your environment so you can start running agents.

### Prerequisites
- [Node.js](httpss://nodejs.org/en/download) >= 20.0.0
- An [OpenAI API Key](httpss://platform.openai.com/api-keys)

### 1. Install the Saiki CLI
The Command Line Interface (CLI) is the primary way to interact with Saiki. Install it globally using npm:

```bash
npm install -g @truffle-ai/saiki
```
This adds the `saiki` command to your system.

### 2. Set Your API Key
Saiki uses Large Language Models (LLMs) to reason. By default, it uses OpenAI. Provide your API key as an environment variable:

```bash
export OPENAI_API_KEY="sk-..."
```
Saiki will automatically detect and use this key.

### 3. Verify Your Installation
To ensure everything is working correctly, run a simple command:

```bash
saiki "What is the current version of typescript?"
```

If you receive a response, your installation is successful.

## Next Step: Build Your First Agent
Now that Saiki is installed, you are ready to build your first custom agent.

Continue to the **[First Agent Tutorial](./first-agent-tutorial.md)** to learn how to create an agent with its own unique purpose and tools. 