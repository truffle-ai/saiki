import { McpServerConfig } from '../server/config.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpTool } from '../ai/types.js';

export type VercelMCPClient = any;
export type VercelMCPTool = any;

export type IMCPClient = Client | VercelMCPClient;

export interface IMCPClientWrapper {
    // Connection Management
    connect(config: McpServerConfig, serverName: string): Promise<IMCPClient>;
    connectViaStdio(
        command: string,
        args: string[],
        env?: Record<string, string>,
        serverAlias?: string
    ): Promise<Client>;
    disconnect(): Promise<void>;

    // Prompt Management
    listPrompts(): Promise<string[]>;
    getPrompt(name: string, args?: any): Promise<string>;

    // Resource Management
    listResources(): Promise<string[]>;
    readResource(url: string): Promise<string>;

    // Tool Management
    callTool(name: string, args: any): Promise<any>;
    listTools(): Promise<McpTool[]>;
}