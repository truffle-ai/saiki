---
sidebar_position: 6
sidebar_label: "Sessions"
---

# Sessions Configuration

Configure session management for your Saiki agent, including maximum concurrent sessions and session timeouts.

## Overview

Sessions in Saiki represent individual conversation contexts or user interactions. Each session maintains its own message history, tool approvals, and state.

## Configuration

```yaml
sessions:
  maxSessions: 100        # Maximum concurrent sessions
  sessionTTL: 3600000     # Session timeout in milliseconds (1 hour)
```

## Options

### `maxSessions`
- **Type:** Number (positive integer)
- **Default:** 100
- **Description:** Maximum number of concurrent sessions the agent can handle

### `sessionTTL`
- **Type:** Number (milliseconds)
- **Default:** 3600000 (1 hour)
- **Description:** How long sessions remain active without activity before being cleaned up

## Examples

### High-Traffic Environment
```yaml
sessions:
  maxSessions: 1000
  sessionTTL: 1800000     # 30 minutes
```

### Low-Resource Environment
```yaml
sessions:
  maxSessions: 20
  sessionTTL: 7200000     # 2 hours
```

### Development Environment
```yaml
sessions:
  maxSessions: 10
  sessionTTL: 86400000    # 24 hours (for debugging)
```

## Session Behavior

- **Automatic cleanup:** Expired sessions are automatically removed
- **Session isolation:** Each session has independent conversation history and tool approvals
- **Memory management:** Limiting sessions prevents memory exhaustion in long-running deployments

## Default Configuration

If not specified, Saiki uses:
```yaml
sessions:
  maxSessions: 100
  sessionTTL: 3600000
```

This provides a good balance for most use cases.