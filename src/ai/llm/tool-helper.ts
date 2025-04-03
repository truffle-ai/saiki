import { ClientManager } from '../../client/manager.js';
import { ToolProvider } from '../../client/types.js';
import { logger } from '../../utils/logger.js';
/**
 * Utility class to help with tool management and execution
 */
export class ToolHelper {
    private clientManager: ClientManager;
    private toolToClientMap: Map<string, ToolProvider> = new Map();

    constructor(clientManager: ClientManager) {
        this.clientManager = clientManager;
    }
    /**
     * Get all available tools from all connected clients
     */
    async getAllTools(): Promise<any> {
        let allTools: any = {};

        for (const [serverName, client] of this.clientManager.getClients()) {
            try {
                logger.debug(`Getting tools from ${serverName}`);
                const toolList = await client.getTools();
                for (const tool of toolList) {
                    this.toolToClientMap.set(tool.name, client);
                    allTools.push(tool);
                }
                logger.debug(`Updated tool list after getting tools: ${allTools}`);
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
