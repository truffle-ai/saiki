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
docker run --env-file .env -p 3000:3000 saiki
```

Access the API at: http://localhost:3000

## Custom Port

```bash
docker run --env-file .env -p 8080:8080 -e PORT=8080 saiki
```

## Docker Compose

```bash
docker compose up --build
```

## Cloud Deployment

```bash
# Build for production
docker build --platform=linux/amd64 -t saiki .

# Push to registry
docker push your-registry.com/saiki
```

That's it. Saiki runs in server mode with REST API + WebSocket on the specified port.