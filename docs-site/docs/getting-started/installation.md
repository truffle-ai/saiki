---
sidebar_position: 2
---

# Installation

Follow these steps to install Saiki and get started quickly.

## Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or above recommended)
- npm (comes with Node.js)

## Install via npm (Recommended)

```bash
npm install -g @truffle-ai/saiki
```

This will make the `saiki` command available globally on your system.

## Build and Link from Source (Advanced)

If you want to work with the latest source code or contribute to Saiki:

```bash
git clone https://github.com/truffle-ai/saiki.git
cd saiki
npm install
npm run build
npm link
```

After linking, the `saiki` command will be available globally.

You're now ready to use Saiki! Continue to the [Usage](./usage.md) guide to learn how to run your first commands. 