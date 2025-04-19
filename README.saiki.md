# Saiki - README Draft

## Introduction
Saiki is a highly customizable, flexible, powerful AI Agent, built in Typescript.

Replicate different versions of Saiki to build specialized AI agents.

### Key Features:

*   **CLI first, web UI supported:** Interact via terminal or a web interface.
*   **In-built MCP support:** Supports both remote and local MCP servers.
*   **Fully customizable:** Update `~/.saiki/config.yml` to customize your agent. Pre-built templates available.
*   **Supports Docker:** Save your Saiki configurations as Docker images to re-run or host anywhere.
*   **Deploy to Truffle Cloud:** Deploy Docker images built with Saiki to Truffle Cloud (coming soon).

### Example Use Cases:

*   **Gaming Agent:** An agent built to play Pokémon Emerald.
*   **Shopping Agent:** Connects to Notion and browsers to manage shopping lists and carts.

## How to Use Saiki:

1.  **Install:**
    ```bash
    npm install -g @truffle-ai/saiki
    ```
2.  **Start Saiki:**
    *   CLI: `saiki`
    *   Web UI: `saiki --mode web`
3.  **Configure Saiki:**
    *   Create a new config file: `saiki create-config`
    *   Create from a template: `saiki create-config --template <template_name>`
    *   *(These commands guide environment setup)*
    *   Modify the generated `~/.saiki/config.yml` for custom behavior.
    *   Environment variables can be referenced in the config.
4.  **Save with Docker:** (Docker command TBD)
5.  **Deploy to Truffle Cloud:** (Coming soon)

## How to Work with Saiki's Code (Development):

Saiki is fully flexible - you can fork the codebase and customize it for your use cases.

1.  **Setup:**
    ```bash
    git clone <repo_url> && cd saiki
    npm install
    npm run build && npm start
    ```
2.  *(More details in DEVELOPER_GUIDE.md)*

## Contributions

If you've built something cool or want to contribute:

*   Check out `CONTRIBUTING.md` (link TBD).
*   Join our Discord (link TBD).

We welcome contributions! 