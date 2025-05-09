import express from 'express';
import { MCPClientManager } from '../../src/client/manager.js';
import { ILLMService } from '../../src/ai/llm/services/types.js';
import { logger } from '../../src/utils/logger.js';
import { resolvePackagePath } from '../../src/utils/path.js';
import { EventEmitter } from 'events';
import { initializeApi } from '../../src/api/server.js';
import os from 'os';
import { SaikiAgent } from '../../src/ai/agent/SaikiAgent.js';

export async function initializeWebUI(agent: SaikiAgent, port = 3000) {
    const { app, server, wss, webSubscriber } = await initializeApi(agent);

    const publicPath = resolvePackagePath('public', true);
    logger.info(`Serving static files from: ${publicPath}`);
    app.use(express.static(publicPath));

    server.listen(port, '0.0.0.0', () => {
        const networkInterfaces = os.networkInterfaces();
        let localIp = 'localhost';
        Object.keys(networkInterfaces).forEach((ifaceName) => {
            networkInterfaces[ifaceName]?.forEach((iface) => {
                if (iface.family === 'IPv4' && !iface.internal) {
                    localIp = iface.address;
                    return;
                }
            });
            if (localIp !== 'localhost') return;
        });

        logger.info(
            `WebUI server started successfully. Accessible at: http://localhost:${port} and http://${localIp}:${port} on your local network.`,
            null,
            'green'
        );
    });

    return { server, wss, webSubscriber };
}
