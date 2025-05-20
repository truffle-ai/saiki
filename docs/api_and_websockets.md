# Saiki API and WebSocket Interface

When Saiki runs in `web` mode (`saiki --mode web`), it exposes a comprehensive REST API and a WebSocket interface, allowing you to control and interact with the agent programmatically. This is ideal for building custom front-ends, backend integrations, or embedding Saiki into existing platforms.

## REST API Endpoints

*Note: These endpoints are Work-In-Progress (WIP) and may change in future releases*

The following are the key API endpoints. For complete details and implementation, refer to `src/app/api/server.ts`.

*   **`POST /api/message`**
    *   **Description**: Send a message (prompt) to the Saiki agent asynchronously. The agent will process the message and emit events (e.g., `thinking`, `chunk`, `toolCall`, `toolResult`, `response`) that can be subscribed to via WebSockets.
    *   **Request Body**:
        ```json
        {
          "message": "What's the weather like in London?"
        }
        ```
    *   **Response**: `202 Accepted` with `{"status": "processing"}`

*   **`POST /api/message-sync`**
    *   **Description**: Send a message and receive the complete agent response in a single HTTP call. This is useful for simpler request-response interactions. Supports multimodal input (text and images).
    *   **Request Body**:
        ```json
        {
          "message": "Describe this image.",
          "imageData": { // Optional
            "base64": "...", // base64 encoded image string
            "mimeType": "image/png" // or other supported image MIME type
          }
        }
        ```
    *   **Response**: `200 OK` with `{"response": "The agent's full response text."}`

*   **`POST /api/reset`**
    *   **Description**: Clears the current conversation history in the agent, allowing for a fresh start.
    *   **Request Body**: Empty or `{}`
    *   **Response**: `200 OK` with `{"status": "reset initiated"}`

*   **`POST /api/connect-server`**
    *   **Description**: Dynamically connect a new MCP server (tool server) to the agent at runtime.
    *   **Request Body**:
        ```json
        {
          "name": "my_custom_tool_server",
          "config": {
            "type": "stdio", // or other supported MCP server types
            "command": "npm",
            "args": ["start", "--prefix", "./path/to/my-tool-server"]
            // ... other server-specific configuration
          }
        }
        ```
    *   **Response**: `200 OK` with `{"status": "connected", "name": "my_custom_tool_server"}`

*   **`GET /api/mcp/servers`**
    *   **Description**: List all currently connected and attempted MCP servers along with their operational status (e.g., 'connected', 'error').
    *   **Response**: `200 OK` with a JSON array of server objects:
        ```json
        {
          "servers": [
            { "id": "filesystem", "name": "filesystem", "status": "connected" },
            { "id": "puppeteer", "name": "puppeteer", "status": "error" }
          ]
        }
        ```

*   **`GET /api/mcp/servers/:serverId/tools`**
    *   **Description**: Get a list of tools available from a specific connected MCP server.
    *   **Path Parameters**:
        *   `serverId`: The ID/name of the MCP server.
    *   **Response**: `200 OK` with a JSON array of tool objects:
        ```json
        {
          "tools": [
            {
              "id": "readFile",
              "name": "readFile",
              "description": "Reads a file from the filesystem.",
              "inputSchema": { /* JSON schema for tool parameters */ }
            }
          ]
        }
        ```

*   **`POST /api/mcp/servers/:serverId/tools/:toolName/execute`**
    *   **Description**: Directly execute a specific tool on a connected MCP server with the given arguments.
    *   **Path Parameters**:
        *   `serverId`: The ID/name of the MCP server.
        *   `toolName`: The name of the tool to execute.
    *   **Request Body**: A JSON object matching the `inputSchema` of the tool.
        ```json
        {
          "path": "./README.md"
        }
        ```
    *   **Response**: `200 OK` with `{"success": true, "data": { /* tool execution result */ }}` or an error status code on failure.

*   **`GET /api/config.yaml`**
    *   **Description**: Exports the current agent configuration (derived from the loaded YAML file and any dynamic additions like connected servers) in YAML format. Sensitive information, such as API keys, will be omitted or replaced with placeholders.
    *   **Response**: `

## WebSocket Interface

For real-time, bidirectional communication, Saiki provides a WebSocket interface when running in `web` mode (`saiki --mode web`). This interface allows clients to send commands and messages to the Saiki agent and receive a stream of events as the agent processes them. It is the same interface utilized by Saiki's own Web UI.

### Connecting to the WebSocket Server

When Saiki is started with `saiki --mode web` (or `npm start -- --mode web`), the WebSocket server is initiated alongside the HTTP API server. It typically listens on the same host and port as the HTTP server.

*   **URL Scheme**: Use `ws://` for non-TLS connections (e.g., local development) or `wss://` for TLS-secured connections.
*   **Host and Port**: Same as the HTTP server (e.g., `localhost:3001` by default).
*   **Path**: The WebSocket server is usually available at the root path (`/`).

**Example Connection URL (default local setup):** `ws://localhost:3001/`

Clients should establish a standard WebSocket connection to this URL. Once connected, they can send and receive JSON-formatted messages.

### Sending Messages to the Agent

Once connected, clients can send messages to the Saiki agent. All messages sent to the agent via WebSocket must be JSON strings. The server expects a JSON object with a `type` field, which determines the action to be taken.

Based on `src/app/api/server.ts`, the following message types are supported:

*   **Send a User Message/Prompt:**
    *   **`type`**: `"message"`
    *   **`content`**: A string containing the user's message or prompt for the agent.
    *   **`imageData`** (Optional): An object for multimodal input, containing:
        *   `base64`: A base64 encoded string of the image.
        *   `mimeType`: The MIME type of the image (e.g., `"image/png"`, `"image/jpeg"`).
    *   **Action**: The Saiki agent will process this message using `agent.run(content, imageData)`.
    *   **Example**:
        ```json
        {
          "type": "message",
          "content": "What's the latest news on AI?",
          "imageData": {
            "base64": "iVBORw0KGgoAAAANSUhEUgAAAAUA...",
            "mimeType": "image/png"
          }
        }
        ```

*   **Reset Agent's Conversation:**
    *   **`type`**: `"reset"`
    *   **Action**: The Saiki agent will clear its current conversation history using `agent.resetConversation()`.
    *   **Example**:
        ```json
        {
          "type": "reset"
        }
        ```

**Important:**
*   Sending a message with an unrecognized `type` will result in the agent logging a warning, and an error event being sent back to the WebSocket client (e.g., `{"event": "error", "data": {"message": "Unknown message type"}}`).
*   If a message of `type: "message"` is missing the `content` field, it will likely be ignored or cause an error during agent processing.