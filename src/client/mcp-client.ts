import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { McpServerConfig, StdioServerConfig, SSEServerConfig } from '../config/types.js';
import { ToolSet } from '../ai/types.js';
import { ToolProvider } from './types.js';
const ToolsListSchema = z.object({
    tools: z.array(
        z.object({
            name: z.string(),
            description: z.string().optional(),
            inputSchema: z.any().optional(),
        })
    ),
    nextCursor: z.string().optional(),
});


const DEFAULT_TIMEOUT = 60000;
/**
 * Wrapper on top of Client class provided in model context protocol SDK, to add additional metadata about the server
 */
export class MCPClient implements ToolProvider {
    private client: Client | null = null;
    private transport: any = null;
    private isConnected = false;
    private serverCommand: string | null = null;
    private serverArgs: string[] | null = null;
    private serverEnv: Record<string, string> | null = null;
    private serverSpawned = false;
    private serverPid: number | null = null;
    private serverAlias: string | null = null;
    private timeout: number | undefined = undefined;

    constructor() {}

    async connect(config: McpServerConfig, serverName: string): Promise<Client> {
        this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
        if (config.type === 'stdio') {
            const stdioConfig: StdioServerConfig = config;

            // Auto-resolve npx path on Windows
            let command = stdioConfig.command;
            if (process.platform === 'win32' && command === 'npx') {
                command = 'C:\\Program Files\\nodejs\\npx.cmd';
            }

            return this.connectViaStdio(command, stdioConfig.args, stdioConfig.env, serverName);
        } else if (config.type === 'sse') {
            const sseConfig: SSEServerConfig = config;
            return this.connectViaSSE(sseConfig.url, sseConfig.headers);
        } else {
            throw new Error(`Unsupported server type`);
        }
    }

    /**
     * Connect to an MCP server via stdio
     * @param command Command to run
     * @param args Arguments for the command
     * @param env Environment variables
     * @param serverAlias Optional server alias/name to show in logs
     */
    async connectViaStdio(
        command: string,
        args: string[] = [],
        env?: Record<string, string>,
        serverAlias?: string
    ): Promise<Client> {
        // Store server details
        this.serverCommand = command;
        this.serverArgs = args;
        this.serverEnv = env || null;
        this.serverAlias = serverAlias || null;

        logger.info('');
        logger.info('=======================================');
        logger.info(`MCP SERVER: ${command} ${args.join(' ')}`, null, 'magenta');
        if (env) {
            logger.info('Environment:');
            Object.entries(env).forEach(([key, _]) => {
                logger.info(`  ${key}= [value hidden]`);
            });
        }
        logger.info('=======================================\n');

        const serverName = serverAlias
            ? `"${serverAlias}" (${command} ${args.join(' ')})`
            : `${command} ${args.join(' ')}`;
        logger.info(`Connecting to MCP server: ${serverName}`);

        // Create a properly expanded environment by combining process.env with the provided env
        const expandedEnv = {
            ...process.env,
            ...(env || {}),
        };

        // Create transport for stdio connection with expanded environment
        this.transport = new StdioClientTransport({
            command,
            args,
            env: expandedEnv as Record<string, string>,
        });

        this.client = new Client(
            {
                name: 'Saiki-stdio-mcp-client',
                version: '1.0.0',
            },
            {
                capabilities: { tools: {} },
            }
        );

        try {
            logger.info('Establishing connection...');
            await this.client.connect(this.transport);

            // If connection is successful, we know the server was spawned
            this.serverSpawned = true;
            logger.info(`✅ Stdio SERVER ${serverName} SPAWNED`);
            logger.info('Connection established!\n\n');
            this.isConnected = true;

            return this.client;
        } catch (error: any) {
            logger.error(`Failed to connect to MCP server ${serverName}:`, error.message);
            throw error;
        }
    }

    async connectViaSSE(url: string, headers: Record<string, string>): Promise<Client> {
        logger.info(`Connecting to SSE MCP server at url: ${url}`);

        this.transport = new SSEClientTransport(new URL(url), {
            // For regular HTTP requests
            requestInit: {
                headers: headers,
            },
            // Need to implement eventSourceInit for SSE events.
        });

        logger.debug(`[connectViaSSE] SSE transport: ${JSON.stringify(this.transport, null, 2)}`);
        this.client = new Client(
            {
                name: 'Saiki-sse-mcp-client',
                version: '1.0.0',
            },
            {
                capabilities: { tools: {} },
            }
        );

        try {
            logger.info('Establishing connection...');
            await this.client.connect(this.transport);
            // If connection is successful, we know the server was spawned
            this.serverSpawned = true;
            logger.info(`✅ SSE SERVER ${url} SPAWNED`);
            logger.info('Connection established!\n\n');
            this.isConnected = true;

            return this.client;
        } catch (error: any) {
            logger.error(`Failed to connect to SSE MCP server ${url}:`, error.message);
            throw error;
        }
    }

    /**
     * Disconnect from the server
     */
    async disconnect(): Promise<void> {
        if (this.transport && typeof this.transport.close === 'function') {
            try {
                await this.transport.close();
                this.isConnected = false;
                this.serverSpawned = false;
                logger.info('Disconnected from MCP server');
            } catch (error: any) {
                logger.error('Error disconnecting from MCP server:', error.message);
            }
        }
    }

    /**
     * Call a tool with given name and arguments
     * @param name Tool name
     * @param args Tool arguments
     * @returns Result of the tool execution
     */
    async callTool(name: string, args: any): Promise<any> {
        try {
            logger.debug(`Calling tool '${name}' with args: ${JSON.stringify(args, null, 2)}`);

            // Parse args if it's a string (handle JSON strings)
            let toolArgs = args;
            if (typeof args === 'string') {
                try {
                    toolArgs = JSON.parse(args);
                } catch {
                    // If it's not valid JSON, keep as string
                    toolArgs = { input: args };
                }
            }

            // Call the tool with properly formatted arguments
            logger.debug(`Using timeout: ${this.timeout}`);

            const result = await this.client.callTool(
                { name, arguments: toolArgs },
                undefined, // resultSchema (optional)
                { timeout: this.timeout } // Use server-specific timeout, default 1 minute
            );
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

    /**
     * Get the list of tools provided by this client
     * @returns Array of available tools
     */
    async getTools(): Promise<ToolSet> {
        try {
            const response = await this.client.request(
                { method: 'tools/list', params: {} },
                ToolsListSchema
            );
            return response.tools.reduce<ToolSet>((acc, tool) => {
                acc[tool.name] = {
                    description: tool.description,
                    parameters: tool.inputSchema,
                };
                return acc;
            }, {});
        } catch (error) {
            logger.error('Failed to list tools:', error);
            return {};
        }
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
    getClient(): Client | null {
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
        alias: string | null;
    } {
        return {
            spawned: this.serverSpawned,
            pid: this.serverPid,
            command: this.serverCommand,
            args: this.serverArgs,
            env: this.serverEnv,
            alias: this.serverAlias,
        };
    }

    /**
     * Get the client instance once connected
     * @returns Promise with the MCP client
     */
    async getConnectedClient(): Promise<Client> {
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
            this.serverAlias || undefined
        );
    }
}
