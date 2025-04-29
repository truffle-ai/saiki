import { MCPClient } from './mcp-client.js';
import { ServerConfigs, McpServerConfig } from '../config/types.js';
import { logger } from '../utils/logger.js';
import { ToolProvider } from './types.js';
import { ToolConfirmationProvider } from './tool-confirmation/types.js';
import { CLIConfirmationProvider } from './tool-confirmation/cli-confirmation-provider.js';
import { ToolSet } from '../ai/types.js';

export class ClientManager {
    private clients: Map<string, ToolProvider> = new Map();
    private connectionErrors: { [key: string]: string } = {};
    private toolToClientMap: Map<string, ToolProvider> = new Map();
    private confirmationProvider?: ToolConfirmationProvider;

    constructor(confirmationProvider?: ToolConfirmationProvider) {
        // If a confirmation provider is passed, use it, otherwise use the default implementation
        this.confirmationProvider = confirmationProvider ?? new CLIConfirmationProvider();
    }

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
        delete this.connectionErrors[name];
    }

    /**
     * Get all available tools from all connected clients
     * @returns Promise resolving to a map of tool names to tool definitions
     */
    async getAllTools(): Promise<ToolSet> {
        let allTools: ToolSet = {};

        // Clear existing maps to avoid stale entries
        this.toolToClientMap.clear();

        for (const [serverName, client] of this.clients.entries()) {
            try {
                logger.debug(`Getting tools from ${serverName}`);
                const toolList = await client.getTools();

                // Map each tool to its provider client
                for (const toolName in toolList) {
                    this.toolToClientMap.set(toolName, client);
                }

                allTools = { ...allTools, ...toolList };
                logger.debug(`Successfully got tools from ${serverName}`);
            } catch (error) {
                console.error(`Error getting tools from ${serverName}:`, error);
            }
        }
        logger.debug(`Successfully got all tools from all servers`, null, 'green');
        logger.silly(`All tools: ${JSON.stringify(allTools, null, 2)}`);
        return allTools;
    }

    /**
     * Get client that provides a specific tool
     * @param toolName Name of the tool
     * @returns The client that provides the tool, or undefined if not found
     */
    getToolClient(toolName: string): ToolProvider | undefined {
        return this.toolToClientMap.get(toolName);
    }

    /**
     * Execute a specific tool with the given arguments
     * @param toolName Name of the tool to execute
     * @param args Arguments to pass to the tool
     * @returns Promise resolving to the tool execution result
     */
    async executeTool(toolName: string, args: any): Promise<any> {
        const client = this.getToolClient(toolName);
        if (!client) {
            throw new Error(`No client found for tool: ${toolName}`);
        }

        // Request confirmation before executing
        const approved = await this.confirmationProvider.requestConfirmation({
            toolName,
            args,
        });

        if (!approved) {
            throw new Error(`Execution of tool '${toolName}' was denied`);
        }

        return await client.callTool(toolName, args);
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
        const connectionPromises: Promise<void>[] = [];

        for (const [name, config] of Object.entries(serverConfigs)) {
            const connectPromise = this.connectClient(name, config)
                .then(() => {
                    successfulConnections.push(name);
                })
                .catch((error) => {
                    logger.debug(`Handled connection error for '${name}' during initialization.`);
                });
            connectionPromises.push(connectPromise);
        }

        await Promise.all(connectionPromises);

        const requiredSuccessfulConnections =
            connectionMode === 'strict'
                ? Object.keys(serverConfigs).length
                : Math.min(1, Object.keys(serverConfigs).length);

        if (successfulConnections.length < requiredSuccessfulConnections) {
            const errorSummary = Object.entries(this.getFailedConnections())
                .map(([server, error]) => `${server}: ${error}`)
                .join('; ');
            throw new Error(
                connectionMode === 'strict'
                    ? `Failed to connect to all required servers. Errors: ${errorSummary}`
                    : `Failed to connect to at least one server. Errors: ${errorSummary}`
            );
        }

        if (successfulConnections.length >= requiredSuccessfulConnections) {
            // Only clear errors related to the servers we attempted to connect to in this call
            Object.keys(serverConfigs).forEach((name) => {
                if (successfulConnections.includes(name)) {
                    delete this.connectionErrors[name];
                }
            });
        }
    }

    /**
     * Dynamically connect to a new MCP server.
     * @param name The unique name for the new server connection.
     * @param config The configuration for the server.
     * @returns Promise resolving when the connection attempt is complete.
     * @throws Error if the connection fails.
     */
    async connectClient(name: string, config: McpServerConfig): Promise<void> {
        if (this.clients.has(name)) {
            logger.warn(`Client '${name}' is already connected or registered.`);
            return;
        }

        const client = new MCPClient();
        try {
            logger.info(`Attempting to connect to new server '${name}'...`);
            await client.connect(config, name);
            this.registerClient(name, client);
            logger.info(`Successfully connected to new server '${name}'`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.connectionErrors[name] = errorMsg;
            logger.error(`Failed to connect to new server '${name}': ${errorMsg}`);
            throw new Error(`Failed to connect to new server '${name}': ${errorMsg}`);
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
