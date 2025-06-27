---
sidebar_position: 3
---

# Deployment Guide

Deploy Saiki agents using Docker for local or production environments.

## Docker Deployment

### Quick Start

1. **Build the Docker image**
   ```bash
   docker build -t saiki .
   ```

2. **Create environment file**
   ```bash
   # .env
   OPENAI_API_KEY=your_openai_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   # Add other API keys as needed
   ```

3. **Run the container**
   ```bash
   docker run --env-file .env -p 3001:3001 saiki
   ```

Your Saiki server will be available at `http://localhost:3001` with:
- ✅ SQLite database connected
- ✅ MCP servers (filesystem & puppeteer) connected  
- ✅ REST API + WebSocket endpoints available

### Background Mode

Run Saiki in detached mode:

```bash
# Start in background
docker run -d --name saiki-server --env-file .env -p 3001:3001 saiki

# View logs
docker logs -f saiki-server

# Stop server
docker stop saiki-server
```

### Docker Compose

For easier management:

```yaml
# docker-compose.yml
version: '3.8'
services:
  saiki:
    build: .
    ports:
      - "3001:3001"
    env_file:
      - .env
    volumes:
      - saiki_data:/app/.saiki
    restart: unless-stopped

volumes:
  saiki_data:
```

Run with:
```bash
docker compose up --build
```

## Production Setup

### Environment Variables

```bash
# Production environment variables
NODE_ENV=production
PORT=3001
CONFIG_FILE=/app/configuration/saiki.yml
```

### Persistent Storage

Mount a volume for persistent data:

```bash
docker run -d \
  --name saiki-server \
  --env-file .env \
  -p 3001:3001 \
  -v saiki_data:/app/.saiki \
  saiki
```

### Resource Limits

Set memory and CPU limits:

```bash
docker run -d \
  --name saiki-server \
  --env-file .env \
  --memory=1g \
  --cpus=1 \
  -p 3001:3001 \
  saiki
```

## API Endpoints

Once deployed, your Saiki server provides:

### REST API
- `POST /api/message` - Send async message
- `POST /api/message-sync` - Send sync message  
- `POST /api/reset` - Reset conversation
- `GET /api/mcp/servers` - List MCP servers
- `GET /health` - Health check

### WebSocket
- Real-time events and streaming responses
- Connect to `ws://localhost:3001/ws`


## Next Steps

- **[TypeScript SDK Guide](./typescript-sdk)** - Integrate Saiki into your applications
- **[API Reference](/api)** - Complete API documentation

For more detailed information on configuring agents, refer to the [Saiki Configuration Guide](./configuring-saiki/overview).

### Building with the TypeScript SDK

For custom builds and advanced integration, you can use the [TypeScript SDK Guide](./typescript-sdk) to bundle Saiki into your own applications.

For a complete technical reference, see the [API Reference](/api).

## Hosting Options