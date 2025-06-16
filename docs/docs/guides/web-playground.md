---
sidebar_position: 2
---

# Web playground 

## Overview

Saiki web playground is the easiest way to test out different LLMs, MCP servers, prompts, and more!

Once you're satisfied with a specific combination, save it as a **Re-usable** AI agent built with Saiki, and deploy the agent anywhere.

All this is possible because Saiki sees any valid config file as a re-usable AI agent.

Saiki web playground also stores your conversation history locally so it remembers your past conversations!

## Get started
**Start saiki web playground:**

```bash
saiki --mode web
```
Then open [http://localhost:3000](http://localhost:3000) in your browser.

Or open saiki web playground in a different port:

```bash
saiki --mode web --web-port 3333
```

## Conversation storage

When installed as a global CLI, saiki stores conversation history in `~/.saiki` folder by default

In development mode, storage location defaults to`<path_to_saiki_project_dir>/.saiki`