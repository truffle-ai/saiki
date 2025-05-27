---
sidebar_position: 1

---

# CLI Guide

This guide helps you get started with the Saiki CLI and includes a comprehensive list of commands you can run with Saiki CLI.

Saiki CLI is the easiest way to get started with AI agents.

Some of the cool things you can do with Saiki CLI:

- Talk to any LLM in your terminal
- Create long-lived AI agents with tools, knowledge and memories. Example: a productivity agent that integrates with your linear and github.
- Deploy these agents either locally or on the cloud
- Talk to these agents on any application - discord, telegram, slack, cursor, claude desktop, etc.
- Start building your own AI applications - get started with building your own Cursor! `saiki create-app`


More CLI commands coming soon! Request a CLI command here.


#### **See all available options and flags:**

```bash
saiki -h
```

#### **Launch the interactive CLI:**
```bash
saiki
```

#### **Start saiki CLI with a different LLM**
```bash
# openai
saiki -m gpt-4o

# anthropic
saiki -m claude-4-sonnet-20250514

# google
saiki -m gemini-2.0-flash
```


#### **Start saiki with a different config file**

This allows you to configure saiki CLI to use a different AI agent
```bash
saiki --config-file <path_to_agent_config_file>
```

Check [Configuration Guide](../configuring-saiki/configuration.md) to understand more about saiki config files

#### **Run a specific command with Saiki CLI:**

```bash
saiki find all .sh files in this directory
```

or do the same with gemini:

```bash
saiki -m gemini-2.0-flash find all files in this directory
```

Saiki CLI can accept __any__ command - if it doesn't see it as an in-built command, it will fire a single run CLI with that request

For instance, in the above command, the query "find all .sh files in this directory" will start Saiki Agent, send it this query, process the response, and then exit.


#### **Start a telegram bot**

```bash
saiki --mode telegram
```
To use a specific agent config file for the telegram bot:
```bash
saiki --mode telegram --config-file ./telegram-agent-config.yml
```

<!-- Todo: add telegram demo -->

#### **Start a discord bot**
```bash
saiki --mode discord
```
To use a specific agent config file for the discord bot:
```bash
saiki --mode telegram --config-file ./discord-agent-config.yml
```

<!-- Todo: add discord demo -->

#### **Start saiki as an MCP server**
```bash
saiki --mode mcp
```

With this, you can now connect this agent to Cursor, claude desktop, or even other Saiki agents!


#### **Change log level for saiki CLI**

To change the logging level, set environment variable `SAIKI_LOG_LEVEL` to 'info', 'debug', or 'silly'. Default is 'info'.

ex: for debug logs:
```bash
SAIKI_LOG_LEVEL=debug
saiki what is the time
```


## Project setup commands

These commands will help you get started creating your own AI application using Saiki

Setup a fresh typescript project using saiki-core
```bash
saiki create-app
```

Add saiki into an existing typescript project
```bash
saiki init-app
```

Check [Application Guide](./application.md) for more information!

## Coming soon!

Some of the CLI commands we're working on!

#### Load pre-built templates for saiki CLI

#### Deploy config files as AI agents with saiki CLI


<!-- ## Running saiki with npm locally

This is for developers who have cloned saiki repository locally, as an alternative to `saiki` command

CLI mode: 
```bash
npm run build && npm start
```

Web UI mode:
```bash
npm run build && npm start -- --mode web
```

## Example Commands

- **Natural language task:**
  > "Summarize my latest emails and send the highlights to Slack."
- **Automate web browsing:**
  > "Go to amazon.com and add trail mix to my cart."

Saiki will interpret your request, select the right tools, and execute the workflow for you.

For more advanced usage, see the rest of the documentation! 

Our [Configuration guide](../configuring-saiki/configuration) is the best place to start, it describes exactly how you can customize Saiki for your specific use-case! -->