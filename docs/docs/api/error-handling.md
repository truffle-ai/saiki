---
sidebar_position: 6
---

# Error Handling

Comprehensive guide to understanding, handling, and debugging Saiki API errors. Learn how to build resilient applications that gracefully handle all error scenarios.

## Error Response Format

All API errors follow a consistent JSON structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "field": "Additional context",
      "suggestion": "How to fix this error"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## HTTP Status Codes

| Status | Description | Common Causes |
|--------|-------------|---------------|
| `400` | Bad Request | Invalid request format, missing fields |
| `401` | Unauthorized | Authentication required (future) |
| `404` | Not Found | Server or tool doesn't exist |
| `429` | Rate Limited | Too many requests |
| `500` | Server Error | Internal server error, agent processing failed |
| `503` | Service Unavailable | Server temporarily unavailable |

## Error Codes

### Client Errors (4xx)

#### INVALID_REQUEST
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Request format is invalid",
    "details": {
      "issue": "Invalid JSON format",
      "suggestion": "Check your JSON syntax"
    }
  }
}
```

**Common causes:**
- Malformed JSON in request body
- Invalid Content-Type header
- Invalid URL structure

**How to fix:**
```typescript
// ❌ Invalid JSON
const badRequest = '{"message": "Hello"'; // Missing closing brace

// ✅ Valid JSON
const goodRequest = JSON.stringify({ message: "Hello" });
```

#### MISSING_FIELD
```json
{
  "success": false,
  "error": {
    "code": "MISSING_FIELD",
    "message": "Missing required field: message",
    "details": {
      "field": "message",
      "suggestion": "Include a 'message' field in your request body"
    }
  }
}
```

**How to fix:**
```typescript
// ❌ Missing required field
await fetch('/api/message-sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}) // Missing message field
});

// ✅ Include required fields
await fetch('/api/message-sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: "Hello" })
});
```

#### RATE_LIMIT_EXCEEDED
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "limit": 100,
      "remaining": 0,
      "resetTime": 1640995200
    }
  }
}
```

**How to handle:**
```typescript
async function handleRateLimit(response: Response) {
  if (response.status === 429) {
    const resetTime = response.headers.get('X-RateLimit-Reset');
    const waitTime = (parseInt(resetTime!) * 1000) - Date.now();
    
    console.log(`Rate limited. Waiting ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Retry the request
    return true; // Indicates should retry
  }
  return false;
}
```

### Server Errors (5xx)

#### AGENT_ERROR
```json
{
  "success": false,
  "error": {
    "code": "AGENT_ERROR",
    "message": "Agent processing failed",
    "details": {
      "reason": "LLM service unavailable",
      "suggestion": "Check your API keys and try again"
    }
  }
}
```

**Common causes:**
- Invalid or expired LLM API keys
- LLM service outage
- Configuration errors

#### TOOL_EXECUTION_FAILED
```json
{
  "success": false,
  "error": {
    "code": "TOOL_EXECUTION_FAILED",
    "message": "Failed to execute tool: readFile",
    "details": {
      "toolName": "readFile",
      "serverId": "filesystem",
      "reason": "File not found: ./nonexistent.txt"
    }
  }
}
```

**How to handle:**
```typescript
async function executeToolSafely(serverId: string, toolName: string, args: any) {
  try {
    return await client.executeTool(serverId, toolName, args);
  } catch (error) {
    if (error.response?.data?.error?.code === 'TOOL_EXECUTION_FAILED') {
      const details = error.response.data.error.details;
      console.log(`Tool ${details.toolName} failed: ${details.reason}`);
      
      // Handle specific tool errors
      if (details.reason.includes('File not found')) {
        return { data: null, error: 'File does not exist' };
      }
    }
    throw error;
  }
}
```

#### SERVER_NOT_FOUND
```json
{
  "success": false,
  "error": {
    "code": "SERVER_NOT_FOUND",
    "message": "MCP server not found: nonexistent-server",
    "details": {
      "serverId": "nonexistent-server",
      "suggestion": "Check available servers with GET /api/mcp/servers"
    }
  }
}
```

## WebSocket Errors

### Connection Errors

```javascript
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
  handleConnectionError(error);
};

ws.onclose = (event) => {
  console.log('Connection closed:', event.code, event.reason);
  handleDisconnection(event);
};

function handleConnectionError(error) {
  // Common error scenarios and solutions
  const solutions = {
    'ECONNREFUSED': 'Saiki server is not running. Start with: saiki --mode web',
    'SECURITY_ERR': 'Mixed content error. Use wss:// for HTTPS sites',
    'NETWORK_ERR': 'Network connectivity issue. Check your internet connection'
  };
  
  // Attempt to identify error type and provide solution
  Object.entries(solutions).forEach(([errorType, solution]) => {
    if (error.message?.includes(errorType)) {
      console.log(`Solution: ${solution}`);
    }
  });
}

function handleDisconnection(event) {
  const closeReasons = {
    1000: 'Normal closure',
    1001: 'Going away',
    1006: 'Abnormal closure - likely network issue',
    1011: 'Server error',
    1015: 'TLS handshake failed'
  };
  
  console.log(`Disconnected: ${closeReasons[event.code] || 'Unknown reason'}`);
  
  // Auto-reconnect for certain scenarios
  if (event.code === 1006 || event.code === 1011) {
    setTimeout(() => {
      console.log('Attempting to reconnect...');
      connect();
    }, 1000);
  }
}
```

### Message Errors

```javascript
ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    
    if (data.event === 'error') {
      handleAgentError(data.data);
    } else {
      handleEvent(data);
    }
  } catch (parseError) {
    console.error('Failed to parse WebSocket message:', parseError);
    console.log('Raw message:', event.data);
  }
};

function handleAgentError(errorData) {
  const { code, message, details } = errorData;
  
  switch (code) {
    case 'AGENT_ERROR':
      console.error('Agent failed:', message);
      // Maybe retry with a simpler prompt
      break;
      
    case 'TOOL_EXECUTION_FAILED':
      console.error('Tool failed:', details);
      // Maybe try a different approach
      break;
      
    case 'INVALID_MESSAGE_TYPE':
      console.error('Invalid message type sent');
      // Check your message format
      break;
      
    default:
      console.error('Unknown agent error:', errorData);
  }
}
```

## Retry Strategies

### Exponential Backoff

```typescript
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2
  }
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry client errors (4xx except 429)
      if (error.response?.status >= 400 && 
          error.response?.status < 500 && 
          error.response?.status !== 429) {
        throw error;
      }
      
      if (attempt === config.maxAttempts) {
        break;
      }
      
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelay
      );
      
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Usage
const response = await withRetry(() => 
  client.sendMessage("Process this data")
);
```

### Smart Retry Logic

```typescript
class SmartRetryClient {
  private retryableErrors = [
    'RATE_LIMIT_EXCEEDED',
    'AGENT_ERROR',
    'INTERNAL_ERROR'
  ];
  
  private nonRetryableErrors = [
    'INVALID_REQUEST',
    'MISSING_FIELD',
    'SERVER_NOT_FOUND',
    'TOOL_NOT_FOUND'
  ];
  
  async sendMessageWithRetry(message: string, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.client.sendMessage(message);
      } catch (error) {
        const errorCode = error.response?.data?.error?.code;
        
        // Don't retry non-retryable errors
        if (this.nonRetryableErrors.includes(errorCode)) {
          throw error;
        }
        
        // Handle rate limiting specifically
        if (errorCode === 'RATE_LIMIT_EXCEEDED') {
          const resetTime = error.response?.data?.error?.details?.resetTime;
          if (resetTime) {
            const waitTime = (resetTime * 1000) - Date.now();
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue; // Don't count this as an attempt
          }
        }
        
        if (attempt === maxAttempts) {
          throw error;
        }
        
        // Exponential backoff for other errors
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}
```

## Circuit Breaker Pattern

```typescript
enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open'
}

class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  
  constructor(
    private failureThreshold = 5,
    private recoveryTimeout = 60000,
    private successThreshold = 3
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.recoveryTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is open. Service temporarily unavailable.');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = CircuitState.CLOSED;
      }
    }
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }
  
  getState() {
    return this.state;
  }
}

// Usage
const breaker = new CircuitBreaker();

async function sendMessageSafely(message: string) {
  try {
    return await breaker.execute(() => client.sendMessage(message));
  } catch (error) {
    if (error.message.includes('Circuit breaker is open')) {
      // Handle gracefully - maybe show cached response or error message
      return { response: 'Service temporarily unavailable. Please try again later.' };
    }
    throw error;
  }
}
```

## Timeout Handling

### Request Timeouts

```typescript
class TimeoutClient {
  constructor(private client: any, private defaultTimeout = 30000) {}
  
  async sendMessageWithTimeout(message: string, timeout = this.defaultTimeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch('/api/message-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout}ms`);
      }
      
      throw error;
    }
  }
}
```

### WebSocket Timeouts

```typescript
class TimeoutWebSocket {
  private ws: WebSocket | null = null;
  private messageTimeouts = new Map<string, NodeJS.Timeout>();
  
  async sendMessageWithTimeout(message: string, timeout = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const messageId = Math.random().toString(36);
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        this.messageTimeouts.delete(messageId);
        reject(new Error(`Message timed out after ${timeout}ms`));
      }, timeout);
      
      this.messageTimeouts.set(messageId, timeoutId);
      
      // Listen for response
      const handleMessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        if (data.event === 'response') {
          const timeoutId = this.messageTimeouts.get(messageId);
          if (timeoutId) {
            clearTimeout(timeoutId);
            this.messageTimeouts.delete(messageId);
            this.ws?.removeEventListener('message', handleMessage);
            resolve(data.data.content);
          }
        }
      };
      
      this.ws?.addEventListener('message', handleMessage);
      
      // Send message
      this.ws?.send(JSON.stringify({
        type: 'message',
        content: message,
        id: messageId
      }));
    });
  }
}
```

## Graceful Degradation

```typescript
class ResilientSaikiClient {
  constructor(
    private primaryClient: any,
    private fallbackResponses: Map<string, string> = new Map()
  ) {}
  
  async sendMessage(message: string): Promise<string> {
    try {
      // Try primary service
      const response = await this.primaryClient.sendMessage(message);
      return response.response;
    } catch (error) {
      console.warn('Primary service failed:', error.message);
      
      // Try to find a cached/fallback response
      const fallback = this.findFallbackResponse(message);
      if (fallback) {
        console.log('Using fallback response');
        return fallback;
      }
      
      // Generate a helpful error message
      return this.generateHelpfulErrorMessage(error, message);
    }
  }
  
  private findFallbackResponse(message: string): string | null {
    // Check for exact matches first
    if (this.fallbackResponses.has(message)) {
      return this.fallbackResponses.get(message)!;
    }
    
    // Check for similar messages
    const normalizedMessage = message.toLowerCase();
    for (const [key, value] of this.fallbackResponses.entries()) {
      if (normalizedMessage.includes(key.toLowerCase()) || 
          key.toLowerCase().includes(normalizedMessage)) {
        return value;
      }
    }
    
    return null;
  }
  
  private generateHelpfulErrorMessage(error: any, message: string): string {
    const errorCode = error.response?.data?.error?.code;
    
    switch (errorCode) {
      case 'RATE_LIMIT_EXCEEDED':
        return "I'm currently experiencing high traffic. Please try again in a few moments.";
      
      case 'AGENT_ERROR':
        return "I'm having trouble processing your request. Could you try rephrasing it?";
      
      case 'TOOL_EXECUTION_FAILED':
        return "I couldn't access the requested resource. Please check if it exists and try again.";
      
      default:
        return "I'm experiencing technical difficulties. Please try again later or contact support if the issue persists.";
    }
  }
  
  // Add common fallback responses
  addFallbackResponse(trigger: string, response: string) {
    this.fallbackResponses.set(trigger, response);
  }
}

// Setup with common fallbacks
const client = new ResilientSaikiClient(primaryClient);
client.addFallbackResponse('hello', 'Hello! How can I help you today?');
client.addFallbackResponse('help', 'I can assist you with various tasks. What would you like to do?');
client.addFallbackResponse('status', 'All systems are currently operational.');
```

## Debugging Tips

### Enable Debug Logging

```typescript
class DebugSaikiClient {
  constructor(private client: any, private debug = false) {}
  
  async sendMessage(message: string) {
    const startTime = Date.now();
    
    if (this.debug) {
      console.log(`[DEBUG] Sending message: ${message}`);
    }
    
    try {
      const response = await this.client.sendMessage(message);
      
      if (this.debug) {
        const duration = Date.now() - startTime;
        console.log(`[DEBUG] Response received in ${duration}ms:`, response);
      }
      
      return response;
    } catch (error) {
      if (this.debug) {
        console.error(`[DEBUG] Error after ${Date.now() - startTime}ms:`, {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        });
      }
      throw error;
    }
  }
}
```

### Health Check Integration

```typescript
async function performHealthCheck() {
  try {
    const response = await fetch('http://localhost:3001/api/health');
    const data = await response.json();
    
    console.log('Health check:', data);
    
    if (data.status !== 'healthy') {
      console.warn('Service is not healthy:', data);
    }
    
    return data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw new Error('Service is unavailable');
  }
}

// Run health check before critical operations
async function sendCriticalMessage(message: string) {
  await performHealthCheck();
  return await client.sendMessage(message);
}
```

## Error Monitoring

```typescript
class ErrorMonitor {
  private errorCounts = new Map<string, number>();
  private lastErrors = new Array<any>();
  
  logError(error: any, context?: string) {
    const errorKey = error.response?.data?.error?.code || error.name || 'UNKNOWN';
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    
    this.lastErrors.unshift({
      error: errorKey,
      message: error.message,
      context,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 100 errors
    if (this.lastErrors.length > 100) {
      this.lastErrors = this.lastErrors.slice(0, 100);
    }
    
    // Alert on high error rates
    if (this.errorCounts.get(errorKey)! > 10) {
      console.warn(`High error rate detected for ${errorKey}: ${this.errorCounts.get(errorKey)} occurrences`);
    }
  }
  
  getErrorStats() {
    return {
      totalErrors: this.lastErrors.length,
      errorCounts: Object.fromEntries(this.errorCounts),
      recentErrors: this.lastErrors.slice(0, 10)
    };
  }
}
```

## Best Practices

### 1. Always Handle Errors
```typescript
// ❌ Don't ignore errors
client.sendMessage("Hello"); // No error handling

// ✅ Always handle errors
try {
  await client.sendMessage("Hello");
} catch (error) {
  console.error('Failed to send message:', error);
  // Handle appropriately
}
```

### 2. Provide User-Friendly Messages
```typescript
// ❌ Show technical errors to users
catch (error) {
  alert(error.response.data.error.message);
}

// ✅ Show helpful messages
catch (error) {
  const userMessage = getUserFriendlyErrorMessage(error);
  alert(userMessage);
}
```

### 3. Implement Proper Retry Logic
```typescript
// ❌ Retry everything blindly
catch (error) {
  return await client.sendMessage(message); // Infinite loop potential
}

// ✅ Smart retry with limits
catch (error) {
  if (isRetryableError(error) && attempts < maxAttempts) {
    await sleep(calculateDelay(attempts));
    return await sendMessageWithRetry(message, attempts + 1);
  }
  throw error;
}
```

### 4. Monitor and Log
```typescript
// ❌ Silent failures
catch (error) {
  return fallbackResponse;
}

// ✅ Log and monitor
catch (error) {
  logger.error('API call failed', { error, context });
  metrics.incrementCounter('api.errors', { type: error.code });
  return fallbackResponse;
}
```

## Common Issues & Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Server not running | `ECONNREFUSED` errors | Start Saiki with `saiki --mode web` |
| Invalid API keys | `AGENT_ERROR` responses | Check API keys in `.env` file |
| CORS errors | Browser console errors | Configure CORS in server settings |
| Rate limiting | `429` status codes | Implement retry with backoff |
| Large responses | Timeout errors | Increase timeout or use streaming |
| Memory issues | Server crashes | Monitor memory usage, restart server |

## Getting Help

When reporting errors, include:

1. **Error message** and full stack trace
2. **Request details** (endpoint, payload, headers)
3. **Environment info** (Node.js version, OS, Saiki version)
4. **Steps to reproduce** the error
5. **Expected vs actual behavior**

**Support channels:**
- [Discord Community](https://discord.gg/GFzWFAAZcm)
- [GitHub Issues](https://github.com/truffle-ai/saiki/issues)
- Documentation troubleshooting sections

## Next Steps

- **Back to basics?** Review [Authentication](./authentication) and [REST API](./rest-api)
- **Need examples?** Check out [SDKs & Examples](./sdks-examples)
- **Ready to build?** Head to [Building with Saiki](../building-with-saiki/) 