import readline from 'readline';
import chalk from 'chalk';
import { AiCliOptions } from './types.js';
import { MCPClientManager } from '../client/manager.js';
import { logger } from '../utils/logger.js';
import { LLMCallbacks, LLMService, LLMConfig } from './llm/types.js';
import { AgentConfig } from '../server/config.js';
import { createLLMService } from './llm/factory.js';

/**
 * Start AI-powered CLI with unified configuration
 * @param options CLI options
 * @param config Agent configuration including MCP servers and LLM settings
 * @param connectionMode Whether to enforce all connections must succeed ("strict") or allow partial success ("lenient")
 */
export async function initializeAiCli(
  options: AiCliOptions = {},
  config: AgentConfig,
  connectionMode: 'strict' | 'lenient' = 'lenient'
) {
  // Extract LLM config with default values
  const llmConfig: LLMConfig = {
    provider: config.llm?.provider || 'openai',
    model: config.llm?.model || 'gpt-4o-mini',
    apiKey: config.llm?.apiKey || '',
    options: config.llm?.providerOptions,
  };

  // Get provider from config
  const provider = llmConfig.provider;

  // Get API key from config or environment
  let apiKey = llmConfig.apiKey;
  if (apiKey?.startsWith('env:')) {
    // If the API key is specified as an environment variable reference
    const envVarName = apiKey.substring(4);
    apiKey = process.env[envVarName];
  } else {
    // Fall back to environment variables if not in config
    const apiKeyEnvVar = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
    apiKey = apiKey || process.env[apiKeyEnvVar];
  }

  if (!apiKey) {
    logger.error(`Error: API key for ${provider} not found`);
    logger.error(
      `Please set your ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key in the config file or .env file`
    );
    process.exit(1);
  }

  logger.debug('Verified API key');

  // Initialize client manager with server configs from unified config
  const mcpClientManager = new MCPClientManager(config.mcpServers, connectionMode);
  await mcpClientManager.initialize();

  logger.debug('MCP servers initialized');

  // Create LLM service using config from unified config
  const llmServiceConfig: LLMConfig = {
    provider,
    apiKey,
    model: llmConfig.model,
    options: llmConfig.options,
  };

  const llmService = createLLMService(llmServiceConfig, mcpClientManager);

  logger.debug('LLM service created');

  // Run AI CLI
  try {
    await runAiCli(mcpClientManager, llmService, options);
  } catch (error) {
    logger.error(`Error running AI CLI: ${error.message}`);
    process.exit(1);
  }
}

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
  // Get model and provider info directly from the LLM service
  const { provider, model } = llmService.getConfig();
  logger.info(`Using ${provider} model: ${model}`, null, 'yellow');

  logger.debug(`Log level: ${logger.getLevel()}`);
  logger.info(`Connected servers: ${mcpClientManager.getClients().size}`, null, 'green');
  logger.error(
    `Failed connections: ${Object.keys(mcpClientManager.getFailedConnections()).length}. Ignoring in lenient mode.\n`,
    null,
    'red'
  );

  try {
    // Get available tools from all connected servers
    logger.info('Loading available tools...');

    // Using ToolHelper internal to LLMService instead of direct tool fetching
    const tools = await getMCPTools(mcpClientManager);

    logger.debug(`Received tools: ${tools.map((t) => t.name)}`);

    // Update system context with available tools
    llmService.updateSystemContext(tools);

    logger.info(
      `Loaded ${tools.length} tools from ${mcpClientManager.getClients().size} MCP servers\n`
    );
    logger.info('AI Agent initialized successfully!', null, 'green');
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
            },
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
