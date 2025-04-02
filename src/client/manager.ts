import { MCPClient } from './mcp-client.js';
import { ServerConfigs } from '../config/types.js';
import { logger } from '../utils/logger.js';
import { ToolProvider } from './types.js';
import { McpTool } from '../ai/types.js';

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
     * Get all tools from all registered clients
     * @returns Array of all available tools
     */
    async getAllTools(): Promise<McpTool[]> {
        const tools: McpTool[] = [];
        for (const [name, client] of this.clients.entries()) {
            try {
                const clientTools = await client.getTools();
                tools.push(...clientTools.map(tool => ({
                    ...tool,
                    description: tool.description || `Tool from client '${name}'`,
                })));
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                logger.error(`Failed to get tools from client '${name}': ${errorMsg}`);
                this.connectionErrors[name] = errorMsg;
            }
        }
        return tools;
    }

    /**
     * Call a tool by name with the given arguments
     * The first client that provides the tool will be used
     * @param toolName Name of the tool to call
     * @param args Arguments to pass to the tool
     * @returns Result of the tool execution
     */
    async callTool(toolName: string, args: any): Promise<any> {
        for (const [name, client] of this.clients.entries()) {
            try {
                const tools = await client.getTools();
                if (tools.some(tool => tool.name === toolName)) {
                    try {
                        return await client.callTool(toolName, args);
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        logger.error(`Tool '${toolName}' call failed in client '${name}': ${errorMsg}`);
                        return `Error executing tool '${toolName}': ${errorMsg}`;
                    }
                }
            } catch (error) {
                logger.error(`Failed to check tools in client '${name}'`);
            }
        }
        return `Tool '${toolName}' not found in any registered client.`;
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
            const client = new MCPClient();
            try {
                await client.connectViaStdio(config.command, config.args, config.env, name);
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
            connectionMode === 'strict' ? Object.keys(serverConfigs).length : 1;

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
