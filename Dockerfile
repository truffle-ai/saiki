################################################################################
# Build stage - includes dev dependencies
ARG NODE_VERSION=20.18.1

################################################################################
# Build stage - includes dev dependencies
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (dev + prod) for building
RUN npm install --include=dev --ignore-scripts

# Copy source and build
COPY . .
RUN npm run build && npm prune --production

################################################################################
# Production stage - minimal runtime
FROM node:${NODE_VERSION}-alpine AS production

# Install Chromium for puppeteer server
RUN apk add --no-cache \
    chromium \
    harfbuzz \
    nss \
    freetype \
    ttf-freefont

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S saiki && adduser -S saiki -u 1001

# Copy only production files
COPY --from=builder --chown=saiki:saiki /app/dist ./dist
COPY --from=builder --chown=saiki:saiki /app/node_modules ./node_modules
COPY --from=builder --chown=saiki:saiki /app/package.json ./
COPY --from=builder --chown=saiki:saiki /app/configuration ./configuration

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV CONFIG_FILE=/app/configuration/saiki.yml

# Switch to non-root user
USER saiki

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.request({host:'localhost',port:process.env.PORT||3000,path:'/health'}, (res) => process.exit(res.statusCode === 200 ? 0 : 1)); req.on('error', () => process.exit(1)); req.end();"

# Single port for deployment platform
EXPOSE $PORT

# Server mode: REST APIs + WebSocket on single port
CMD node dist/src/app/index.js --mode server --web-port $PORT --config-file $CONFIG_FILE 