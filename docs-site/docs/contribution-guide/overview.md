---
sidebar_position: 1
---

# Overview

This document describes how to get started with contributing to Saiki

1. **Fork and clone the repo**

This is a one-time step

First fork the repository to your github account.
Then clone your fork:

```bash
git clone https://github.com/your-username/saiki.git
cd saiki
```

2. **Build and test the repo**
```bash
npm run build
```

```bash
npm run test
```

3. **Run some commands**

Start CLI mode: 
```bash
npm run build && npm start
```

Start Web UI mode:
```bash
npm run build && npm start -- --mode web
```

Optionally, if you prefer using `saiki` command, directly
```bash
npm run build && npm link
```

This sets up the latest code into a local `saiki` CLI so you can test it out
This doesn't automatically update with the latest code changes, so you will need to run this each time you are testing.

```bash
saiki -h
```

Once you are ready with the above steps, check https://github.com/truffle-ai/saiki/blob/main/CONTRIBUTING.md for details on opening a PR

