import { MCPClientManager } from '../../client/manager.js';
import { IMCPClient } from '../../client/mcp-client.js';
import { McpTool } from '../types.js';
import { logger } from '../../utils/logger.js';
/**
 * Utility class to help with tool management and execution
 */
export class ToolHelper {
  private mcpClientManager: MCPClientManager;
  private toolToClientMap: Map<string, IMCPClient> = new Map();
  
  constructor(mcpClientManager: MCPClientManager) {
    this.mcpClientManager = mcpClientManager;
  }
  
  /**
   * Get all available tools from all connected clients
   */
  async getAllTools(): Promise<McpTool[]> {
    const allTools: McpTool[] = [];
    
    for (const [serverName, client] of this.mcpClientManager.getClients()) {
      try {
        logger.debug("Getting tools from ", serverName);
        const toolList = await client.listTools();
        for (const tool of toolList) {
          this.toolToClientMap.set(tool.name, client);
          allTools.push(tool);
        }
        logger.debug("Updated tool list after getting tools", allTools);
      } catch (error) {
        console.error(`Error getting tools from ${serverName}:`, error);
      }
    }
    
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