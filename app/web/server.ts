import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WebUISubscriber } from './web-subscriber.js';
import { ClientManager } from '../../src/client/manager.js';
import { ILLMService } from '../../src/ai/llm/services/types.js';
import { logger } from '../../src/utils/logger.js';
import { resolvePackagePath } from '../../src/utils/path.js';
import { EventEmitter } from 'events';

export async function initializeWebUI(
    clientManager: ClientManager,
    llmService: ILLMService,
    agentEventBus: EventEmitter,
    port = 3000
) {
    const app = express();
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

    // Set up event management
    const webSubscriber = new WebUISubscriber();
    logger.info('Setting up WebUI event subscriptions...');
    agentEventBus.on('llmservice:thinking', webSubscriber.onThinking.bind(webSubscriber));
    agentEventBus.on('llmservice:chunk', webSubscriber.onChunk.bind(webSubscriber));
    agentEventBus.on('llmservice:toolCall', webSubscriber.onToolCall.bind(webSubscriber));
    agentEventBus.on('llmservice:toolResult', webSubscriber.onToolResult.bind(webSubscriber));
    agentEventBus.on('llmservice:response', webSubscriber.onResponse.bind(webSubscriber));
    agentEventBus.on('llmservice:error', webSubscriber.onError.bind(webSubscriber));
    agentEventBus.on('llmservice:conversationReset', webSubscriber.onConversationReset.bind(webSubscriber));

    // Serve static files from the package's public directory using the helper
    const publicPath = resolvePackagePath('public', true);
    logger.info(`Serving static files from: ${publicPath}`);
    app.use(express.static(publicPath));

    // API endpoint to send a message to the LLM
    // Note: Using WebSocket communication is generally preferred for this type of app
    // But providing a simple HTTP endpoint can be useful too.
    app.post('/api/message', express.json(), async (req, res) => {
        logger.info('Received message via POST /api/message');
        if (!req.body || !req.body.message) {
            return res.status(400).send({ error: 'Missing message content' });
        }
        try {
            // No need to await here, the result will be streamed via WebSocket
            llmService.completeTask(req.body.message);
            res.status(202).send({ status: 'processing' }); // 202 Accepted
        } catch (error) {
            logger.error(`Error handling POST /api/message: ${error.message}`);
            res.status(500).send({ error: 'Internal server error' });
        }
    });

    // API endpoint to reset conversation
    app.post('/api/reset', express.json(), async (req, res) => {
        logger.info('Received request via POST /api/reset');
        try {
            llmService.resetConversation(); // This will trigger onConversationReset event
            res.status(200).send({ status: 'reset initiated' });
        } catch (error) {
            logger.error(`Error handling POST /api/reset: ${error.message}`);
            res.status(500).send({ error: 'Internal server error' });
        }
    });

    app.post('/api/connect-server', express.json(), async (req, res) => {
        logger.info('Received request via POST /api/connect-server');
        const { name, config } = req.body;

        // Basic validation
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).send({ error: 'Missing or invalid server name' });
        }
        if (!config || typeof config !== 'object') {
            return res.status(400).send({ error: 'Missing or invalid server config object' });
        }

        try {
            await clientManager.connectClient(name, config);
            logger.info(`Successfully connected to new server '${name}' via API request.`);
            res.status(200).send({ status: 'connected', name: name });
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error during connection';
            logger.error(`Error handling POST /api/connect-server for '${name}': ${errorMessage}`);
            res.status(500).send({
                error: `Failed to connect to server '${name}': ${errorMessage}`,
            });
        }
    });

    // WebSocket connection handling
    wss.on('connection', (ws: WebSocket) => {
        logger.info('WebSocket client connected.');
        webSubscriber.addConnection(ws);

        ws.on('message', async (messageBuffer) => {
            const messageString = messageBuffer.toString();
            logger.debug(`WebSocket received message: ${messageString}`);
            try {
                const data = JSON.parse(messageString);

                if (data.type === 'message' && data.content) {
                    logger.info(
                        `Processing message from WebSocket: ${data.content.substring(0, 50)}...`
                    );
                    // Extract potential image data
                    const imageDataInput = data.imageData ? { 
                        image: data.imageData.base64, // Use the base64 string directly
                        mimeType: data.imageData.mimeType 
                    } : undefined;

                    if (imageDataInput) {
                        logger.info('Image data included in message.');
                    }
                    
                    // Let the LLM process the task with both text and potentially image data
                    await llmService.completeTask(data.content, imageDataInput);
                } else if (data.type === 'reset') {
                    logger.info('Processing reset command from WebSocket.');
                    llmService.resetConversation(); // Trigger reset event
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
                // Inform the client about the error
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
            // The subscriber handles removal on 'close' event
        });

        ws.on('error', (error) => {
            logger.error(`WebSocket error: ${error.message}`);
        });
    });

    // Start the HTTP server
    server.listen(port, () => {
        logger.info(`WebUI server started successfully on http://localhost:${port}`, null, 'green');
    });

    // Return references that might be useful (e.g., for testing or graceful shutdown)
    return { server, wss, webSubscriber };
}
