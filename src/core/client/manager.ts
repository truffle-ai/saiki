import { MCPClient } from './mcp-client.js';
import { ServerConfigs, McpServerConfig } from '../config/schemas.js';
import { logger } from '../logger/index.js';
import { IMCPClient } from './types.js';
import { ToolConfirmationProvider } from './tool-confirmation/types.js';
import { NoOpConfirmationProvider } from './tool-confirmation/noop-confirmation-provider.js';
import { ToolSet } from '../ai/types.js';
import { GetPromptResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { ToolExecutionDeniedError } from './tool-confirmation/errors.js';

/**
 * Centralized manager for Multiple Model Context Protocol (MCP) servers.
 *
 * The MCPManager serves as a unified interface for managing connections to multiple MCP servers,
 * providing access to their tools, prompts, and resources through a single entry point.
 *
 * Key responsibilities:
 * - **Client Management**: Register, connect, disconnect, and remove MCP clients
 * - **Resource Discovery**: Cache and provide access to tools, prompts, and resources from all connected clients
 * - **Tool Execution**: Execute tools with built-in confirmation mechanisms for security
 * - **Connection Handling**: Support both strict and lenient connection modes with error tracking
 * - **Caching**: Maintain efficient lookup maps for fast access to client capabilities
 *
 * The manager supports dynamic client connections, allowing servers to be added or removed at runtime.
 * It includes robust error handling and maintains connection state for debugging purposes.
 *
 * @example
 * ```typescript
 * const manager = new MCPManager();
 * await manager.initializeFromConfig(serverConfigs);
 *
 * // Execute a tool from any connected server
 * const result = await manager.executeTool('my_tool', { param: 'value' });
 *
 * // Get all available tools across all servers
 * const tools = await manager.getAllTools();
 * ```
 */
export class MCPManager {
    private clients: Map<string, IMCPClient> = new Map();
    private connectionErrors: { [key: string]: string } = {};
    private toolToClientMap: Map<string, IMCPClient> = new Map();
    private serverToolsMap: Map<string, Map<string, IMCPClient>> = new Map();
    private toolConflicts: Set<string> = new Set();
    private promptToClientMap: Map<string, IMCPClient> = new Map();
    private resourceToClientMap: Map<string, IMCPClient> = new Map();
    private confirmationProvider: ToolConfirmationProvider;

    // Use a distinctive delimiter that won't appear in normal server/tool names
    private static readonly SERVER_DELIMITER = '__';

    constructor(confirmationProvider?: ToolConfirmationProvider) {
        // If a confirmation provider is passed, use it, otherwise use auto-approve fallback
        this.confirmationProvider = confirmationProvider ?? new NoOpConfirmationProvider();
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

        // Remove from server tools map
        this.serverToolsMap.delete(clientName);

        [this.toolToClientMap, this.promptToClientMap, this.resourceToClientMap].forEach(
            (cacheMap) => {
                for (const [key, mappedClient] of Array.from(cacheMap.entries())) {
                    if (mappedClient === client) {
                        cacheMap.delete(key);
                    }
                }
            }
        );

        // Rebuild conflict detection
        this.rebuildToolConflicts();
        logger.debug(`Cleared cache for client: ${clientName}`);
    }

    private rebuildToolConflicts(): void {
        this.toolConflicts.clear();
        const toolCounts = new Map<string, number>();

        // Count tool occurrences across all servers
        for (const serverTools of this.serverToolsMap.values()) {
            for (const toolName of serverTools.keys()) {
                toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);
            }
        }

        // Identify conflicts and update main tool map
        for (const [toolName, count] of toolCounts.entries()) {
            if (count > 1) {
                this.toolConflicts.add(toolName);
                // Remove conflicted tools from main map - they'll be accessed via server prefix
                this.toolToClientMap.delete(toolName);
            }
        }
    }

    /**
     * Sanitize server name for use in tool prefixing.
     * Ensures the name is safe for LLM provider tool naming constraints.
     */
    private sanitizeServerName(serverName: string): string {
        return serverName.replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    private async updateClientCache(clientName: string, client: IMCPClient): Promise<void> {
        // Initialize server tools map
        const serverTools = new Map<string, IMCPClient>();
        this.serverToolsMap.set(clientName, serverTools);

        // Cache tools
        try {
            const tools = await client.getTools();
            for (const toolName in tools) {
                // Store in server-specific map
                serverTools.set(toolName, client);

                // Add to main map if no conflict, otherwise mark as conflicted
                const existingClient = this.toolToClientMap.get(toolName);
                if (existingClient && existingClient !== client) {
                    // Conflict detected
                    this.toolConflicts.add(toolName);
                    this.toolToClientMap.delete(toolName);
                    logger.warn(
                        `Tool conflict detected for '${toolName}' - will use server prefix`
                    );
                } else if (!this.toolConflicts.has(toolName)) {
                    this.toolToClientMap.set(toolName, client);
                }
            }
            logger.debug(`Cached tools for client: ${clientName}`);
        } catch (error) {
            logger.error(
                `Error retrieving tools for client ${clientName}: ${error instanceof Error ? error.message : String(error)}`
            );
            return; // Early return on error, no caching
        }

        // Cache prompts, if supported
        try {
            const prompts = await client.listPrompts();
            prompts.forEach((promptName) => {
                this.promptToClientMap.set(promptName, client);
            });
            logger.debug(`Cached prompts for client: ${clientName}`);
        } catch (error) {
            logger.debug(`Skipping prompts for client ${clientName}: ${error}`);
        }

        // Cache resources, if supported
        // TODO: HF SERVER HAS 100000+ RESOURCES - need to think of a way to make resources/caching optional or better.
        try {
            const resources = await client.listResources();
            resources.forEach((resourceUri) => {
                this.resourceToClientMap.set(resourceUri, client);
            });
            logger.debug(`Cached resources for client: ${clientName}`);
        } catch (error) {
            logger.debug(`Skipping resources for client ${clientName}: ${error}`);
        }
    }

    /**
     * Get all available tools from all connected clients, updating the cache.
     * Conflicted tools are prefixed with server name using distinctive delimiter.
     * @returns Promise resolving to a ToolSet mapping tool names to Tool definitions
     */
    async getAllTools(): Promise<ToolSet> {
        const allTools: ToolSet = {};

        // Add non-conflicted tools directly
        for (const [toolName, client] of Array.from(this.toolToClientMap.entries())) {
            const clientTools = await client.getTools();
            const toolDef = clientTools[toolName];
            if (toolDef) {
                allTools[toolName] = toolDef;
            }
        }

        // Add conflicted tools with server prefix using distinctive delimiter
        for (const [serverName, serverTools] of this.serverToolsMap.entries()) {
            for (const [toolName, client] of serverTools.entries()) {
                if (this.toolConflicts.has(toolName)) {
                    const sanitizedServerName = this.sanitizeServerName(serverName);
                    const qualifiedName = `${sanitizedServerName}${MCPManager.SERVER_DELIMITER}${toolName}`;

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

        logger.silly(`All tools: ${JSON.stringify(allTools, null, 2)}`);
        return allTools;
    }

    /**
     * Parse a qualified tool name to extract server name and actual tool name.
     * Uses distinctive delimiter to avoid ambiguity.
     */
    private parseQualifiedToolName(
        toolName: string
    ): { serverName: string; toolName: string } | null {
        const delimiterIndex = toolName.indexOf(MCPManager.SERVER_DELIMITER);
        if (delimiterIndex === -1) {
            return null; // Not a qualified tool name
        }

        const serverPrefix = toolName.substring(0, delimiterIndex);
        const actualToolName = toolName.substring(
            delimiterIndex + MCPManager.SERVER_DELIMITER.length
        );

        // Find the original server name by matching sanitized names
        for (const [originalServerName, serverTools] of this.serverToolsMap.entries()) {
            const sanitizedName = this.sanitizeServerName(originalServerName);
            if (sanitizedName === serverPrefix && serverTools.has(actualToolName)) {
                return { serverName: originalServerName, toolName: actualToolName };
            }
        }

        return null;
    }

    /**
     * Get client that provides a specific tool from the cache.
     * Handles both simple tool names and server-prefixed tool names.
     * @param toolName Name of the tool (may include server prefix)
     * @returns The client that provides the tool, or undefined if not found
     */
    getToolClient(toolName: string): IMCPClient | undefined {
        // First try to parse as qualified tool name
        const parsed = this.parseQualifiedToolName(toolName);
        if (parsed) {
            const serverTools = this.serverToolsMap.get(parsed.serverName);
            return serverTools?.get(parsed.toolName);
        }

        // Otherwise try as simple tool name
        return this.toolToClientMap.get(toolName);
    }

    /**
     * Execute a specific tool with the given arguments.
     * @param toolName Name of the tool to execute (may include server prefix)
     * @param args Arguments to pass to the tool
     * @param sessionId Optional session ID
     * @returns Promise resolving to the tool execution result
     */
    async executeTool(toolName: string, args: any, sessionId?: string): Promise<any> {
        const client = this.getToolClient(toolName);
        if (!client) {
            throw new Error(`No client found for tool: ${toolName}`);
        }

        // Extract actual tool name (remove server prefix if present)
        const parsed = this.parseQualifiedToolName(toolName);
        const actualToolName = parsed ? parsed.toolName : toolName;

        const approved = await this.confirmationProvider.requestConfirmation({
            toolName: actualToolName,
            args,
        });
        if (!approved) {
            throw new ToolExecutionDeniedError(toolName, sessionId);
        }
        return await client.callTool(actualToolName, args);
    }

    /**
     * Get all available prompt names from all connected clients, updating the cache.
     * @returns Promise resolving to an array of unique prompt names.
     */
    async listAllPrompts(): Promise<string[]> {
        return Array.from(this.promptToClientMap.keys());
    }

    /**
     * Get the client that provides a specific prompt from the cache.
     * @param promptName Name of the prompt.
     * @returns The client instance or undefined.
     */
    getPromptClient(promptName: string): IMCPClient | undefined {
        return this.promptToClientMap.get(promptName);
    }

    /**
     * Get a specific prompt definition by name.
     * @param name Name of the prompt.
     * @param args Arguments for the prompt (optional).
     * @returns Promise resolving to the prompt definition.
     */
    async getPrompt(name: string, args?: any): Promise<GetPromptResult> {
        const client = this.getPromptClient(name);
        if (!client) {
            throw new Error(`No client found for prompt: ${name}`);
        }
        return await client.getPrompt(name, args);
    }

    /**
     * Get all available resource URIs from all connected clients, updating the cache.
     * @returns Promise resolving to an array of unique resource URIs.
     */
    async listAllResources(): Promise<string[]> {
        return Array.from(this.resourceToClientMap.keys());
    }

    /**
     * Get the client that provides a specific resource from the cache.
     * @param resourceUri URI of the resource.
     * @returns The client instance or undefined.
     */
    getResourceClient(resourceUri: string): IMCPClient | undefined {
        return this.resourceToClientMap.get(resourceUri);
    }

    /**
     * Read a specific resource by URI.
     * @param uri URI of the resource.
     * @returns Promise resolving to the resource content.
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
     * @param serverConfigs Server configurations with individual connection modes
     * @returns Promise resolving when initialization is complete
     */
    async initializeFromConfig(serverConfigs: ServerConfigs): Promise<void> {
        // Handle empty server configurations gracefully
        if (Object.keys(serverConfigs).length === 0) {
            logger.info('No MCP servers configured - running without external tools');
            return;
        }

        const successfulConnections: string[] = [];
        const connectionPromises: Promise<void>[] = [];
        const strictServers: string[] = [];
        const lenientServers: string[] = [];

        // Categorize servers by their connection mode
        for (const [name, config] of Object.entries(serverConfigs)) {
            const effectiveMode = config.connectionMode || 'lenient';
            if (effectiveMode === 'strict') {
                strictServers.push(name);
            } else {
                lenientServers.push(name);
            }

            const connectPromise = this.connectServer(name, config)
                .then(() => {
                    successfulConnections.push(name);
                })
                .catch((error) => {
                    logger.debug(
                        `Handled connection error for '${name}' during initialization: ${error.message}`
                    );
                });
            connectionPromises.push(connectPromise);
        }

        await Promise.all(connectionPromises);

        // Check strict servers - all must succeed
        const failedStrictServers = strictServers.filter(
            (name) => !successfulConnections.includes(name)
        );
        if (failedStrictServers.length > 0) {
            const strictErrors = failedStrictServers
                .map((name) => `${name}: ${this.connectionErrors[name] || 'Unknown error'}`)
                .join('; ');
            throw new Error(`Failed to connect to required strict servers: ${strictErrors}`);
        }

        // Lenient servers are allowed to fail without throwing errors
        // No additional validation needed for lenient servers
    }

    /**
     * Dynamically connect to a new MCP server.
     * @param name The unique name for the new server connection.
     * @param config The configuration for the server.
     * @returns Promise resolving when the connection attempt is complete.
     * @throws Error if the connection fails.
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
     * @returns Map of client names to client instances
     */
    getClients(): Map<string, IMCPClient> {
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
     * Disconnect and remove a specific client by name.
     * @param name The name of the client to remove.
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
                    // Continue with removal even if disconnection fails
                }
            }
            this.clients.delete(name);
            this.clearClientCache(name);
            logger.info(`Removed client from manager: ${name}`);
        }
        // Also remove from failed connections if it was registered there before successful connection or if it failed.
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
        for (const [name, client] of Array.from(this.clients.entries())) {
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
