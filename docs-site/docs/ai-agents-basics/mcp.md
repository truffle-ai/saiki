---
sidebar_position: 5
---

# What is MCP (Model Context Protocol)?

The **Model Context Protocol (MCP)** is an open protocol that defines how AI agents (like those in Saiki) can discover, connect to, and interact with external tools, services, and APIs in a standardized way.

## Why MCP Matters

- **Interoperability:** MCP provides a common language for agents and tools, making it easy to connect new services without custom integration code for each one.
- **Extensibility:** Anyone can build and share MCP-compatible tools, expanding what agents can do.
- **Modularity:** Tools are decoupled from the agent's core logic, so you can add, remove, or swap tools as needed.

## How Saiki Uses MCP

Saiki uses MCP to:
- **Discover available tools:** MCP servers advertise what actions they support (e.g., read a file, send an email, browse the web).
- **Connect to tools:** Saiki communicates with MCP servers using a standard protocol (often over stdio, HTTP, or sockets).
- **Invoke tool actions:** When you give a command, Saiki selects the right tool(s) via MCP and orchestrates their use to fulfill your request.

## Example: Registering a Tool via MCP

Suppose you want to add a filesystem tool. In your Saiki configuration, you might specify:

```yaml
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - .
```

This tells Saiki to launch the MCP-compatible filesystem server, which then advertises its capabilities to the agent.

## Learn More

- [Model Context Protocol documentation](https://modelcontextprotocol.io/introduction)
- [MCP reference servers on GitHub](https://github.com/modelcontextprotocol/reference-servers)

MCP is a key part of what makes Saiki flexible, extensible, and able to automate across a wide range of tools and services. 