import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * Connection manager for MCP clients
 */
export class McpConnection {
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
   * Create a new MCP connection
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

    console.log('=======================================');
    console.log(`MCP SERVER: ${command} ${args.join(' ')}`);
    if (env) {
      console.log('Environment:');
      Object.entries(env).forEach(([key, value]) => {
        console.log(`  ${key}=${value}`);
      });
    }
    console.log('=======================================\n');

    const serverName = serverAlias ? `"${serverAlias}" (${command} ${args.join(' ')})` : `${command} ${args.join(' ')}`;
    console.log(`Connecting to MCP server: ${serverName}`);

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
      console.log('Establishing connection...');
      await this.client.connect(this.transport);

      // If connection is successful, we know the server was spawned
      this.serverSpawned = true;
      console.log(`\n✅ SERVER SPAWNED (PID unknown - MCP SDK doesn't expose it)`);
      console.log('Connection established!');
      this.isConnected = true;

      return this.client;
    } catch (error: any) {
      console.error('Failed to connect to MCP server:', error.message);
      throw error;
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
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (this.transport && typeof this.transport.close === 'function') {
      try {
        await this.transport.close();
        this.isConnected = false;
        this.serverSpawned = false;
        console.log('Disconnected from MCP server');
      } catch (error: any) {
        console.error('Error disconnecting from MCP server:', error.message);
      }
    }
  }
}
