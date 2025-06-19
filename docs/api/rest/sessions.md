---
sidebar_position: 2
---

# Session Management

### List Sessions
*Retrieves a list of all active sessions.*

<p class="api-endpoint-header"><span class="api-method get">GET</span><code>/api/sessions</code></p>

#### Responses

**Success (200)**
```json
{
  "sessions": [
    {
      "id": "b4a2a3e8-72b1-4d00-a5c3-1a2c3d4e5f6a",
      "createdAt": "2023-10-27T10:00:00.000Z",
      "lastActivity": "2023-10-27T10:05:00.000Z",
      "messageCount": 4
    }
  ]
}
```

### Create Session
*Creates a new session.*

<p class="api-endpoint-header"><span class="api-method post">POST</span><code>/api/sessions</code></p>

#### Request Body
- `sessionId` (string, optional): A custom ID for the new session.

#### Responses

**Success (201)**
```json
{
  "session": {
    "id": "c5b3b4f9-83c2-5e11-b6d4-2b3d4e5f6a7b",
    "createdAt": "2023-10-27T11:00:00.000Z",
    "lastActivity": "2023-10-27T11:00:00.000Z",
    "messageCount": 0
  }
}
```

### Get Session Details
*Fetches details for a specific session.*

<p class="api-endpoint-header"><span class="api-method get">GET</span><code>/api/sessions/:sessionId</code></p>

#### Responses

**Success (200)**
```json
{
  "session": {
    "id": "b4a2a3e8-72b1-4d00-a5c3-1a2c3d4e5f6a",
    "createdAt": "2023-10-27T10:00:00.000Z",
    "lastActivity": "2023-10-27T10:05:00.000Z",
    "messageCount": 4,
    "history": 8
  }
}
```

**Error (404)**
```json
{
  "error": "Session not found"
}
```

### Get Session History
*Retrieves the conversation history for a session.*

<p class="api-endpoint-header"><span class="api-method get">GET</span><code>/api/sessions/:sessionId/history</code></p>

#### Responses

**Success (200)**
```json
{
    "history": [
        { "role": "user", "content": "Hello" },
        { "role": "assistant", "content": "Hi! How can I help?" }
    ]
}
```

### Delete Session
*Deletes a session and its history.*

<p class="api-endpoint-header"><span class="api-method delete">DELETE</span><code>/api/sessions/:sessionId</code></p>

#### Responses

**Success (200)**
```json
{
  "status": "deleted",
  "sessionId": "b4a2a3e8-72b1-4d00-a5c3-1a2c3d4e5f6a"
}
```

### Load Session
*Sets a session as the current "active" session.*

<p class="api-endpoint-header"><span class="api-method post">POST</span><code>/api/sessions/:sessionId/load</code></p>

#### Responses

**Success (200)**
```json
{
    "status": "loaded",
    "sessionId": "b4a2a3e8-72b1-4d00-a5c3-1a2c3d4e5f6a",
    "currentSession": "b4a2a3e8-72b1-4d00-a5c3-1a2c3d4e5f6a"
}
```
