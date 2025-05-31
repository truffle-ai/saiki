import { MCPClient } from './mcp-client.js';
import { ServerConfigs, McpServerConfig } from '../config/schemas.js';
import { logger } from '../logger/index.js';
import { IMCPClient } from './types.js';
import { ToolConfirmationProvider } from './tool-confirmation/types.js';
import { CLIConfirmationProvider } from './tool-confirmation/cli-confirmation-provider.js';
import { ToolSet } from '../ai/types.js';
import { GetPromptResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

export class MCPClientManager {
    private clients: Map<string, IMCPClient> = new Map();
    private connectionErrors: { [key: string]: string } = {};
    private toolToClientMap: Map<string, IMCPClient> = new Map();
    private serverToolsMap: Map<string, Map<string, IMCPClient>> = new Map();
    private toolConflicts: Set<string> = new Set();
    private promptToClientMap: Map<string, IMCPClient> = new Map();
    private resourceToClientMap: Map<string, IMCPClient> = new Map();
    private confirmationProvider?: ToolConfirmationProvider;

    constructor(confirmationProvider?: ToolConfirmationProvider) {
        this.confirmationProvider = confirmationProvider ?? new CLIConfirmationProvider();
    }

    /**
     * Register a client that provides tools (and potentially more)
     * @param name Unique name for the client
     * @param client The client instance, expected to be IMCPClient
     */
    registerClient(name: string, client: IMCPClient): void {
        if (this.clients.has(name)) {
            logger.warn(`Client '${name}' already registered. Overwriting.`);
        }
        this.clearClientCache(name);

        this.clients.set(name, client);
        logger.info(`Registered client: ${name}`);
        delete this.connectionErrors[name];
    }

    private clearClientCache(clientName: string): void {
        const client = this.clients.get(clientName);
        if (!client) return;

        this.serverToolsMap.delete(clientName);

        [this.toolToClientMap, this.promptToClientMap, this.resourceToClientMap].forEach(
            (cacheMap) => {
                for (const [key, mappedClient] of cacheMap.entries()) {
                    if (mappedClient === client) {
                        cacheMap.delete(key);
                    }
                }
            }
        );

        this.rebuildToolConflicts();
        logger.debug(`Cleared cache for client: ${clientName}`);
    }

    private rebuildToolConflicts(): void {
        this.toolConflicts.clear();
        const toolCounts = new Map<string, number>();

        for (const serverTools of this.serverToolsMap.values()) {
            for (const toolName of serverTools.keys()) {
                toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);
            }
        }

        for (const [toolName, count] of toolCounts.entries()) {
            if (count > 1) {
                this.toolConflicts.add(toolName);
            }
        }

        // Update main tool map - remove conflicted tools
        for (const conflictedTool of this.toolConflicts) {
            this.toolToClientMap.delete(conflictedTool);
        }
    }

    private async updateClientCache(clientName: string, client: IMCPClient): Promise<void> {
        const serverTools = new Map<string, IMCPClient>();
        this.serverToolsMap.set(clientName, serverTools);

        try {
            const tools = await client.getTools();
            for (const toolName in tools) {
                serverTools.set(toolName, client);

                const existingClient = this.toolToClientMap.get(toolName);
                if (existingClient && existingClient !== client) {
                    this.toolConflicts.add(toolName);
                    this.toolToClientMap.delete(toolName);
                    logger.warn(
                        `Tool conflict detected for '${toolName}' - will be prefixed with server name`
                    );
                } else if (!this.toolConflicts.has(toolName)) {
                    this.toolToClientMap.set(toolName, client);
                }
            }
            logger.debug(`Cached tools for client: ${clientName}`);
        } catch (error) {
            logger.error(`Error retrieving tools for client ${clientName}:`, error);
        }

        // Cache prompts and resources (unchanged)
        try {
            const prompts = await client.listPrompts();
            prompts.forEach((promptName) => {
                this.promptToClientMap.set(promptName, client);
            });
        } catch (error) {
            logger.debug(`Skipping prompts for client ${clientName}: ${error}`);
        }

        try {
            const resources = await client.listResources();
            resources.forEach((resourceUri) => {
                this.resourceToClientMap.set(resourceUri, client);
            });
        } catch (error) {
            logger.debug(`Skipping resources for client ${clientName}: ${error}`);
        }
    }

    /**
     * Get all available tools from all connected clients.
     * Conflicted tools are prefixed with server name.
     * @returns Promise resolving to a ToolSet mapping tool names to Tool definitions
     */
    async getAllTools(): Promise<ToolSet> {
        const allTools: ToolSet = {};

        // Add non-conflicted tools directly
        for (const [toolName, client] of this.toolToClientMap.entries()) {
            const clientTools = await client.getTools();
            const toolDef = clientTools[toolName];
            if (toolDef) {
                allTools[toolName] = toolDef;
            }
        }

        // Add conflicted tools with server prefix
        for (const [serverName, serverTools] of this.serverToolsMap.entries()) {
            for (const [toolName, client] of serverTools.entries()) {
                if (this.toolConflicts.has(toolName)) {
                    // Simple server prefix with underscore
                    const serverPrefix = serverName.replace(/[^a-zA-Z0-9]/g, '_');
                    const qualifiedName = `${serverPrefix}_${toolName}`;
                    const clientTools = await client.getTools();
                    const toolDef = clientTools[toolName];
                    if (toolDef) {
                        allTools[qualifiedName] = {
                            ...toolDef,
                            description: toolDef.description
                                ? `${toolDef.description} (via ${serverName})`
                                : `Tool from ${serverName}`,
                        };
                    }
                }
            }
        }

        return allTools;
    }

    /**
     * Get client that provides a specific tool.
     * Handles both unique tools and server-prefixed tools.
     * @param toolName Name of the tool (may be server-prefixed)
     * @returns The client that provides the tool, or undefined if not found
     */
    getToolClient(toolName: string): IMCPClient | undefined {
        // Check for server-prefixed tool (contains underscore)
        if (toolName.includes('_')) {
            const firstUnderscoreIndex = toolName.indexOf('_');
            const serverPrefix = toolName.substring(0, firstUnderscoreIndex);
            const actualToolName = toolName.substring(firstUnderscoreIndex + 1);

            // Find server by matching prefix
            for (const [serverName, serverTools] of this.serverToolsMap.entries()) {
                const normalizedServerName = serverName.replace(/[^a-zA-Z0-9]/g, '_');
                if (normalizedServerName === serverPrefix && serverTools.has(actualToolName)) {
                    return serverTools.get(actualToolName);
                }
            }
        }

        // Check for unique tool
        return this.toolToClientMap.get(toolName);
    }

    /**
     * Execute a specific tool with the given arguments.
     * @param toolName Name of the tool to execute (may be server-prefixed)
     * @param args Arguments to pass to the tool
     * @returns Promise resolving to the tool execution result
     */
    async executeTool(toolName: string, args: any): Promise<any> {
        const client = this.getToolClient(toolName);
        if (!client) {
            throw new Error(`No client found for tool: ${toolName}`);
        }

        // Extract actual tool name (remove server prefix if present)
        let actualToolName = toolName;
        if (toolName.includes('_')) {
            const firstUnderscoreIndex = toolName.indexOf('_');
            actualToolName = toolName.substring(firstUnderscoreIndex + 1);
        }

        const approved = await this.confirmationProvider.requestConfirmation({
            toolName: actualToolName,
            args,
        });
        if (!approved) {
            throw new Error(`Execution of tool '${toolName}' was denied`);
        }
        return await client.callTool(actualToolName, args);
    }

    /**
     * Get all available prompt names from all connected clients.
     */
    async listAllPrompts(): Promise<string[]> {
        return Array.from(this.promptToClientMap.keys());
    }

    /**
     * Get the client that provides a specific prompt.
     */
    getPromptClient(promptName: string): IMCPClient | undefined {
        return this.promptToClientMap.get(promptName);
    }

    /**
     * Get a specific prompt definition by name.
     */
    async getPrompt(name: string, args?: any): Promise<GetPromptResult> {
        const client = this.getPromptClient(name);
        if (!client) {
            throw new Error(`No client found for prompt: ${name}`);
        }
        return await client.getPrompt(name, args);
    }

    /**
     * Get all available resource URIs from all connected clients.
     */
    async listAllResources(): Promise<string[]> {
        return Array.from(this.resourceToClientMap.keys());
    }

    /**
     * Get the client that provides a specific resource.
     */
    getResourceClient(resourceUri: string): IMCPClient | undefined {
        return this.resourceToClientMap.get(resourceUri);
    }

    /**
     * Read a specific resource by URI.
     */
    async readResource(uri: string): Promise<ReadResourceResult> {
        const client = this.getResourceClient(uri);
        if (!client) {
            throw new Error(`No client found for resource: ${uri}`);
        }
        return await client.readResource(uri);
    }

    /**
     * Initialize clients from server configurations
     */
    async initializeFromConfig(
        serverConfigs: ServerConfigs,
        connectionMode: 'strict' | 'lenient' = 'lenient'
    ): Promise<void> {
        const connectionPromises: Promise<void>[] = [];

        for (const [name, config] of Object.entries(serverConfigs)) {
            const connectPromise = this.connectServer(name, config).catch((error) => {
                logger.debug(`Handled connection error for '${name}' during initialization.`);
            });
            connectionPromises.push(connectPromise);
        }

        await Promise.all(connectionPromises);

        const requiredSuccessfulConnections =
            connectionMode === 'strict'
                ? Object.keys(serverConfigs).length
                : Math.min(1, Object.keys(serverConfigs).length);

        if (this.clients.size < requiredSuccessfulConnections) {
            const errorSummary = Object.entries(this.getFailedConnections())
                .map(([server, error]) => `${server}: ${error}`)
                .join('; ');
            throw new Error(
                connectionMode === 'strict'
                    ? `Failed to connect to all required servers. Errors: ${errorSummary}`
                    : `Failed to connect to at least one server. Errors: ${errorSummary}`
            );
        }
    }

    /**
     * Dynamically connect to a new MCP server.
     */
    async connectServer(name: string, config: McpServerConfig): Promise<void> {
        if (this.clients.has(name)) {
            logger.warn(`Client '${name}' is already connected or registered.`);
            return;
        }

        const client = new MCPClient();
        try {
            logger.info(`Attempting to connect to new server '${name}'...`);
            await client.connect(config, name);
            this.registerClient(name, client);
            await this.updateClientCache(name, client);
            logger.info(`Successfully connected and cached new server '${name}'`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.connectionErrors[name] = errorMsg;
            logger.error(`Failed to connect to new server '${name}': ${errorMsg}`);
            this.clients.delete(name);
            throw new Error(`Failed to connect to new server '${name}': ${errorMsg}`);
        }
    }

    /**
     * Get all registered clients
     */
    getClients(): Map<string, IMCPClient> {
        return this.clients;
    }

    /**
     * Get the errors from failed connections
     */
    getFailedConnections(): { [key: string]: string } {
        return this.connectionErrors;
    }

    /**
     * Disconnect and remove a specific client by name.
     */
    async removeClient(name: string): Promise<void> {
        const client = this.clients.get(name);
        if (client) {
            if (typeof client.disconnect === 'function') {
                try {
                    await client.disconnect();
                    logger.info(`Successfully disconnected client: ${name}`);
                } catch (error) {
                    logger.error(
                        `Error disconnecting client '${name}': ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            }
            this.clients.delete(name);
            this.clearClientCache(name);
            logger.info(`Removed client from manager: ${name}`);
        }
        if (this.connectionErrors[name]) {
            delete this.connectionErrors[name];
            logger.info(`Cleared connection error for removed client: ${name}`);
        }
    }

    /**
     * Disconnect all clients and clear caches
     */
    async disconnectAll(): Promise<void> {
        const disconnectPromises: Promise<void>[] = [];
        for (const [name, client] of this.clients.entries()) {
            if (client.disconnect) {
                disconnectPromises.push(
                    client
                        .disconnect()
                        .then(() => logger.info(`Disconnected client: ${name}`))
                        .catch((error) =>
                            logger.error(`Failed to disconnect client '${name}': ${error}`)
                        )
                );
            }
        }
        await Promise.all(disconnectPromises);

        this.clients.clear();
        this.connectionErrors = {};
        this.toolToClientMap.clear();
        this.serverToolsMap.clear();
        this.toolConflicts.clear();
        this.promptToClientMap.clear();
        this.resourceToClientMap.clear();
        logger.info('Disconnected all clients and cleared caches.');
    }
}
