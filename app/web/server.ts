import express from 'express';
import { MCPClientManager } from '../../src/client/manager.js';
import { ILLMService } from '../../src/ai/llm/services/types.js';
import { logger } from '../../src/utils/logger.js';
import { resolvePackagePath } from '../../src/utils/path.js';
import { EventEmitter } from 'events';
import { initializeApi } from '../../src/api/server.js';

export async function initializeWebUI(
    clientManager: MCPClientManager,
    llmService: ILLMService,
    agentEventBus: EventEmitter,
    port = 3000
) {
    const { app, server, wss, webSubscriber } = initializeApi(clientManager, llmService, agentEventBus);

    const publicPath = resolvePackagePath('public', true);
    logger.info(`Serving static files from: ${publicPath}`);
    app.use(express.static(publicPath));

    server.listen(port, () => {
        logger.info(`WebUI server started successfully on http://localhost:${port}`, null, 'green');
    });

    return { server, wss, webSubscriber };
}
