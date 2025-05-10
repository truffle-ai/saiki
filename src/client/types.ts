import { McpServerConfig } from '../config/schemas.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ToolSet } from '../ai/types.js';
import { GetPromptResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Interface for any provider of tools
 */
export interface ToolProvider {
    getTools(): Promise<ToolSet>;
    callTool(toolName: string, args: any): Promise<any>;
}

/**
 * Interface for MCP clients specifically, that can provide tools
 */
export interface IMCPClient extends ToolProvider {
    // Connection Management
    connect(config: McpServerConfig, serverName: string): Promise<Client>;
    disconnect?(): Promise<void>;

    // Prompt Management
    listPrompts(): Promise<string[]>;
    getPrompt(name: string, args?: any): Promise<GetPromptResult>;

    // Resource Management
    listResources(): Promise<string[]>;
    readResource(uri: string): Promise<ReadResourceResult>;
}
