import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws'; // Import WebSocket type
import path from 'path';
import { WebUISubscriber } from './web-subscriber.js';
import { ClientManager } from '../../src/client/manager.js';
import { ILLMService } from '../../src/ai/llm/services/types.js';
import { AgentEventManager } from '../../src/ai/llm/events/event-manager.js';
import { logger } from '../../src/utils/logger.js'; // Import logger

export async function initializeWebUI(
  clientManager: ClientManager,
  llmService: ILLMService,
  port = 3000
) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const webSubscriber = new WebUISubscriber();
  
  // Set up event management - register the WebUISubscriber
  const eventManager = new AgentEventManager(llmService);
  eventManager.registerSubscriber(webSubscriber);
  logger.info('WebUI Event Manager and Subscriber initialized.');
  
  // Serve static files from the root /public directory
  const publicPath = path.resolve(process.cwd(), 'public');
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
           logger.info(`Processing message from WebSocket: ${data.content.substring(0, 50)}...`);
           // Let the LLM process the task, events will flow back via webSubscriber
           await llmService.completeTask(data.content);
        } else if (data.type === 'reset') {
           logger.info('Processing reset command from WebSocket.');
           llmService.resetConversation(); // Trigger reset event
        } else {
           logger.warn(`Received unknown WebSocket message type: ${data.type}`);
           ws.send(JSON.stringify({ event: 'error', data: { message: 'Unknown message type' } }));
        }
      } catch (error) {
        logger.error(`Error processing WebSocket message: ${error.message}`);
        // Inform the client about the error
        ws.send(JSON.stringify({ event: 'error', data: { message: 'Failed to process message' } }));
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
  return { server, wss, eventManager, webSubscriber };
} 