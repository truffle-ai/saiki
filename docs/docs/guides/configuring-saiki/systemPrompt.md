---
sidebar_position: 2
sidebar_label: "System Prompt"
---

# System Prompt Configuration

Configure how your Saiki agent behaves and responds to users through system prompts.

## Overview

System prompts define your agent's personality, behavior, and capabilities. They can be simple strings for basic use cases or advanced configurations with multiple contributors for complex scenarios.

## Configuration Types

### Simple String Prompt

The simplest way to configure a system prompt:

```yaml
systemPrompt: |
  You are a helpful AI assistant with access to tools.
  Use these tools when appropriate to answer user queries.
  You can use multiple tools in sequence to solve complex problems.
  After each tool result, determine if you need more information or can provide a final answer.
```

### Advanced SystemPromptConfig

For more complex scenarios using structured contributors:

```yaml
systemPrompt:
  contributors:
    - id: default
      type: static
      priority: 1
      content: |
        You are a helpful AI assistant with access to tools.
        Use these tools when appropriate to answer user queries.
    - id: date-time
      type: dynamic
      priority: 2
      source: dateTime
    - id: custom-instructions
      type: static
      priority: 3
      enabled: true
      content: |
        Additional custom instructions for this specific agent.
```

## Contributors

### Static Contributors
- **Type:** `static`
- **Required:** `content` field
- **Use case:** Fixed text and consistent agent behavior instructions
- **Priority:** Contibutors are concatenated in ascending-piority order. `priority: 1` text appears before `priority:2` in the system prompt

```yaml
systemPrompt:
  contributors:
    - id: core-behavior
      type: static
      priority: 1
      content: |
        You are a professional assistant that provides accurate information.
        Always be helpful, respectful, and thorough in your responses.
```

### Dynamic Contributors
- **Type:** `dynamic`  
- **Required:** `source` field
- **Use case:** Dynamically generated content
- **Control:** Enable/disable with `enabled` field

```yaml
systemPrompt:
  contributors:
    - id: timestamp
      type: dynamic
      priority: 2
      source: dateTime
      enabled: true
```

#### Available Dynamic Sources
- **`dateTime`:** Automatically adds current date/time context

### Contributor Fields

- **`id`** (string): Unique identifier for the contributor
- **`type`** (`static` | `dynamic`): Type of contributor
- **`priority`** (number): Execution order (lower numbers first)
- **`enabled`** (boolean, optional): Whether contributor is active (default: true)
- **`content`** (string): Static content (required for `static` type)
- **`source`** (string): Dynamic source identifier (required for `dynamic` type)

## Examples

### Production Agent
```yaml
systemPrompt:
  contributors:
    - id: core
      type: static
      priority: 1
      content: |
        You are a helpful AI assistant designed to work with tools and data.
        Always use available tools when they can help answer user questions.
        Provide clear, accurate, and helpful responses.
    - id: timestamp
      type: dynamic
      priority: 2
      source: dateTime
```

### Development Agent
```yaml
systemPrompt: |
  You are a helpful AI assistant running in development mode.
  Use the available tools to help users with their tasks.
  Be verbose in your explanations for debugging purposes.
```

### Customer Support Agent
```yaml
systemPrompt:
  contributors:
    - id: role
      type: static
      priority: 1
      content: |
        You are a customer support assistant for our software platform.
        Always be polite, professional, and solution-oriented.
    - id: context
      type: dynamic
      priority: 2
      source: dateTime
    - id: guidelines
      type: static
      priority: 3
      content: |
        - Always acknowledge the customer's concern
        - Provide step-by-step solutions when possible
        - Escalate complex technical issues to engineering team
```

## Best Practices

1. **Keep it focused:** Clear, specific instructions work better than lengthy prompts
2. **Use priority ordering:** Structure contributors logically from general to specific
3. **Test behavior:** Validate that your prompt produces the desired agent behavior
4. **Dynamic content:** Use dynamic sources for time-sensitive or contextual information
5. **Modular approach:** Break complex prompts into separate contributors for easier management

