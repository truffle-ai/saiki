import { McpTool } from '../ai/types.js';

/**
 * Interface for any client that can provide tools
 */
export interface ToolProvider {
  /**
   * Get the list of tools provided by this client
   */
  getTools(): Promise<McpTool[]>;
  
  /**
   * Call a specific tool with the given arguments
   */
  callTool(toolName: string, args: any): Promise<any>;
  
  /**
   * Disconnect the client (if applicable)
   */
  disconnect?(): Promise<void>;
}