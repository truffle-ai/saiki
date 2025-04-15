import { McpServerConfig } from '../config/types.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ToolSet } from '../ai/types.js';

// Defining types as any because we can't import the types from the SDK
export type VercelMCPClient = any;

export type IMCPClient = Client | VercelMCPClient;

/**
 * Interface for any provider of tools
 */
export interface ToolProvider {
    /**
     * Get the list of tools provided by this client
     */
    getTools(): Promise<ToolSet>;

    /**
     * Call a specific tool with the given arguments
     */
    callTool(toolName: string, args: any): Promise<any>;

    /**
     * Disconnect the client (if applicable)
     */
    disconnect?(): Promise<void>;
}

/**
 * Interface for MCP clients specifically, that can provide tools
 */
export interface IMCPClientWrapper extends ToolProvider {
    // Connection Management
    connect(config: McpServerConfig, serverName: string): Promise<IMCPClient>;

    // TODO: implement Prompt Management
    // listPrompts(): Promise<string[]>;
    // getPrompt(name: string, args?: any): Promise<string>;

    // Resource Management
    // listResources(): Promise<string[]>;
    // readResource(url: string): Promise<string>;
}

export interface UserConfirmationProvider {
    requestConfirmation(
        details: ToolExecutionDetails,
        callbacks?: {
            displayDetails?: (details: ToolExecutionDetails) => void;
            collectInput?: () => Promise<string | boolean>;
            parseResponse?: (response: any) => boolean;
        }
    ): Promise<boolean>;
}

export interface ToolExecutionDetails {
    toolName: string;
    args: any;
    description?: string;
}