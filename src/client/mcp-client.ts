import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { McpTool } from '../ai/types.js';
import { logger } from '../utils/logger.js';

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


/**
 * Connection manager for MCP clients
 */
export class MCPClient implements IMCPClient {
  private client: Client | null = null;
  private transport: any = null;
  private isConnected = false;
  private serverCommand: string | null = null;
  private serverArgs: string[] | null = null;
  private serverEnv: Record<string, string> | null = null;
  private serverSpawned = false;
  private serverPid: number | null = null;
  private serverAlias: string | null = null;

  /**
   * Create a new MCP Client object
   */
  constructor() {}

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

    logger.info('')
    logger.info('=======================================');
    logger.info(`MCP SERVER: ${command} ${args.join(' ')}`, null, 'magenta');
    if (env) {
      logger.info('Environment:');
      Object.entries(env).forEach(([key, value]) => {
        logger.info(`  ${key}=${value}`);
      });
    }
    logger.info('=======================================\n');

    const serverName = serverAlias ? `"${serverAlias}" (${command} ${args.join(' ')})` : `${command} ${args.join(' ')}`;
    logger.info(`Connecting to MCP server: ${serverName}`);

    // Create transport for stdio connection
    // Note: StdioClientTransport doesn't directly expose the childProcess
    // so we have to rely on transport events
    this.transport = new StdioClientTransport({
      command,
      args,
      env,
    });

    // We'll set server spawned to true after successful connection

    // Create client
    this.client = new Client(
      { name: 'MCP-Example-Client', version: '1.0.0' },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    try {
      logger.info('Establishing connection...');
      await this.client.connect(this.transport);

      // If connection is successful, we know the server was spawned
      this.serverSpawned = true;
      logger.info(`✅ SERVER ${serverName} SPAWNED`);
      logger.info('Connection established!\n\n');
      this.isConnected = true;

      return this.client;
    } catch (error: any) {
      logger.error(`Failed to connect to MCP server ${serverName}:`, error.message);
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

  async listPrompts(): Promise<string[]> { return []; }
  async getPrompt(name: string, args?: any): Promise<string> { return ""; }

  async listResources(): Promise<string[]> { return []; }
  async readResource(url: string): Promise<string> { return ""; }

  async callTool(name: string, args: any): Promise<any> {
    try {
      logger.debug(`Calling tool '${name}' with args:`, args);
      
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
      logger.debug(`Tool '${name}' result:`, result);
      
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

  // Temp unused implementation
  async listTools(): Promise<McpTool[]> {
    try {
      const response = await this.client.request(
        { method: 'tools/list', params: {} },
        ToolsListSchema
      );
      // logger.debug('Tools/list response:', response);
      return response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description || 'No description available',
        parameters: tool.inputSchema || null,
      }));
    } catch (error) {
      logger.error('Failed to list tools:', error);
      return [];
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
      alias: this.serverAlias
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

export interface IMCPClient {
  // Connection Management
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