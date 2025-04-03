import { ClientManager } from '../../client/manager.js';
import { ToolProvider } from '../../client/types.js';
import { logger } from '../../utils/logger.js';
import { ToolSet } from '../types.js';

export interface IToolHelper {
    getAllTools(): Promise<ToolSet>;
    executeTool?(toolName: string, args: any): Promise<any>;
}

/**
 * Utility class to help with tool management and execution
 */
export class ToolHelper implements IToolHelper {
    private clientManager: ClientManager;
    private toolToClientMap: Map<string, ToolProvider> = new Map();

    constructor(clientManager: ClientManager) {
        this.clientManager = clientManager;
    }
    /**
     * Get all available tools from all connected clients
     */
    async getAllTools(): Promise<ToolSet> {
        let allTools: any = {};
        // Clear existing map to avoid stale entries
        this.toolToClientMap.clear();

        for (const [serverName, client] of this.clientManager.getClients()) {
            try {
                logger.debug(`Getting tools from ${serverName}`);
                const toolList = await client.getTools();
                logger.silly(`Tool list: ${JSON.stringify(toolList, null, 2)}`);

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
     * Execute a specific tool with the given arguments
     */
    async executeTool(toolName: string, args: any): Promise<any> {
        const client = this.toolToClientMap.get(toolName);
        if (!client) {
            throw new Error(`No client found for tool: ${toolName}`);
        }

        return await client.callTool(toolName, args);
    }
}
