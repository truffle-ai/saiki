import { MCPClientManager } from '../../client/manager.js';
import { IMCPClientWrapper } from '../../client/types.js';
import { logger } from '../../utils/logger.js';
/**
 * Utility class to help with tool management and execution
 */
export class ToolHelper {
    private mcpClientManager: MCPClientManager;
    private toolToClientMap: Map<string, IMCPClientWrapper> = new Map();

    constructor(mcpClientManager: MCPClientManager) {
        this.mcpClientManager = mcpClientManager;
    }
    /**
     * Get all available tools from all connected clients
     */
    async getAllTools(): Promise<any> {
        let allTools: any = {};

        for (const [serverName, client] of this.mcpClientManager.getClients()) {
            try {
                logger.debug(`Getting tools from ${serverName}`);
                const toolList = await client.listTools();
                logger.silly(`Tool list: ${JSON.stringify(toolList, null, 2)}`);

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
