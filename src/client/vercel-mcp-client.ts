// import { Client } from '@modelcontextprotocol/sdk/client/index.js';
// import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { logger } from '../utils/logger.js';
import { experimental_createMCPClient as createMCPClient, ToolSet } from 'ai';
import { Experimental_StdioMCPTransport as StdioMCPTransport } from 'ai/mcp-stdio';
import { McpServerConfig, StdioServerConfig } from '../config/types.js';
import { VercelMCPClient, IMCPClientWrapper } from '../client/types.js';

export class VercelMCPClientWrapper implements IMCPClientWrapper {
    private client: VercelMCPClient;
    private transport: any = null;
    private isConnected = false;
    private serverCommand: string | null = null;
    private serverArgs: string[] | null = null;
    private serverEnv: Record<string, string> | null = null;
    private serverSpawned = false;
    private serverPid: number | null = null;
    private serverName: string | null = null;

    constructor() {}

    async connect(config: McpServerConfig, serverName: string): Promise<VercelMCPClient> {
        if (config.type === 'stdio') {
            const stdioConfig: StdioServerConfig = config;
            return this.connectViaStdio(
                stdioConfig.command,
                stdioConfig.args,
                stdioConfig.env,
                serverName
            );
        }
        if (config.type === 'sse') {
            throw new Error('SSE connections are not yet supported');
            //return this.connectViaSSE(config.url, config.headers);
        }
    }

    /**
     * Connect to an MCP server via stdio
     * @param command Command to run
     * @param args Arguments for the command
     * @param env Environment variables
     * @param serverName Optional server name to show in logs
     */
    async connectViaStdio(
        command: string,
        args: string[] = [],
        env?: Record<string, string>,
        serverName?: string
    ): Promise<VercelMCPClient> {
        // Store server details
        this.serverCommand = command;
        this.serverArgs = args;
        this.serverEnv = env || null;
        this.serverName = serverName || null;

        logger.info('');
        logger.info('=======================================');
        logger.info(`MCP SERVER: ${command} ${args.join(' ')}`, null, 'magenta');
        if (env) {
            logger.info('Environment:');
            Object.entries(env).forEach(([key, value]) => {
                logger.info(`  ${key}=${value}`);
            });
        }
        logger.info('=======================================\n');

        const serverInfo = serverName
            ? `"${serverName}" (${command} ${args.join(' ')})`
            : `${command} ${args.join(' ')}`;
        logger.info(`Connecting to MCP server: ${serverInfo}`);

        try {
            this.transport = new StdioMCPTransport({
                command,
                args,
                env,
            });
            this.client = await createMCPClient({
                transport: this.transport,
            });

            this.serverSpawned = true;
            logger.info(`✅ SERVER ${serverName} SPAWNED`);
            logger.info('Connection established!\n\n');
            this.isConnected = true;

            return this.client;
        } catch (error) {
            logger.error('Failed to create and connect to MCP client:', error);
            throw error;
        }
    }

    /**
     * Disconnect from the server
     */
    async disconnect(): Promise<void> {
        if (this.client && typeof this.client.close === 'function') {
            try {
                await this.client.close();
                this.isConnected = false;
                this.serverSpawned = false;
                logger.info('Disconnected from MCP server');
            } catch (error: any) {
                logger.error('Error disconnecting from MCP server:', error.message);
            }
        }
    }

    // async listPrompts(): Promise<string[]> {
    //     return [];
    // }
    // async getPrompt(name: string, args?: any): Promise<string> {
    //     return '';
    // }

    // async listResources(): Promise<string[]> {
    //     return [];
    // }
    // async readResource(url: string): Promise<string> {
    //     return '';
    // }

    async callTool(name: string, args: any): Promise<any> {
        try {
            logger.debug(`Calling tool '${name}' with args: ${JSON.stringify(args, null, 2)}`);

            // Parse args if it's a string (handle JSON strings)
            let toolArgs = args;
            if (typeof args === 'string') {
                try {
                    toolArgs = JSON.parse(args);
                } catch (e) {
                    // If it's not valid JSON, keep as string
                    toolArgs = { input: args };
                }
            }

            // Call the tool with properly formatted arguments
            const result = await this.client.callTool({ name, arguments: toolArgs });
            logger.debug(`Tool '${name}' result: ${JSON.stringify(result, null, 2)}`);

            // Check for null or undefined result
            if (result === null || result === undefined) {
                return 'Tool executed successfully with no result data.';
            }
            return result;
        } catch (error) {
            logger.error(`Tool call '${name}' failed:`, error);
            return `Error executing tool '${name}': ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    async getTools(): Promise<ToolSet> {
        return this.client.tools();
    }

    /**
     * Check if the client is connected
     */
    getConnectionStatus(): boolean {
        return this.isConnected;
    }

    /**
     * Get the connected client
     */
    getClient(): VercelMCPClient | null {
        return this.client;
    }

    /**
     * Get server status information
     */
    getServerInfo(): {
        spawned: boolean;
        pid: number | null;
        command: string | null;
        args: string[] | null;
        env: Record<string, string> | null;
        name: string | null;
    } {
        return {
            spawned: this.serverSpawned,
            pid: this.serverPid,
            command: this.serverCommand,
            args: this.serverArgs,
            env: this.serverEnv,
            name: this.serverName,
        };
    }

    /**
     * Get the client instance once connected
     * @returns Promise with the MCP client
     */
    async getConnectedClient(): Promise<VercelMCPClient> {
        if (this.client && this.isConnected) {
            return this.client;
        }

        if (!this.serverCommand) {
            throw new Error('Cannot get client: Connection has not been initialized');
        }

        // If connection is in progress, wait for it to complete
        return this.connectViaStdio(
            this.serverCommand,
            this.serverArgs || [],
            this.serverEnv || undefined,
            this.serverName || undefined
        );
    }
}
