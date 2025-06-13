# Running Saiki with Docker

Simple guide to run Saiki server with Docker.

## Setup

1. **Build the image**
   ```bash
   docker build -t saiki .
   ```

2. **Create .env file**
   Add your API keys (see main README for details)

## Run Saiki Server

```bash
docker run --env-file .env -p 3001:3001 saiki
```

The server will start on port 3001 with:
- ✅ SQLite database connected
- ✅ MCP servers (filesystem & puppeteer) connected
- ✅ REST API + WebSocket endpoints available

## Access Your Server

- **API Endpoints:** http://localhost:3001/api/
- **Health Check:** http://localhost:3001/health
- **MCP Servers:** http://localhost:3001/api/mcp/servers

## Available API Endpoints

- `POST /api/message` - Send async message
- `POST /api/message-sync` - Send sync message
- `POST /api/reset` - Reset conversation
- `GET /api/mcp/servers` - List MCP servers
- WebSocket support for real-time events

## Docker Compose

```bash
docker compose up --build
```

## Background Mode

```bash
docker run -d --env-file .env -p 3001:3001 saiki
```

## Cloud Deployment

```bash
# Build for production
docker build --platform=linux/amd64 -t saiki .

# Push to registry
docker push your-registry.com/saiki
```

That's it! Saiki runs in server mode with REST API + WebSocket on port 3001.