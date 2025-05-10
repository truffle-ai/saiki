import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WebSocketEventSubscriber } from './websocket-subscriber.js';
import { MCPClientManager } from '../client/manager.js';
import { ILLMService } from '../ai/llm/services/types.js';
import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { SaikiAgent } from '../ai/agent/SaikiAgent.js';

// TODO: API endpoint names are work in progress and might be refactored/renamed in future versions
export async function initializeApi(agent: SaikiAgent) {
    const app = express();
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

    // set up event broadcasting over WebSocket
    const webSubscriber = new WebSocketEventSubscriber(wss);
    logger.info('Setting up API event subscriptions...');
    webSubscriber.subscribe(agent.agentEventBus);

    // HTTP endpoints
    app.post('/api/message', express.json(), async (req, res) => {
        logger.info('Received message via POST /api/message');
        if (!req.body || !req.body.message) {
            return res.status(400).send({ error: 'Missing message content' });
        }
        try {
            agent.run(req.body.message);
            res.status(202).send({ status: 'processing' });
        } catch (error) {
            logger.error(`Error handling POST /api/message: ${error.message}`);
            res.status(500).send({ error: 'Internal server error' });
        }
    });

    // Synchronous endpoint: await the full AI response and return it in one go
    app.post('/api/message-sync', express.json(), async (req, res) => {
        logger.info('Received message via POST /api/message-sync');
        if (!req.body || !req.body.message) {
            return res.status(400).send({ error: 'Missing message content' });
        }
        // Extract optional image data
        const imageDataInput = req.body.imageData
            ? { image: req.body.imageData.base64, mimeType: req.body.imageData.mimeType }
            : undefined;
        try {
            const responseText = await agent.run(req.body.message, imageDataInput);
            res.status(200).send({ response: responseText });
        } catch (error) {
            logger.error(`Error handling POST /api/message-sync: ${error.message}`);
            res.status(500).send({ error: 'Internal server error' });
        }
    });

    app.post('/api/reset', express.json(), async (req, res) => {
        logger.info('Received request via POST /api/reset');
        try {
            agent.resetConversation();
            res.status(200).send({ status: 'reset initiated' });
        } catch (error) {
            logger.error(`Error handling POST /api/reset: ${error.message}`);
            res.status(500).send({ error: 'Internal server error' });
        }
    });

    app.post('/api/connect-server', express.json(), async (req, res) => {
        logger.info('Received request via POST /api/connect-server');
        const { name, config } = req.body;
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).send({ error: 'Missing or invalid server name' });
        }
        if (!config || typeof config !== 'object') {
            return res.status(400).send({ error: 'Missing or invalid server config object' });
        }
        try {
            await agent.clientManager.connectClient(name, config);
            logger.info(`Successfully connected to new server '${name}' via API request.`);
            res.status(200).send({ status: 'connected', name });
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error during connection';
            logger.error(`Error handling POST /api/connect-server for '${name}': ${errorMessage}`);
            res.status(500).send({
                error: `Failed to connect to server '${name}': ${errorMessage}`,
            });
        }
    });

    // WebSocket handling
    // handle inbound client messages over WebSocket
    wss.on('connection', (ws: WebSocket) => {
        logger.info('WebSocket client connected.');

        ws.on('message', async (messageBuffer) => {
            const messageString = messageBuffer.toString();
            logger.debug(`WebSocket received message: ${messageString}`);
            try {
                const data = JSON.parse(messageString);
                if (data.type === 'message' && data.content) {
                    logger.info(
                        `Processing message from WebSocket: ${data.content.substring(0, 50)}...`
                    );
                    const imageDataInput = data.imageData
                        ? { image: data.imageData.base64, mimeType: data.imageData.mimeType }
                        : undefined;
                    if (imageDataInput) logger.info('Image data included in message.');
                    await agent.run(data.content, imageDataInput);
                } else if (data.type === 'reset') {
                    logger.info('Processing reset command from WebSocket.');
                    agent.resetConversation();
                } else {
                    logger.warn(`Received unknown WebSocket message type: ${data.type}`);
                    ws.send(
                        JSON.stringify({
                            event: 'error',
                            data: { message: 'Unknown message type' },
                        })
                    );
                }
            } catch (error) {
                logger.error(`Error processing WebSocket message: ${error.message}`);
                ws.send(
                    JSON.stringify({
                        event: 'error',
                        data: { message: 'Failed to process message' },
                    })
                );
            }
        });
        ws.on('close', () => {
            logger.info('WebSocket client disconnected.');
        });
        ws.on('error', (error) => {
            logger.error(`WebSocket error: ${error.message}`);
        });
    });

    // --- Expose Saiki via MCP protocol on /mcp (Experimental) ---
    const mcpTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: randomUUID,
        enableJsonResponse: true,
    });
    const mcpServer = new McpServer({ name: 'saiki', version: '1.0.0' });
    // Register a single 'chat' tool
    // TODO: Make a more formal way to define this via config file
    mcpServer.tool(
        'chat',
        'Hey! I am Saiki as an MCP server, a remote AI agent that can chat with you or you can use to delegate tasks.',
        { message: z.string() },
        async ({ message }) => {
            const text = await agent.run(message);
            return { content: [{ type: 'text', text }] };
        }
    );
    // Initialize the MCP protocol on this transport before mounting endpoints
    logger.info(`Initializing MCP protocol server...`);
    await mcpServer.connect(mcpTransport);
    logger.info(`✅ MCP server protocol initialized on /mcp`);
    // Mount /mcp for JSON-RPC and SSE handling (so baseUrl is /mcp)
    app.post('/mcp', express.json(), (req, res) => {
        mcpTransport
            .handleRequest(req, res, req.body)
            .catch((err) => logger.error(`MCP POST error: ${JSON.stringify(err, null, 2)}`));
    });
    app.get('/mcp', (req, res) => {
        mcpTransport
            .handleRequest(req, res)
            .catch((err) => logger.error(`MCP GET error: ${JSON.stringify(err, null, 2)}`));
    });

    return { app, server, wss, webSubscriber };
}
