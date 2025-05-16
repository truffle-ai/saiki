import express from 'express';
import { logger } from '@core/index.js';
import { resolvePackagePath } from '@core/index.js';
import { initializeApi } from '../api/server.js';
import os from 'os';
import type { AgentCard } from '@core/index.js';
import { SaikiAgent } from '@core/index.js';

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
