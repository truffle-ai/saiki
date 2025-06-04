import express from 'express';
import type { Express, Request, Response } from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { WebSocketEventSubscriber } from './websocket-subscriber.js';
import { logger } from '@core/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import type { AgentCard } from '@core/index.js';
import { setupA2ARoutes } from './a2a.js';
import { initializeMcpServerEndpoints } from './mcp_handler.js';
import { createAgentCard } from '@core/index.js';
import { SaikiAgent } from '@core/index.js';
import { stringify as yamlStringify } from 'yaml';
import os from 'os';
import { resolvePackagePath } from '@core/index.js';
import {
    LLM_REGISTRY,
    getSupportedModels,
    getSupportedProviders,
    getSupportedRoutersForProvider,
    supportsBaseURL,
    isValidProvider,
    getEffectiveMaxTokens,
} from '@core/ai/llm/registry.js';
import type { LLMConfig } from '@core/index.js';

// TODO: API endpoint names are work in progress and might be refactored/renamed in future versions
export async function initializeApi(agent: SaikiAgent, agentCardOverride?: Partial<AgentCard>) {
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
            const sessionId = req.body.sessionId as string | undefined;
            await agent.run(req.body.message, undefined, sessionId);
            res.status(202).send({ status: 'processing', sessionId });
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
            const sessionId = req.body.sessionId as string | undefined;
            const responseText = await agent.run(req.body.message, imageDataInput, sessionId);
            res.status(200).send({ response: responseText, sessionId });
        } catch (error) {
            logger.error(`Error handling POST /api/message-sync: ${error.message}`);
            res.status(500).send({ error: 'Internal server error' });
        }
    });

    app.post('/api/reset', express.json(), async (req, res) => {
        logger.info('Received request via POST /api/reset');
        try {
            const sessionId = req.body.sessionId as string | undefined;
            await agent.resetConversation(sessionId);
            res.status(200).send({ status: 'reset initiated', sessionId });
        } catch (error) {
            logger.error(`Error handling POST /api/reset: ${error.message}`);
            res.status(500).send({ error: 'Internal server error' });
        }
    });

    // Dynamic MCP server connection endpoint (legacy)
    app.post('/api/connect-server', express.json(), async (req, res) => {
        const { name, config } = req.body;
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).send({ error: 'Missing or invalid server name' });
        }
        if (!config || typeof config !== 'object') {
            return res.status(400).send({ error: 'Missing or invalid server config object' });
        }
        try {
            await agent.connectMcpServer(name, config);
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

    // Add a new MCP server
    app.post('/api/mcp/servers', express.json(), async (req, res) => {
        const { name, config } = req.body;
        if (!name || !config) {
            return res.status(400).json({ error: 'Missing name or config' });
        }
        try {
            await agent.connectMcpServer(name, config);
            res.status(201).json({ status: 'connected', name });
        } catch (error: any) {
            logger.error(`Error connecting MCP server '${name}': ${error.message}`);
            res.status(500).json({ error: `Failed to connect server: ${error.message}` });
        }
    });

    // Add MCP servers listing endpoint
    app.get('/api/mcp/servers', async (req, res) => {
        try {
            const clientsMap = agent.getMcpClients();
            const failedConnections = agent.getMcpFailedConnections();
            const servers: Array<{ id: string; name: string; status: string }> = [];
            for (const name of clientsMap.keys()) {
                servers.push({ id: name, name, status: 'connected' });
            }
            for (const name of Object.keys(failedConnections)) {
                servers.push({ id: name, name, status: 'error' });
            }
            res.status(200).json({ servers });
        } catch (error: any) {
            logger.error(`Error listing MCP servers: ${error.message}`);
            res.status(500).json({ error: 'Failed to list servers' });
        }
    });

    // Add MCP server tools listing endpoint
    app.get('/api/mcp/servers/:serverId/tools', async (req, res) => {
        const serverId = req.params.serverId;
        const client = agent.getMcpClients().get(serverId);
        if (!client) {
            return res.status(404).json({ error: `Server '${serverId}' not found` });
        }
        try {
            const toolsMap = await client.getTools();
            const tools = Object.entries(toolsMap).map(([toolName, toolDef]) => ({
                id: toolName,
                name: toolName,
                description: (toolDef as any).description,
                inputSchema: (toolDef as any).parameters,
            }));
            res.status(200).json({ tools });
        } catch (error: any) {
            logger.error(`Error fetching tools for server '${serverId}': ${error.message}`);
            res.status(500).json({ error: 'Failed to fetch tools for server' });
        }
    });

    // Endpoint to remove/disconnect an MCP server
    app.delete('/api/mcp/servers/:serverId', async (req, res) => {
        const { serverId } = req.params;
        logger.info(`Received request to DELETE /api/mcp/servers/${serverId}`);

        try {
            // Check if server exists before attempting to disconnect
            const clientExists =
                agent.getMcpClients().has(serverId) || agent.getMcpFailedConnections()[serverId];
            if (!clientExists) {
                logger.warn(`Attempted to delete non-existent server: ${serverId}`);
                return res.status(404).json({ error: `Server '${serverId}' not found.` });
            }

            await agent.removeMcpServer(serverId);
            res.status(200).json({ status: 'disconnected', id: serverId });
        } catch (error: any) {
            logger.error(`Error deleting server '${serverId}': ${error.message}`);
            res.status(500).json({
                error: `Failed to delete server '${serverId}': ${error.message}`,
            });
        }
    });

    // Execute an MCP tool via REST wrapper
    app.post(
        '/api/mcp/servers/:serverId/tools/:toolName/execute',
        express.json(),
        async (req, res) => {
            const { serverId, toolName } = req.params;
            // Verify server exists
            const client = agent.getMcpClients().get(serverId);
            if (!client) {
                return res
                    .status(404)
                    .json({ success: false, error: `Server '${serverId}' not found` });
            }
            try {
                // Execute tool through the agent's wrapper method
                const rawResult = await agent.executeMcpTool(toolName, req.body);
                // Return standardized result shape
                res.json({ success: true, data: rawResult });
            } catch (error: any) {
                logger.error(
                    `Error executing tool '${toolName}' on server '${serverId}': ${error.message}`
                );
                res.status(500).json({ success: false, error: error.message });
            }
        }
    );

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
                    const sessionId = data.sessionId as string | undefined;
                    if (imageDataInput) logger.info('Image data included in message.');
                    if (sessionId) logger.info(`Message for session: ${sessionId}`);
                    await agent.run(data.content, imageDataInput, sessionId);
                } else if (data.type === 'reset') {
                    const sessionId = data.sessionId as string | undefined;
                    logger.info(
                        `Processing reset command from WebSocket${sessionId ? ` for session: ${sessionId}` : ''}.`
                    );
                    await agent.resetConversation(sessionId);
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
    // TODO: This is a temporary solution to allow for agentCard overrides. Implement a more robust solution in the future.
    const overrides = agentCardOverride ?? {};
    const baseApiUrl = process.env.SAIKI_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const agentCardData = createAgentCard(
        {
            defaultName: overrides.name ?? 'saiki',
            defaultVersion: overrides.version ?? '1.0.0',
            defaultBaseUrl: baseApiUrl,
            webSubscriber,
        },
        overrides
    );
    const agentName = agentCardData.name;
    const agentVersion = agentCardData.version;

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
        agent,
        agentName,
        agentVersion,
        agentCardData, // Pass the agent card data for the MCP resource
        mcpTransport
    );

    // Configuration export endpoint
    app.get('/api/config.yaml', async (req, res) => {
        try {
            const sessionId = req.query.sessionId as string | undefined;
            const config = agent.getEffectiveConfig(sessionId);

            // Export config as YAML, masking sensitive data
            const maskedConfig = {
                ...config,
                llm: {
                    ...config.llm,
                    apiKey: config.llm.apiKey ? '[REDACTED]' : undefined,
                },
                mcpServers: Object.fromEntries(
                    Object.entries(config.mcpServers).map(([name, serverConfig]: [string, any]) => [
                        name,
                        {
                            ...serverConfig,
                            env: serverConfig.env
                                ? Object.fromEntries(
                                      Object.entries(serverConfig.env).map(([key, value]) => [
                                          key,
                                          value && typeof value === 'string' && value.length > 0
                                              ? '[REDACTED]'
                                              : value,
                                      ])
                                  )
                                : undefined,
                        },
                    ])
                ),
            };

            const yamlStr = yamlStringify(maskedConfig);
            res.set('Content-Type', 'application/x-yaml');
            res.send(yamlStr);
        } catch (error: any) {
            logger.error(`Error exporting config: ${error.message}`);
            res.status(500).json({ error: 'Failed to export configuration' });
        }
    });

    // Get current LLM configuration
    app.get('/api/llm/current', async (req, res) => {
        try {
            const currentConfig = agent.getCurrentLLMConfig();
            res.json({ config: currentConfig });
        } catch (error: any) {
            logger.error(`Error getting current LLM config: ${error.message}`);
            res.status(500).json({ error: 'Failed to get current LLM configuration' });
        }
    });

    // Get available LLM providers and models
    app.get('/api/llm/providers', async (req, res) => {
        try {
            // Build providers object from the LLM registry
            const providers: Record<
                string,
                {
                    name: string;
                    models: string[];
                    supportedRouters: string[];
                    supportsBaseURL: boolean;
                }
            > = {};

            for (const [providerKey, providerInfo] of Object.entries(LLM_REGISTRY)) {
                // Convert provider key to display name
                const displayName = providerKey.charAt(0).toUpperCase() + providerKey.slice(1);

                providers[providerKey] = {
                    name: displayName,
                    models: providerInfo.models.map((model) => model.name),
                    supportedRouters: getSupportedRoutersForProvider(providerKey),
                    supportsBaseURL: supportsBaseURL(providerKey),
                };
            }

            res.json({ providers });
        } catch (error: any) {
            logger.error(`Error getting LLM providers: ${error.message}`);
            res.status(500).json({ error: 'Failed to get LLM providers' });
        }
    });

    // Switch LLM configuration
    app.post('/api/llm/switch', express.json(), async (req, res) => {
        try {
            // Thin wrapper - build LLMConfig object from request body
            const { provider, model, apiKey, router, baseURL, sessionId, ...otherFields } =
                req.body;

            // Build the LLMConfig object from the request parameters
            const llmConfig: Partial<LLMConfig> = {};
            if (provider !== undefined) llmConfig.provider = provider;
            if (model !== undefined) llmConfig.model = model;
            if (apiKey !== undefined) llmConfig.apiKey = apiKey;
            if (router !== undefined) llmConfig.router = router;
            if (baseURL !== undefined) llmConfig.baseURL = baseURL;

            // Include any other LLMConfig fields that might be in the request
            Object.assign(llmConfig, otherFields);

            const result = await agent.switchLLM(llmConfig, sessionId);
            res.json(result);
        } catch (error: any) {
            logger.error(`Error switching LLM: ${error.message}`);
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    });

    // Session Management APIs

    // List all active sessions
    app.get('/api/sessions', async (req, res) => {
        try {
            const sessionIds = await agent.listSessions();
            const sessions = await Promise.all(
                sessionIds.map(async (id) => {
                    const metadata = await agent.getSessionMetadata(id);
                    return {
                        id,
                        createdAt: metadata?.createdAt || null,
                        lastActivity: metadata?.lastActivity || null,
                        messageCount: metadata?.messageCount || 0,
                    };
                })
            );
            res.json({ sessions });
        } catch (error) {
            logger.error(`Error listing sessions: ${error.message}`);
            res.status(500).json({ error: 'Failed to list sessions' });
        }
    });

    // Create a new session
    app.post('/api/sessions', express.json(), async (req, res) => {
        try {
            const { sessionId } = req.body;
            const session = await agent.createSession(sessionId);
            const metadata = await agent.getSessionMetadata(session.id);
            res.status(201).json({
                session: {
                    id: session.id,
                    createdAt: metadata?.createdAt || null,
                    lastActivity: metadata?.lastActivity || null,
                    messageCount: metadata?.messageCount || 0,
                },
            });
        } catch (error) {
            logger.error(`Error creating session: ${error.message}`);
            res.status(500).json({ error: 'Failed to create session' });
        }
    });

    // Get session details
    app.get('/api/sessions/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const session = await agent.getSession(sessionId);
            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }

            const metadata = await agent.getSessionMetadata(sessionId);
            const history = await agent.getSessionHistory(sessionId);

            res.json({
                session: {
                    id: sessionId,
                    createdAt: metadata?.createdAt || null,
                    lastActivity: metadata?.lastActivity || null,
                    messageCount: metadata?.messageCount || 0,
                    history: history.length,
                },
            });
        } catch (error) {
            logger.error(`Error getting session ${req.params.sessionId}: ${error.message}`);
            res.status(500).json({ error: 'Failed to get session details' });
        }
    });

    // Get session conversation history
    app.get('/api/sessions/:sessionId/history', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const session = await agent.getSession(sessionId);
            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }

            const history = await agent.getSessionHistory(sessionId);
            res.json({ history });
        } catch (error) {
            logger.error(
                `Error getting session history for ${req.params.sessionId}: ${error.message}`
            );
            res.status(500).json({ error: 'Failed to get session history' });
        }
    });

    // Delete a session
    app.delete('/api/sessions/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const session = await agent.getSession(sessionId);
            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }

            await agent.endSession(sessionId);
            res.json({ status: 'deleted', sessionId });
        } catch (error) {
            logger.error(`Error deleting session ${req.params.sessionId}: ${error.message}`);
            res.status(500).json({ error: 'Failed to delete session' });
        }
    });

    // Reset session conversation
    app.post('/api/sessions/:sessionId/reset', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const session = await agent.getSession(sessionId);
            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }

            await agent.resetConversation(sessionId);
            res.json({ status: 'reset', sessionId });
        } catch (error) {
            logger.error(`Error resetting session ${req.params.sessionId}: ${error.message}`);
            res.status(500).json({ error: 'Failed to reset session' });
        }
    });

    return { app, server, wss, webSubscriber };
}

/** Serves the legacy web UI on the express app. will be deprecated soon */
export function startLegacyWebUI(app: Express) {
    const publicPath = resolvePackagePath('public', true);
    logger.info(`Serving static files from: ${publicPath}`);
    app.use(express.static(publicPath));
}

// TODO: Refactor this when we get rid of the legacy web UI
export async function startApiAndLegacyWebUIServer(
    agent: SaikiAgent,
    port = 3000,
    serveLegacyWebUI?: boolean,
    agentCardOverride?: Partial<AgentCard>
) {
    const { app, server, wss, webSubscriber } = await initializeApi(agent, agentCardOverride);

    // Serve legacy static UI from public/, for backward compatibility
    if (serveLegacyWebUI) {
        startLegacyWebUI(app);
    }

    // Next.js front-end handles static assets; only mount API and WebSocket routes here.
    server.listen(port, '0.0.0.0', () => {
        const networkInterfaces = os.networkInterfaces();
        let localIp = 'localhost';
        Object.values(networkInterfaces).forEach((ifaceList) => {
            ifaceList?.forEach((iface) => {
                if (iface.family === 'IPv4' && !iface.internal) {
                    localIp = iface.address;
                }
            });
        });

        if (serveLegacyWebUI) {
            logger.info(
                `API server & Legacy WebUI started successfully. Accessible at: http://localhost:${port} and http://${localIp}:${port} on your local network.`,
                null,
                'green'
            );
            logger.warn(
                `Legacy WebUI at http://localhost:${port} will be deprecated in a future release. Use the new Next.js WebUI for a better experience.`,
                null,
                'yellow'
            );
        } else {
            logger.info(
                `API server started successfully. Accessible at: http://localhost:${port} and http://${localIp}:${port} on your local network.`,
                null,
                'green'
            );
        }
    });

    return { server, wss, webSubscriber };
}
