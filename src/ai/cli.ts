import readline from 'readline';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { AiService } from './service.js';
import { McpConnection } from '../client/connection.js';
import { AiCliOptions, McpTool } from './types.js';

/**
 * Format and display tool call
 */
function displayToolCall(toolName: string, args: any) {
  console.log(
    boxen(
      `${chalk.cyan('Tool Call')}: ${chalk.yellow(toolName)}\n${chalk.dim('Arguments')}:\n${chalk.white(JSON.stringify(args, null, 2))}`,
      { padding: 1, borderColor: 'blue', title: '🔧 Tool Call', titleAlignment: 'center' }
    )
  );
}

/**
 * Format and display tool result
 */
function displayToolResult(result: any) {
  let displayText = '';
  let isError = false;
  let borderColor = 'green';
  let title = '✅ Tool Result';
  
  // Check if result indicates an error 
  if (result?.error || result?.isError) {
    isError = true;
    borderColor = 'yellow';
    title = '⚠️ Tool Result (Error)';
  }
  
  // Handle different result formats
  if (result?.content && Array.isArray(result.content)) {
    // Standard MCP format with content array
    result.content.forEach((item: any) => {
      if (item.type === 'text') {
        displayText += item.text;
      } else if (item.type === 'image' && item.url) {
        displayText += `[Image: ${item.url}]`;
      } else if (item.type === 'markdown') {
        displayText += item.markdown;
      } else {
        displayText += `[Unsupported content type: ${item.type}]`;
      }
      displayText += '\n';
    });
  } else if (result?.message) {
    // Error message format
    displayText = result.message;
    isError = true;
    borderColor = 'red';
    title = '❌ Tool Error';
  } else if (typeof result === 'string') {
    // Plain string response
    displayText = result;
  } else {
    // Fallback for any other format
    try {
      displayText = JSON.stringify(result, null, 2);
    } catch {
      displayText = `[Unparseable result: ${typeof result}]`;
    }
  }
  
  // Format empty results
  if (!displayText || displayText.trim() === '') {
    displayText = '[Empty result]';
  }
  
  // Apply color based on error status
  const textColor = isError ? chalk.yellow : chalk.green;
  console.log(
    boxen(textColor(displayText), { padding: 1, borderColor, title, titleAlignment: 'center' })
  );
}

/**
 * Format and display LLM response
 */
function displayLlmResponse(response: any) {
  if (response.content) {
    console.log(
      boxen(chalk.white(response.content), {
        padding: 1,
        borderColor: 'yellow',
        title: '🤖 AI Response',
        titleAlignment: 'center'
      })
    );
  } else {
    console.log(chalk.yellow('AI is thinking...'));
  }
}

/**
 * Start AI-powered CLI
 */
export async function startAiCli(connection: McpConnection, apiKey: string, options: AiCliOptions) {
  // Display welcome message
  console.log(chalk.bold.cyan('\nAI-Powered MCP Client\n========================\n'));
  console.log(chalk.gray('Using OpenAI model:'), chalk.green(options.model));
  console.log(chalk.gray('Verbose mode:'), options.verbose ? chalk.green('On') : chalk.red('Off'));
  console.log('');

  // Initialize spinner
  const spinner = ora('Initializing AI service...').start();

  // Get MCP client from connection
  const client = connection.getClient();
  if (!client) {
    spinner.fail('No active MCP client connection');
    console.error('[DEBUG] Client is null. Exiting.');
    return;
  }

  // Create AI service
  const aiService = new AiService(client, apiKey, options.model);

  try {
    // Get available tools
    spinner.text = 'Loading available tools...';
    console.log('[DEBUG] Getting available tools...');
    const tools = await aiService.getAvailableTools();
    console.log('[DEBUG] Received tools:', tools.map(t => t.name));
    
    // Update system message with available tools
    aiService.updateSystemMessage(tools);
    spinner.succeed(`Loaded ${tools.length} tools from MCP server`);

    if (options.verbose) {
      console.log(chalk.gray('\nAvailable tools:'));
      tools.forEach((tool, index) => {
        console.log(chalk.gray(`  ${index + 1}. ${chalk.yellow(tool.name)}`));
        if (tool.description) {
          console.log(chalk.gray(`     ${tool.description}`));
        }
      });
      console.log('');
    }

    // Create readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.bold.green('\nWhat would you like to do? ')
    });
    process.stdin.resume();
    rl.prompt();

    // Main interaction loop
    for await (const line of rl) {
      const trimmedInput = line.trim();
      console.log(`[DEBUG] Received input: "${trimmedInput}"`);

      if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
        console.log(chalk.yellow('\nExiting AI CLI. Goodbye!'));
        rl.close();
        process.exit(0);
        break;
      }

      try {
        console.log('[DEBUG] Stopping spinner before processing input.');
        spinner.stop();
        spinner.text = 'AI thinking...';
        console.log('[DEBUG] Calling aiService.processUserInput()');
        // Process user input with LLM
        let currentResponse = await aiService.processUserInput(trimmedInput, tools);
        console.log('[DEBUG] Received AI response:', currentResponse);
        spinner.stop();
        process.stdout.write('\n');
        
        // Initialize response
        displayLlmResponse(currentResponse);

        // Display initial LLM response regardless of whether it contains tool calls
        let toolCallIteration = 0;
        const MAX_TOOL_ITERATIONS = 10; // Prevent infinite loops

        // Process any tool calls and allow for chained tool calling
        // Track if we should continue processing tool calls
        // Continue processing as long as the response has tool calls and we should continue
        while (currentResponse.tool_calls?.length && toolCallIteration < MAX_TOOL_ITERATIONS) {
          // Safety check to prevent infinite loops
          toolCallIteration++;
          console.log(chalk.gray(`[DEBUG] Tool execution cycle ${toolCallIteration} started.`));

          // Collect and parse all tool calls
          const toolCallsToProcess = currentResponse.tool_calls.map(toolCall => {
            // Extract tool information - use try/catch to handle JSON parsing errors
            let toolName, args, toolCallId;
            try {
              toolName = toolCall.function.name;
              args = JSON.parse(toolCall.function.arguments || '{}');
              toolCallId = toolCall.id;
              console.log(`[DEBUG] Parsed tool call: ${toolName} with args:`, args);
            } catch (error: any) {
              console.error(chalk.red(`[DEBUG] Error parsing tool call arguments: ${error.message}`));
              toolName = toolCall.function?.name || 'unknown';
              args = {};
              toolCallId = toolCall.id || 'unknown_id';
            }
            
            // Display tool call information to the user
            displayToolCall(toolName, args);
            return { toolName, args, toolCallId };
          });

          // Execute all tool calls in parallel
          spinner.text = `Executing ${toolCallsToProcess.length} tools in parallel...`;
          console.log('[DEBUG] Executing tool calls in parallel...');
          spinner.start();

          // Wait for all tool calls to complete
          const toolResults = await Promise.all(
            toolCallsToProcess.map(async ({ toolName, args, toolCallId }) => {
              try {
                // Call the tool and get the result
                console.log(`[DEBUG] Calling tool: ${toolName}`);
                const result = await aiService.callTool(toolName, args);
                console.log(`[DEBUG] Received result from ${toolName}`);
                return { toolName, result, toolCallId, success: true };
              } catch (error: any) {
                // Create an error result object
                console.error(chalk.red(`[DEBUG] Error executing tool ${toolName}: ${error.message}`));
                return {
                  toolName,
                  result: {
                    error: true,
                    message: error.message,
                    content: [{ type: 'text', text: `Error executing tool ${toolName}: ${error.message}` }]
                  },
                  toolCallId,
                  success: false,
                  error
                };
              }
            })
          );
          spinner.stop();

          // Display all results
          toolResults.forEach(({ toolName, result, success, error }) => {
            if (success) {
              // Display successful result
              console.log(`[DEBUG] Displaying result for ${toolName}`);
              displayToolResult(result);
            } else {
              // Display error result
              console.error(`[DEBUG] Displaying error for ${toolName}: ${error.message}`);
              console.log(
                boxen(
                  chalk.red(`Error: ${error.message}`),
                  { padding: 1, borderColor: 'red', title: `❌ ${toolName} Error`, titleAlignment: 'center' }
                )
              );
            }
          });

          // Process all tool results at once
          spinner.text = 'AI analyzing all tool results...';
          console.log('[DEBUG] Calling aiService.processToolResultsBatch()');
          spinner.start();
          try {
            // Process all results in one batch
            currentResponse = await aiService.processToolResultsBatch(toolResults);
            console.log('[DEBUG] Received analysis response:', currentResponse);
            spinner.stop();
            
            // Update current response to the latest analysis
            // Display the AI's analysis to the user
            displayLlmResponse(currentResponse);
          } catch (analysisError: any) {
            // Handle analysis errors
            spinner.fail(`Error during AI analysis: ${analysisError.message}`);
            console.error('[DEBUG] Error during AI analysis:', analysisError);
            
            // Create a simple recovery message
            displayLlmResponse({
              role: 'assistant',
              content: `I encountered an error analyzing the tool results. Let's try a different approach.`
            });
            
            // Display the recovery message
            // Exit the tool processing loop
            break;
          }

          // Check if we should continue with the next tool call iteration
        }
      } catch (error: any) {
        spinner.fail(`Error: ${error.message}`);
        console.error('[DEBUG] Error in processing input:', error);
      } finally {
        spinner.stop();
        spinner.clear();
        process.stdout.write('\n');
        console.log('[DEBUG] About to prompt for next input; resuming stdin.');
        process.stdin.resume();
        // Add a slight delay before prompting to let the event loop catch up.
        await new Promise(resolve => setTimeout(resolve, 50));
        console.log('[DEBUG] Prompting for next input...');
        // Prompt for next input
        rl.prompt();
      }
    }
  } catch (error: any) {
    spinner.fail(`Error initializing AI service: ${error.message}`);
    console.error('[DEBUG] Error during initialization:', error);
  }
}
