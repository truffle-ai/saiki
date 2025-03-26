import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { logger } from '../utils/logger.js';
import { AiService } from './service.js';
import { AiCliOptions } from './types.js';
import { MCPClientManager } from '../client/manager.js';

/**
 * Start AI-powered CLI
 */
export async function runAiCli(mcpClientManager: MCPClientManager, apiKey: string, options: AiCliOptions) {
  // Display welcome message
  logger.info('AI-Powered MCP Client\n========================\n');
  logger.info(`Using OpenAI model: ${options.model || 'gpt-4o-mini'}`);
  logger.info(`Log level: ${logger.getLevel()}`);
  logger.info(`Connected servers: ${mcpClientManager.getClients().size}`);
  logger.error(`Failed connections: ${Object.keys(mcpClientManager.getFailedConnections()).length}`);

  // Initialize spinner
  const spinner = ora('Initializing AI service...').start();

  // Create AI service with multiple clients
  const aiService = new AiService(mcpClientManager, apiKey, options.model || 'gpt-4o-mini');

  try {
    // Get available tools from all connected servers
    spinner.text = 'Loading available tools...';
    logger.debug('Getting available tools...');
    const tools = await aiService.getAvailableTools();
    logger.debug(
      `Received tools: ${tools.map((t) => t.name)}`
    );

    // Update system message with available tools
    aiService.updateSystemMessage(tools);
    spinner.succeed(`Loaded ${tools.length} tools from ${mcpClientManager.getClients().size} MCP servers`);

    // Show available tools (these will only display if debug level is enabled)
    logger.debug('Available tools:');
    tools.forEach((tool, index) => {
      logger.debug(`${index + 1}. ${tool.name}`);
      if (tool.description) {
        logger.debug(`${tool.description}`);
      }
    });

    // Create readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.bold.green('\nWhat would you like to do? '),
    });
    process.stdin.resume();
    rl.prompt();

    // Main interaction loop
    for await (const line of rl) {
      const trimmedInput = line.trim();
      logger.debug(`Received input: "${trimmedInput}"`);

      if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
        logger.warn('Exiting AI CLI. Goodbye!');
        rl.close();
        process.exit(0);
        break;
      }

      try {
        logger.debug('Stopping spinner before processing input.');
        spinner.stop();
        spinner.text = 'AI thinking...';
        logger.debug('Calling aiService.processUserInput()');
        // Process user input with LLM
        let currentResponse = await aiService.processUserInput(trimmedInput, tools);
        logger.debug(`Received AI response: ${JSON.stringify(currentResponse)}`);
        spinner.stop();
        process.stdout.write('\n');

        // Initialize response
        logger.displayAIResponse(currentResponse);

        // Display initial LLM response regardless of whether it contains tool calls
        let toolCallIteration = 0;
        const MAX_TOOL_ITERATIONS = 10; // Prevent infinite loops

        // Process any tool calls and allow for chained tool calling
        // Track if we should continue processing tool calls
        // Continue processing as long as the response has tool calls and we should continue
        while (currentResponse.tool_calls?.length && toolCallIteration < MAX_TOOL_ITERATIONS) {
          // Safety check to prevent infinite loops
          toolCallIteration++;
          logger.debug(`Tool execution cycle ${toolCallIteration} started.`);

          // Collect and parse all tool calls
          const toolCallsToProcess = currentResponse.tool_calls.map((toolCall) => {
            // Extract tool information - use try/catch to handle JSON parsing errors
            let toolName, args, toolCallId;
            try {
              toolName = toolCall.function.name;
              args = JSON.parse(toolCall.function.arguments || '{}');
              toolCallId = toolCall.id;
              logger.debug(`Parsed tool call: ${toolName} with args: ${JSON.stringify(args)}`);
            } catch (error: any) {
              logger.error(
                `Error parsing tool call arguments: ${error.message}`
              );
              toolName = toolCall.function?.name || 'unknown';
              args = {};
              toolCallId = toolCall.id || 'unknown_id';
            }

            // Display tool call information to the user
            logger.toolCall(toolName, args);
            return { toolName, args, toolCallId };
          });

          // Execute all tool calls in parallel
          spinner.text = `Executing ${toolCallsToProcess.length} tools in parallel...`;
          logger.debug('Executing tool calls in parallel...');
          spinner.start();

          // Wait for all tool calls to complete
          const toolResults = await Promise.all(
            toolCallsToProcess.map(async ({ toolName, args, toolCallId }) => {
              try {
                // Call the tool and get the result
                logger.debug(`Calling tool: ${toolName}`);
                const result = await aiService.callTool(toolName, args);
                logger.debug(`Received result from ${toolName}`);
                return { toolName, result, toolCallId, success: true };
              } catch (error: any) {
                // Create an error result object
                logger.error(
                  `Error executing tool ${toolName}: ${error.message}`
                );
                return {
                  toolName,
                  result: {
                    error: true,
                    message: error.message,
                    content: [
                      { type: 'text', text: `Error executing tool ${toolName}: ${error.message}` },
                    ],
                  },
                  toolCallId,
                  success: false,
                  error,
                };
              }
            })
          );
          spinner.stop();

          // Display all results
          toolResults.forEach(({ toolName, result, success, error }) => {
            if (success) {
              // Display successful result
              logger.debug(`Displaying result for ${toolName}`);
              logger.toolResult(result);
            } else {
              // Display error result
              logger.error(`Displaying error for ${toolName}: ${error.message}`);
              logger.error(`${toolName} Error: ${error.message}`);
            }
          });

          // Process all tool results at once
          spinner.text = 'AI analyzing all tool results...';
          logger.debug('Calling aiService.processToolResultsBatch()');
          spinner.start();
          try {
            // Process all results in one batch
            currentResponse = await aiService.processToolResultsBatch(toolResults);
            logger.debug(`Received analysis response: ${JSON.stringify(currentResponse)}`);
            spinner.stop();

            // Update current response to the latest analysis
            // Display the AI's analysis to the user
            logger.displayAIResponse(currentResponse);
          } catch (analysisError: any) {
            // Handle analysis errors
            spinner.fail(`Error during AI analysis: ${analysisError.message}`);
            logger.error(`Error during AI analysis: ${analysisError.message}`);

            // Create a simple recovery message
            logger.displayAIResponse({
              role: 'assistant',
              content: `I encountered an error analyzing the tool results. Let's try a different approach.`,
            });

            // Display the recovery message
            // Exit the tool processing loop
            break;
          }

          // Check if we should continue with the next tool call iteration
        }
      } catch (error: any) {
        spinner.fail(`Error: ${error.message}`);
        logger.error(`Error in processing input: ${error.message}`);
      } finally {
        spinner.stop();
        spinner.clear();
        process.stdout.write('\n');
        logger.debug('About to prompt for next input; resuming stdin.');
        process.stdin.resume();
        // Add a slight delay before prompting to let the event loop catch up.
        await new Promise((resolve) => setTimeout(resolve, 50));
        logger.debug('Prompting for next input...');
        // Prompt for next input
        rl.prompt();
      }
    }
  } catch (error: any) {
    spinner.fail(`Error initializing AI service: ${error.message}`);
    logger.error(`Error during initialization: ${error.message}`);
  }
}
