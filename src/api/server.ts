import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { WebSocketEventSubscriber } from './websocket-subscriber.js';
import { MCPClientManager } from '../client/manager.js';
import { ILLMService } from '../ai/llm/services/types.js';
import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import type { AgentCard } from '../config/types.js';
import { setupA2ARoutes } from './a2a.js';
import { initializeMcpServerEndpoints } from './mcp_handler.js';
import { AgentCardOverrideSchema } from '../config/schemas.js';
import type { AgentCardOverride } from '../config/schemas.js';
import { ZodError } from 'zod';

// TODO: API endpoint names are work in progress and might be refactored/renamed in future versions
export async function initializeApi(
    clientManager: MCPClientManager,
    llmService: ILLMService,
    agentEventBus: EventEmitter,
    agentCardOverride?: Partial<AgentCard>
) {
    const app = express();
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

    // set up event broadcasting over WebSocket
    const webSubscriber = new WebSocketEventSubscriber(wss);
    logger.info('Setting up API event subscriptions...');
    webSubscriber.subscribe(agentEventBus);

    // HTTP endpoints
    app.post('/api/message', express.json(), async (req, res) => {
        logger.info('Received message via POST /api/message');
        if (!req.body || !req.body.message) {
            return res.status(400).send({ error: 'Missing message content' });
        }
        try {
            llmService.completeTask(req.body.message);
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
            const responseText = await llmService.completeTask(req.body.message, imageDataInput);
            res.status(200).send({ response: responseText });
        } catch (error) {
            logger.error(`Error handling POST /api/message-sync: ${error.message}`);
            res.status(500).send({ error: 'Internal server error' });
        }
    });

    app.post('/api/reset', express.json(), async (req, res) => {
        logger.info('Received request via POST /api/reset');
        try {
            llmService.resetConversation();
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
            await clientManager.connectClient(name, config);
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
                    await llmService.completeTask(data.content, imageDataInput);
                } else if (data.type === 'reset') {
                    logger.info('Processing reset command from WebSocket.');
                    llmService.resetConversation();
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

    // Apply agentCard overrides (if any)
    const rawOverride = agentCardOverride ?? {};
    let cardConfig: AgentCardOverride;
    try {
        cardConfig = AgentCardOverrideSchema.parse(rawOverride);
    } catch (err: unknown) {
        if (err instanceof ZodError) {
            logger.error('Invalid agentCard override:');
            err.errors.forEach((e) => {
                const path = e.path.join('.') || '<root>';
                logger.error(`- ${path}: ${e.message}`);
            });
        } else {
            logger.error('Invalid agentCard override:', err);
        }
        process.exit(1);
    }

    // Common agent and MCP server information
    const agentName = cardConfig.name ?? 'saiki';
    const agentVersion = cardConfig.version ?? '1.0.0';

    // Construct Agent Card data (used by both A2A and MCP setup)
    const baseApiUrl = process.env.SAIKI_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    // Define the fixed tool details (must match what's used in mcp_handler.ts)
    const mcpToolName = 'chat';
    const mcpToolDescription =
        'Allows you to chat with the an AI agent. Send a message to interact.';

    const agentCardData: AgentCard = {
        name: agentName,
        description:
            cardConfig.description ??
            'Alfred is an AI assistant capable of chat and task delegation, accessible via multiple protocols.',
        url: cardConfig.url ?? `${baseApiUrl}/mcp`, // Primary MCP endpoint
        version: agentVersion,
        capabilities: {
            streaming: cardConfig.capabilities?.streaming ?? true,
            pushNotifications: cardConfig.capabilities?.pushNotifications ?? !!webSubscriber,
            stateTransitionHistory: cardConfig.capabilities?.stateTransitionHistory ?? false,
        },
        authentication: {
            schemes: cardConfig.authentication?.schemes ?? [],
            credentials: cardConfig.authentication?.credentials,
        },
        defaultInputModes: cardConfig.defaultInputModes ?? ['application/json', 'text/plain'],
        defaultOutputModes: cardConfig.defaultOutputModes ?? [
            'application/json',
            'text/event-stream',
            'text/plain',
        ],
        skills: (cardConfig.skills ?? []) as AgentCard['skills'], // Skills will be populated based on registered MCP tools for the A2A card
    };

    // Populate skills for AgentCard from the fixed MCP tool details
    agentCardData.skills.push({
        id: mcpToolName, // Skill ID matches MCP tool name
        name: mcpToolName, // Human-readable name
        description: mcpToolDescription,
        tags: ['chat', 'AI', 'assistant', 'mcp', 'natural language'],
        examples: [
            `Send a JSON-RPC request to /mcp with method: "${mcpToolName}" and params: {"message":"Your query..."}`,
            'Alternatively, use a compatible MCP client library.',
        ],
        inputModes: ['text/plain'], // Abstract input mode for the skill
        outputModes: ['text/plain'], // Abstract output mode for the skill
    });

    // Setup A2A routes
    setupA2ARoutes(app, agentCardData);

    // --- Initialize and Setup MCP Server and Endpoints ---
    const mcpTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: randomUUID,
        enableJsonResponse: true,
    });

    // TODO: Think of a better way to handle the MCP implementation
    await initializeMcpServerEndpoints(
        app,
        llmService,
        agentName,
        agentVersion,
        agentCardData, // Pass the agent card data for the MCP resource
        mcpTransport
    );

    return { app, server, wss, webSubscriber };
}
