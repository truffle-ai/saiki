import { MCPClientWrapper } from './mcp-client.js';
import { ServerConfigs } from '../config/types.js';
import { logger } from '../utils/logger.js';
import { ToolProvider } from './types.js';

export class ClientManager {
    private clients: Map<string, ToolProvider> = new Map();
    private connectionErrors: { [key: string]: string } = {};

    /**
     * Register a client that provides tools
     * @param name Unique name for the client
     * @param client The tool provider client
     */
    registerClient(name: string, client: ToolProvider): void {
        if (this.clients.has(name)) {
            logger.warn(`Client '${name}' already registered. Overwriting.`);
        }
        this.clients.set(name, client);
        logger.info(`Registered client: ${name}`);
    }

    /**
     * Initialize clients from server configurations
     * @param serverConfigs Server configurations
     * @param connectionMode Whether to enforce all connections must succeed
     * @returns Promise resolving when initialization is complete
     */
    async initializeFromConfig(
        serverConfigs: ServerConfigs,
        connectionMode: 'strict' | 'lenient' = 'lenient'
    ): Promise<void> {
        const successfulConnections: string[] = [];

        for (const [name, config] of Object.entries(serverConfigs)) {
            const client = new MCPClientWrapper();
            try {
                await client.connect(config, name);
                this.registerClient(name, client);
                successfulConnections.push(name);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                this.connectionErrors[name] = errorMsg;
                logger.error(`Failed to connect to server '${name}': ${errorMsg}`);
            }
        }

        // Check if we've met the requirements for connection mode
        const requiredSuccessfulConnections = 
            connectionMode === 'strict' ? Object.keys(serverConfigs).length : Math.min(1, Object.keys(serverConfigs).length);

        if (successfulConnections.length < requiredSuccessfulConnections) {
            throw new Error(
                connectionMode === 'strict'
                    ? 'Failed to connect to all required servers'
                    : 'Failed to connect to at least one server'
            );
        }
    }

    /**
     * Get all registered clients
     * @returns Map of client names to client instances
     */
    getClients(): Map<string, ToolProvider> {
        return this.clients;
    }

    /**
     * Get the errors from failed connections
     * @returns Map of server names to error messages
     */
    getFailedConnections(): { [key: string]: string } {
        return this.connectionErrors;
    }

    /**
     * Disconnect all clients
     */
    disconnectAll(): void {
        for (const [name, client] of this.clients.entries()) {
            if (client.disconnect) {
                try {
                    client.disconnect();
                    logger.info(`Disconnected client: ${name}`);
                } catch (error) {
                    logger.error(`Failed to disconnect client '${name}': ${error}`);
                }
            }
        }
        this.clients.clear();
        this.connectionErrors = {};
    }
}
