---
sidebar_position: 1
---

# Conversation

### Send Message
*Sends a message and waits for the full response.*

<p class="api-endpoint-header"><span class="api-method post">POST</span><code>/api/message-sync</code></p>

#### Request Body
- `message` (string, required): The user's message.
- `sessionId` (string, optional): The session to use for this message.
- `imageData` (object, optional):
    - `base64` (string): Base64-encoded image.
    - `mimeType` (string): The MIME type of the image (e.g., `image/png`).

#### Responses

**Success (200)**
```json
{
  "response": "This is the full response from the agent.",
  "sessionId": "b4a2a3e8-72b1-4d00-a5c3-1a2c3d4e5f6a"
}
```

**Error (400)**
```json
{
  "error": "Missing message content"
}
```

### Send Message Asynchronously
*Sends a message and returns immediately. The full response will be sent over WebSocket.*

<p class="api-endpoint-header"><span class="api-method post">POST</span><code>/api/message</code></p>

#### Request Body
- `message` (string, required): The user's message.
- `sessionId` (string, optional): The session to use for this message.
- `stream` (boolean, optional): Set to `true` to receive streaming chunks over WebSocket.

#### Responses

**Success (202)**
```json
{
  "status": "processing",
  "sessionId": "b4a2a3e8-72b1-4d00-a5c3-1a2c3d4e5f6a"
}
```

### Reset Conversation
*Resets the conversation history for a given session.*

<p class="api-endpoint-header"><span class="api-method post">POST</span><code>/api/reset</code></p>

#### Request Body
- `sessionId` (string, optional): The ID of the session to reset.

#### Responses

**Success (200)**
```json
{
  "status": "reset initiated",
  "sessionId": "b4a2a3e8-72b1-4d00-a5c3-1a2c3d4e5f6a"
}
```
