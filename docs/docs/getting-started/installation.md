---
sidebar_position: 2
---

# Installation

This guide will walk you through installing the Saiki CLI and setting up your environment so you can start running agents.

### Prerequisites
- [Node.js](https://nodejs.org/en/download) >= 20.0.0
- An [OpenAI API Key](https://platform.openai.com/api-keys)

### 1. Install Saiki
Install Saiki globally using npm:

```bash
npm install -g @truffle-ai/saiki
```
This adds the `saiki` command to your system, giving you access to the agent runtime.

### 2. Set Your API Key
Saiki agents use Large Language Models for reasoning. Set your OpenAI API key as an environment variable:

```bash
export OPENAI_API_KEY="sk-..."
```
Saiki will automatically detect and use this key.

### 3. Verify Your Installation
Test your installation with a simple command:

```bash
saiki "What is the current version of typescript?"
```

If you receive a response, your installation is successful and the runtime is working correctly.

## Next Step: Build Your First Agent
Now that Saiki is installed, you're ready to create your first custom agent with its own configuration and capabilities.

Continue to the **[First Agent Tutorial](./first-agent-tutorial.md)** to learn how to build agents using declarative configuration. 