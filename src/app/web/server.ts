import express from 'express';
import { logger } from '../../core/logger/logger.js';
import { resolvePackagePath } from '../../core/utils/path.js';
import { initializeApi } from '../api/server.js';
import os from 'os';
import type { AgentCard } from '../../core/config/types.js';
import { SaikiAgent } from '../../core/ai/agent/SaikiAgent.js';

export async function startWebUI(
    agent: SaikiAgent,
    port = 3000,
    agentCardOverride?: Partial<AgentCard>
) {
    const { app, server, wss, webSubscriber } = await initializeApi(agent, agentCardOverride);

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
