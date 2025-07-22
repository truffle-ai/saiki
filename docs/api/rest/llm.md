---
sidebar_position: 4
---

# LLM Configuration

### Get Current LLM Config
*Retrieves the current LLM configuration.*

<p class="api-endpoint-header"><span class="api-method get">GET</span><code>/api/llm/current</code></p>

#### Responses
**Success (200)**
```json
{
  "config": {
    "provider": "openai",
    "model": "gpt-4o"
  }
}
```

### List LLM Providers
*Gets a list of all available LLM providers and their models.*

<p class="api-endpoint-header"><span class="api-method get">GET</span><code>/api/llm/providers</code></p>

#### Responses
**Success (200)**
```json
{
  "providers": {
    "openai": {
      "name": "Openai",
      "models": ["gpt-4o", "gpt-4-turbo"],
      "supportedRouters": ["litellm", "vercel"],
      "supportsBaseURL": true
    },
    "cohere": {
      "name": "Cohere",
      "models": ["command-r-plus", "command-r", "command", "command-light"],
      "supportedRouters": ["vercel"],
      "supportsBaseURL": false
    }
  }
}
```

### Switch LLM
*Switches the LLM configuration.*

<p class="api-endpoint-header"><span class="api-method post">POST</span><code>/api/llm/switch</code></p>

#### Request Body
- `provider` (string), `model` (string), `apiKey` (string), etc.

#### Responses

**Success (200)**
```json
{
  "success": true,
  "message": "LLM switched successfully to gpt-4o",
  "config": {
    "provider": "openai",
    "model": "gpt-4o"
  }
}
```

**Error (400)**
```json
{
  "success": false,
  "error": "Invalid LLM provider: ..."
}
```
