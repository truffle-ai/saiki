import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import readline from 'readline';
import { McpConnection } from './connection.js';

/**
 * Interactive CLI for MCP client
 */
export class McpInteractiveCli {
  private connection: McpConnection;
  private rl: readline.Interface | null = null;

  /**
   * Create a new interactive CLI
   * @param connection MCP connection to use
   */
  constructor(connection: McpConnection) {
    this.connection = connection;
  }

  /**
   * Start the interactive CLI
   */
  async start(): Promise<void> {
    const client = this.connection.getClient();
    
    if (!client) {
      console.error('Error: Not connected to an MCP server');
      return;
    }

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log('\nMCP Interactive CLI');
    console.log('===================');
    console.log('Available commands:');
    console.log('  help           - Show this help information');
    console.log('  list-tools     - List available tools');
    console.log('  tool <name>    - Show details about a specific tool');
    console.log('  call <name> <json-args> - Call a tool with JSON arguments');
    console.log('  list-resources - List available resources');
    console.log('  read <uri>     - Read a resource');
    console.log('  list-prompts   - List available prompts');
    console.log('  prompt <name> <json-args> - Get a prompt with placeholders');
    console.log('  status         - Show connection status');
    console.log('  server-info    - Show detailed server information');
    console.log('  exit           - Exit the CLI');
    console.log('');
    
    this.rl.on('line', async (input) => {
      await this.processCommand(input, client);
      this.rl?.prompt();
    });
    
    this.rl.prompt();
  }

  /**
   * Process a command
   * @param input Command input
   * @param client MCP client
   */
  private async processCommand(input: string, client: Client): Promise<void> {
    const parts = input.trim().split(' ');
    const command = parts[0].toLowerCase();
    
    try {
      switch (command) {
        case 'help':
          this.showHelp();
          break;
        
        case 'list-tools':
          await this.listTools(client);
          break;
        
        case 'tool':
          if (parts.length < 2) {
            console.log('Error: Missing tool name. Usage: tool <name>');
          } else {
            await this.showToolDetails(client, parts[1]);
          }
          break;
        
        case 'call':
          if (parts.length < 3) {
            console.log('Error: Missing arguments. Usage: call <tool-name> <json-args>');
          } else {
            const toolName = parts[1];
            const argsStr = parts.slice(2).join(' ');
            await this.callTool(client, toolName, argsStr);
          }
          break;
          
        case 'list-resources':
          await this.listResources(client);
          break;
          
        case 'read':
          if (parts.length < 2) {
            console.log('Error: Missing URI. Usage: read <resource-uri>');
          } else {
            const uri = parts.slice(1).join(' ');
            await this.readResource(client, uri);
          }
          break;
          
        case 'list-prompts':
          await this.listPrompts(client);
          break;
          
        case 'prompt':
          if (parts.length < 3) {
            console.log('Error: Missing arguments. Usage: prompt <name> <json-args>');
          } else {
            const promptName = parts[1];
            const argsStr = parts.slice(2).join(' ');
            await this.getPrompt(client, promptName, argsStr);
          }
          break;
        
        case 'status':
          this.showStatus();
          break;
          
        case 'server-info':
          this.showServerInfo();
          break;
        
        case 'exit':
          console.log('Exiting...');
          await this.connection.disconnect();
          if (this.rl) {
            this.rl.close();
          }
          process.exit(0);
          break;
        
        default:
          console.log(`Unknown command: "${command}". Type "help" for available commands.`);
          break;
      }
    } catch (error: any) {
      console.error(`Error executing command: ${error.message}`);
    }
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    console.log('\nMCP Interactive CLI Help');
    console.log('======================');
    console.log('Available commands:');
    console.log('  help           - Show this help information');
    console.log('  list-tools     - List available tools');
    console.log('  tool <name>    - Show details about a specific tool');
    console.log('  call <name> <json-args> - Call a tool with JSON arguments');
    console.log('  list-resources - List available resources');
    console.log('  read <uri>     - Read a resource');
    console.log('  list-prompts   - List available prompts');
    console.log('  prompt <name> <json-args> - Get a prompt with placeholders');
    console.log('  status         - Show connection status');
    console.log('  server-info    - Show detailed server information');
    console.log('  exit           - Exit the CLI');
    console.log('');
    console.log('Examples:');
    console.log('  list-tools');
    console.log('  tool example_tool');
    console.log('  call example_tool {"param1":"value1","param2":123}');
    console.log('  read resource://example');
    console.log('');
  }

  /**
   * List available tools
   * @param client MCP client
   */
  private async listTools(client: Client): Promise<void> {
    try {
      const result = await client.listTools();
      
      console.log('\nAvailable tools:');
      if (result.tools.length === 0) {
        console.log('  No tools available');
      } else {
        result.tools.forEach((tool, index) => {
          console.log(`  ${index + 1}. ${tool.name}`);
          if (tool.description) {
            console.log(`     Description: ${tool.description}`);
          }
        });
      }
    } catch (error: any) {
      console.error('Error listing tools:', error.message);
    }
    console.log('');
  }

  /**
   * Show details about a specific tool
   * @param client MCP client
   * @param toolName Tool name
   */
  private async showToolDetails(client: Client, toolName: string): Promise<void> {
    try {
      const result = await client.listTools();
      const tool = result.tools.find(t => t.name === toolName);
      
      if (!tool) {
        console.log(`Tool "${toolName}" not found`);
        return;
      }
      
      console.log(`\nTool: ${tool.name}`);
      
      if (tool.description) {
        console.log(`Description: ${tool.description}`);
      }
      
      if (tool.parameters) {
        console.log('Parameters:');
        Object.entries(tool.parameters).forEach(([name, param]) => {
          console.log(`  ${name}: ${param.type || 'any'}`);
          if (param.description) {
            console.log(`    Description: ${param.description}`);
          }
        });
      }
      
      // Generate a sample arguments object
      const sampleArgs: Record<string, any> = {};
      if (tool.parameters) {
        Object.entries(tool.parameters).forEach(([name, param]) => {
          if (param.type?.includes('string')) {
            sampleArgs[name] = 'example';
          } else if (param.type?.includes('number')) {
            sampleArgs[name] = 123;
          } else if (param.type?.includes('boolean')) {
            sampleArgs[name] = true;
          } else {
            sampleArgs[name] = null;
          }
        });
      }
      
      console.log(`\nExample usage:`);
      console.log(`call ${tool.name} ${JSON.stringify(sampleArgs)}`);
    } catch (error: any) {
      console.error('Error getting tool details:', error.message);
    }
    
    console.log('');
  }

  /**
   * Call a tool
   * @param client MCP client
   * @param toolName Tool name
   * @param argsStr Arguments as JSON string
   */
  private async callTool(client: Client, toolName: string, argsStr: string): Promise<void> {
    let args;
    
    try {
      args = JSON.parse(argsStr);
    } catch (error: any) {
      console.error('Invalid JSON arguments:', error.message);
      console.log('Example: call tool_name {"param1":"value1","param2":123}');
      return;
    }
    
    console.log(`Calling tool: ${toolName}`);
    
    try {
      const result = await client.callTool({
        name: toolName,
        arguments: args
      });
      
      console.log('\nResult:');
      
      // Format the result
      if (result.content && Array.isArray(result.content)) {
        result.content.forEach(item => {
          if (item.type === 'text') {
            console.log(item.text);
          } else {
            console.log(item);
          }
        });
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error: any) {
      console.error('Error calling tool:', error.message);
    }
    
    console.log('');
  }
  
  /**
   * List available resources
   * @param client MCP client
   */
  private async listResources(client: Client): Promise<void> {
    try {
      const result = await client.listResources();
      
      console.log('\nAvailable resources:');
      if (result.resources.length === 0) {
        console.log('  No resources available');
      } else {
        result.resources.forEach((resource, index) => {
          console.log(`  ${index + 1}. ${resource.uri}`);
          if (resource.name) {
            console.log(`     Name: ${resource.name}`);
          }
        });
      }
    } catch (error: any) {
      console.error('Error listing resources:', error.message);
    }
    
    console.log('');
  }
  
  /**
   * Read a resource
   * @param client MCP client
   * @param uri Resource URI
   */
  private async readResource(client: Client, uri: string): Promise<void> {
    try {
      const result = await client.readResource({
        uri
      });
      
      console.log('\nResource content:');
      
      if (result.contents && Array.isArray(result.contents)) {
        result.contents.forEach(item => {
          console.log(`URI: ${item.uri}`);
          console.log('Content:');
          console.log(item.text);
          console.log();
        });
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error: any) {
      console.error('Error reading resource:', error.message);
    }
    
    console.log('');
  }
  
  /**
   * List available prompts
   * @param client MCP client
   */
  private async listPrompts(client: Client): Promise<void> {
    try {
      const result = await client.listPrompts();
      
      console.log('\nAvailable prompts:');
      if (result.prompts.length === 0) {
        console.log('  No prompts available');
      } else {
        result.prompts.forEach((prompt, index) => {
          console.log(`  ${index + 1}. ${prompt.name}`);
          if (prompt.description) {
            console.log(`     Description: ${prompt.description}`);
          }
        });
      }
    } catch (error: any) {
      console.error('Error listing prompts:', error.message);
    }
    
    console.log('');
  }
  
  /**
   * Get a prompt
   * @param client MCP client
   * @param promptName Prompt name
   * @param argsStr Arguments as JSON string
   */
  private async getPrompt(client: Client, promptName: string, argsStr: string): Promise<void> {
    let placeholders;
    
    try {
      placeholders = JSON.parse(argsStr);
    } catch (error: any) {
      console.error('Invalid JSON placeholders:', error.message);
      console.log('Example: prompt prompt_name {"placeholder1":"value1","placeholder2":"value2"}');
      return;
    }
    
    console.log(`Getting prompt: ${promptName}`);
    
    try {
      const result = await client.getPrompt({
        name: promptName,
        placeholders
      });
      
      console.log('\nExpanded prompt:');
      console.log(result.prompt);
    } catch (error: any) {
      console.error('Error getting prompt:', error.message);
    }
    
    console.log('');
  }

  /**
   * Show connection status
   */
  private showStatus(): void {
    console.log('\nConnection Status:');
    console.log(`  Connected: ${this.connection.getConnectionStatus() ? 'Yes' : 'No'}`);
    console.log('');
  }
  
  /**
   * Show detailed server information
   */
  private showServerInfo(): void {
    const info = this.connection.getServerInfo();
    
    console.log('\nServer Information:');
    console.log(`  Server Spawned: ${info.spawned ? 'Yes' : 'No'}`);
    if (info.pid) {
      console.log(`  Server PID: ${info.pid}`);
    }
    if (info.command) {
      console.log(`  Server Command: ${info.command}`);
    }
    if (info.args && info.args.length > 0) {
      console.log(`  Server Arguments: ${info.args.join(' ')}`);
    }
    console.log('');
  }
}
