import express from 'express';
import { logger } from '../../core/utils/logger.js';
import { initializeApi } from './server.js';
import os from 'os';
import type { AgentCard } from '../../core/config/types.js';
import { SaikiAgent } from '../../core/ai/agent/SaikiAgent.js';

/**
 * Starts the API server with the provided agent and optional configuration overrides.
 *
 * Initializes API and WebSocket routes, binds the server to all network interfaces on the specified port, and logs accessible URLs.
 *
 * @param agent - The agent instance to be used by the API server.
 * @param port - The port to listen on. Defaults to 3000.
 * @param agentCardOverride - Optional partial override for the agent's card configuration.
 * @returns An object containing the HTTP server, WebSocket server, and web subscriber instances.
 */
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
