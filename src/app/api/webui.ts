import express from 'express';
import { logger } from '../../core/utils/logger.js';
import { initializeApi } from './server.js';
import os from 'os';
import type { AgentCard } from '../../core/config/types.js';
import { SaikiAgent } from '../../core/ai/agent/SaikiAgent.js';

export async function startServer(
    agent: SaikiAgent,
    port = 3000,
    agentCardOverride?: Partial<AgentCard>
) {
    const { app, server, wss, webSubscriber } = await initializeApi(agent, agentCardOverride);

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

        logger.info(
            `API server started. Accessible at: http://localhost:${port} and http://${localIp}:${port}`,
            null,
            'green'
        );
    });

    return { server, wss, webSubscriber };
}
