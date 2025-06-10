---
sidebar_position: 2
---

# Authentication

Learn how to securely authenticate and manage access to the Saiki API.

## Overview

Currently, Saiki API runs in **development mode** without authentication by default. This is perfect for local development and testing, but production deployments should implement proper security measures.

## Development Mode (Current)

When running Saiki locally, no authentication is required:

```bash
# Start Saiki in web mode
saiki --mode web

# Make requests without authentication
curl http://localhost:3001/api/message-sync \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'
```

:::warning Production Warning
Never expose an unauthenticated Saiki instance to the public internet. Always implement proper security measures in production.
:::

## Planned Authentication Methods

Future versions of Saiki will support multiple authentication methods:

### API Key Authentication
```bash
curl http://localhost:3001/api/message-sync \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'
```

### JWT Token Authentication
```javascript
const response = await fetch('/api/message-sync', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ message: "Hello!" })
});
```

### OAuth 2.0 Integration
For enterprise deployments with existing identity providers.

## Security Best Practices

### Network Security
- **Use HTTPS** in production environments
- **Restrict access** with firewalls and VPNs
- **Use reverse proxy** (nginx, Cloudflare) for additional security
- **Implement CORS** policies appropriately
<!-- 
### Environment Security
```bash
# Use environment variables for sensitive data
export SAIKI_API_KEY=your-secret-key
export SAIKI_JWT_SECRET=your-jwt-secret

# Never commit secrets to version control
echo "*.env" >> .gitignore
```

<!-- ### Request Validation
```javascript
// Validate and sanitize all inputs
const validateMessage = (message) => {
  if (!message || typeof message !== 'string') {
    throw new Error('Invalid message format');
  }
  if (message.length > 10000) {
    throw new Error('Message too long');
  }
  return message.trim();
};
```

<!-- ## Rate Limiting

Saiki implements rate limiting to prevent abuse:

| Resource | Limit | Window |
|----------|--------|--------|
| REST API | 100 requests | 1 minute |
| WebSocket Messages | 50 messages | 1 minute |
| File Uploads | 10 MB | Per request |
| Concurrent Connections | 10 connections | Per IP |

### Rate Limit Headers

API responses include rate limit information:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Handling Rate Limits

```javascript
async function makeAPICall(url, data) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.status === 429) {
      const resetTime = response.headers.get('X-RateLimit-Reset');
      const waitTime = (resetTime * 1000) - Date.now();
      
      console.log(`Rate limited. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Retry the request
      return makeAPICall(url, data);
    }
    
    return response;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}
``` --> --> -->

## CORS Configuration

For web applications, configure CORS appropriately:

```javascript
// Allowed origins (configure based on your needs)
const allowedOrigins = [
  'http://localhost:3000',
  'https://yourdomain.com'
];

// CORS headers in responses
{
  'Access-Control-Allow-Origin': 'https://yourdomain.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
}
```

<!-- ## WebSocket Authentication

For WebSocket connections, authentication will be handled during the initial handshake:

<!-- ```javascript
// Future WebSocket authentication
const ws = new WebSocket('ws://localhost:3001/', {
  headers: {
    'Authorization': 'Bearer your-token'
  }
});

// Or via query parameters
const ws = new WebSocket('ws://localhost:3001/?token=your-token');
```

## Error Responses

Authentication errors follow the standard error format:

### Invalid Authentication
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing authentication credentials",
    "details": {
      "type": "authentication_error",
      "suggestion": "Please provide a valid API key or token"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Rate Limit Exceeded
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
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Development Setup

For local development, you can run Saiki without authentication:

```bash
# Development mode (no auth required)
saiki --mode web --dev

# With environment variables
SAIKI_DEV_MODE=true saiki --mode web
``` --> 
## Production Deployment

When deploying to production, consider these security measures:

### Reverse Proxy Setup (nginx)
```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;
    
    # SSL configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Container Security
```dockerfile
# Use non-root user in Docker
FROM node:18-alpine
RUN addgroup -g 1001 -S saiki
RUN adduser -S saiki -u 1001
USER saiki

# Set security headers
ENV NODE_ENV=production
ENV SAIKI_SECURITY_HEADERS=true
```

### Monitoring and Logging
```javascript
// Log all authentication attempts
app.use((req, res, next) => {
  if (req.headers.authorization) {
    console.log(`Auth attempt: ${req.ip} - ${req.path}`);
  }
  next();
});

// Monitor failed attempts
let failedAttempts = new Map();
app.use((req, res, next) => {
  if (res.statusCode === 401) {
    const attempts = failedAttempts.get(req.ip) || 0;
    failedAttempts.set(req.ip, attempts + 1);
    
    if (attempts > 5) {
      // Block IP or alert administrators
      console.warn(`Multiple auth failures from ${req.ip}`);
    }
  }
  next();
});
```

## Getting Help

- **Security questions?** Join our [Discord community](https://discord.gg/GFzWFAAZcm)
- **Found a vulnerability?** Email founders@truffle.ai
- **Feature requests?** Create an [issue on GitHub](https://github.com/truffle-ai/saiki/issues) 