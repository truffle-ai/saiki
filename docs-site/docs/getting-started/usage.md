---
sidebar_position: 3
---

# Usage

Now that you have Saiki installed, here's how to start using it.

## Running Saiki via CLI

To launch the interactive CLI:

```bash
saiki
```

You can also see all available options and flags:

```bash
saiki -h
```

## Running the Web UI (Experimental)

Saiki includes an experimental web interface. To start it:

```bash
saiki --mode web --web-port 3000
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## Running saiki with npm locally

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

Our [Configuration guide](../configuring-saiki/configuration) is the best place to start, it describes exactly how you can customize Saiki for your specific use-case!