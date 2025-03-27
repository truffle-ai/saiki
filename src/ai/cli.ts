import readline from 'readline';
import chalk from 'chalk';
import { AiCliOptions } from './types.js';
import { MCPClientManager } from '../client/manager.js';
import { logger } from '../utils/logger.js';
import { LLMCallbacks, LLMService } from './llm/types.js';

/**
 * Run the AI CLI with the given LLM service
 * @param mcpClientManager MCP client manager
 * @param llmService LLM service implementation
 * @param options CLI options
 */
export async function runAiCli(
  mcpClientManager: MCPClientManager,
  llmService: LLMService,
  options: AiCliOptions
) {
  // Display welcome message with provider info
  logger.info('AI-Powered MCP Client\n========================\n');
  logger.info(`Using ${options.provider || 'openai'} model: ${options.model || 'default'}`);
  logger.info(`Log level: ${logger.getLevel()}`);
  logger.info(`Connected servers: ${mcpClientManager.getClients().size}`);
  logger.error(`Failed connections: ${Object.keys(mcpClientManager.getFailedConnections()).length}`);

  
  try {
    // Get available tools from all connected servers
    logger.info('Loading available tools...');
    logger.debug('Getting available tools...');
    
    // Using ToolHelper internal to LLMService instead of direct tool fetching
    const tools = await getMCPTools(mcpClientManager);
    
    logger.debug(
      `Received tools: ${tools.map((t) => t.name)}`
    );

    // Update system context with available tools
    llmService.updateSystemContext(tools);
    
    logger.info(`Loaded ${tools.length} tools from ${mcpClientManager.getClients().size} MCP servers`);

    // Create readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.bold.green('\nWhat would you like to do? '),
    });
    
    // Make sure stdin is in flowing mode
    process.stdin.resume();
    rl.prompt();

    // Main interaction loop - simplified with question-based approach
    const promptUser = () => {
      return new Promise<string>((resolve) => {
        process.stdin.resume();
        rl.question(chalk.bold.green('\nWhat would you like to do? '), (answer) => {
          resolve(answer.trim());
        });
      });
    };
    
    try {
      while (true) {
        const userInput = await promptUser();
        
        if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
          logger.warn('Exiting AI CLI. Goodbye!');
          rl.close();
          process.exit(0);
          break;
        }
        
        if (userInput.toLowerCase() === 'clear') {
          llmService.resetConversation();
          logger.info('Conversation history cleared.');
          continue;
        }
        
        try {
          // Create callbacks for progress indication (without spinner)
          const callbacks: LLMCallbacks = {
            onThinking: () => {
              logger.info('AI thinking...');
            },
            onToolCall: (toolName, args) => {
              logger.toolCall(toolName, args);
            },
            onToolResult: (toolName, result) => {
              logger.toolResult(result);
            },
            onResponse: (response) => {
              logger.displayAIResponse({ content: response });
            }
          };
          
          // Use the high-level method to handle the entire interaction
          await llmService.completeTask(userInput, callbacks);
        } catch (error) {
          logger.error(`Error in processing input: ${error.message}`);
        }
      }
    } finally {
      rl.close();
    }
  } catch (error) {
    logger.error(`Error during initialization: ${error.message}`);
  }
}

// Helper function to get all MCP tools
async function getMCPTools(mcpClientManager: MCPClientManager): Promise<any[]> {
  const allTools: any[] = [];
  for (const [name, client] of mcpClientManager.getClients()) {
    try {
      const tools = await client.listTools();
      allTools.push(...tools);
    } catch (error) {
      logger.error(`Error getting tools from ${name}: ${error.message}`);
    }
  }
  return allTools;
}
