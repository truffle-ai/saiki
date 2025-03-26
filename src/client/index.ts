import { McpConnection } from './connection.js';
import { McpInteractiveCli } from './interactive.js';

/**
 * Connect to an MCP server using stdio transport and start the interactive CLI
 * @param command Command to execute the server
 * @param args Arguments for the command
 */
export async function connectAndInteract(command: string, args: string[] = []): Promise<void> {
  const connection = new McpConnection();

  try {
    // Connect to the server
    await connection.connectViaStdio(command, args);

    // Start the interactive CLI
    const cli = new McpInteractiveCli(connection);
    await cli.start();
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}
