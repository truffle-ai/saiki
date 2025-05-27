---
sidebar_position: 2
---

# Examples & Demos

Saiki can automate a wide range of tasks using natural language. Here are some real-world examples and demos to help you get started:

---

## 🛒 Amazon Shopping Assistant
**Task:**
> Can you go to amazon and add some snacks to my cart? I like trail mix, cheetos and maybe surprise me with something else?

```bash
# Use default config which supports puppeteer for navigating the browser
saiki
```

[![Saiki: Amazon shopping agent demo](https://github.com/user-attachments/assets/3f5be5e2-7a55-4093-a071-8c52f1a83ba3)](https://youtu.be/C-Z0aVbl4Ik)

---

## 📧 Email Summary to Slack
**Task:**
> Summarize emails and send highlights to Slack

```bash
saiki --config-file ./configuration/examples/email_slack.yml
```

![Email to Slack Demo](/assets/email_slack_demo.gif)

---

## 🎨 AI Website Designer
**Task:**
> Design a landing page based on README.md

```bash
saiki --config-file ./configuration/examples/website_designer.yml
```

![Website Designer Demo](/assets/website_demo.gif)

---

For more examples and advanced use cases, see the [project README](https://github.com/truffle-ai/saiki#examples--demos). 