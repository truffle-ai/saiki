import { IMCPClient, MCPClient } from './mcpClient.js';
import { ServerConfigs } from '../server/config.js';

export class MCPClientManager implements IMCPClientManager {
  private clients: Map<string, IMCPClient> = new Map();
  private connectionErrors: { [key: string]: string } = {};
  private successfulServers: string[] = [];
  private connectionMode: 'strict' | 'lenient';
  private serverConfigs: ServerConfigs;

  constructor(
    serverConfigs: ServerConfigs,
    connectionMode: 'strict' | 'lenient' = 'lenient'
  ) {
    // Just set up basic state, initialize() will do the real work
    this.connectionMode = connectionMode;
    this.serverConfigs = serverConfigs;
  }

  async initialize(): Promise<void> {
    for (const [name, config] of Object.entries(this.serverConfigs)) {
      // 1. Create a client
      // 2. Initialize the client with stdio connection
      // 3. If initialization succeeds, add the client to clients map and successfulServers array
      // 4. If initialization fails, add the error to connectionErrors map
      const client = new MCPClient();

      try {
        await client.connectViaStdio(config.command, config.args, config.env, name);
        this.clients.set(name, client);
        this.successfulServers.push(name);
      } catch (error) {
        this.connectionErrors[name] = error instanceof Error ? error.message : String(error);
      }

    }
    // Check connection mode to see if we throw an error or not
    // If mode is lenient, at least one connection has to succeed
    // If mode is strict, all connections have to succeed
    const requiredSuccessfulConnections = this.connectionMode === 'strict' ? Object.keys(this.serverConfigs).length : 1;
    if (this.successfulServers.length < requiredSuccessfulConnections) {
      throw new Error('Failed to connect to all servers');
    }
    
  }
    
  getClients(): Map<string, IMCPClient> {
    return this.clients;
  }

  getFailedConnections(): { [key: string]: string } {
    return this.connectionErrors;
  }

  disconnectAll(): void {
    for (const client of this.clients.values()) {
      client.disconnect();
    }
  }
}

export interface IMCPClientManager {
  getClients(): Map<string, IMCPClient>;
  disconnectAll(): void;
}