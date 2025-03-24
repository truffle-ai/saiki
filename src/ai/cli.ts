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
      } else if (item.type === 'image') {
        displayText += `[Image data: ${item.mimeType}]`;
      } else if (item.type === 'resource') {
        displayText += `[Resource: ${item.resource?.uri || 'unknown'}]`;
        if (item.resource?.text) {
          displayText += `\n${item.resource.text.substring(0, 500)}${item.resource.text.length > 500 ? '...' : ''}`;
        }
      } else {
        displayText += JSON.stringify(item, null, 2);
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
    } catch (error) {
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
    boxen(
      textColor(displayText),
      { padding: 1, borderColor, title, titleAlignment: 'center' }
    )
  );
}

/**
 * Format and display LLM response
 */
function displayLlmResponse(response: any) {
  if (response.content) {
    console.log(
      boxen(
        chalk.white(response.content),
        { padding: 1, borderColor: 'yellow', title: '🤖 AI Response', titleAlignment: 'center' }
      )
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
    return;
  }
  
  // Create AI service
  const aiService = new AiService(client, apiKey, options.model);
  
  try {
    // Get available tools
    spinner.text = 'Loading available tools...';
    const tools = await aiService.getAvailableTools();
    
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
      output: process.stdout
    });
    
    // Main interaction loop
    async function promptUser() {
      rl.question(chalk.bold.green('\nWhat would you like to do? '), async (input) => {
        if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
          console.log(chalk.yellow('\nExiting AI CLI. Goodbye!'));
          rl.close();
          process.exit(0);
          return;
        }
        
        try {
          // Process user input with LLM
          spinner.text = 'AI thinking...';
          spinner.start();
          const aiResponse = await aiService.processUserInput(input, tools);
          spinner.stop();
          
          // Initialize response
          let currentResponse = aiResponse;

          // Display initial LLM response regardless of whether it contains tool calls
          displayLlmResponse(currentResponse);
          
          // Process any tool calls and allow for chained tool calling
          let toolCallIteration = 0;
          const MAX_TOOL_ITERATIONS = 10; // Prevent infinite loops
          
          // Track if we should continue processing tool calls
          let continueToolProcessing = true;
          
          // Continue processing as long as the response has tool calls and we should continue
          while (currentResponse.tool_calls && currentResponse.tool_calls.length > 0 && continueToolProcessing) {
            // Safety check to prevent infinite loops
            if (toolCallIteration >= MAX_TOOL_ITERATIONS) {
              console.log(chalk.yellow(`\nReached maximum tool call iterations (${MAX_TOOL_ITERATIONS}). Stopping to prevent potential infinite loop.`));
              continueToolProcessing = false;
              break;
            }
            
            toolCallIteration++;
            console.log(chalk.gray(`\n[Tool execution cycle ${toolCallIteration}]`));
            
            // Collect and parse all tool calls
            const toolCallsToProcess = currentResponse.tool_calls.map(toolCall => {
              // Extract tool information - use try/catch to handle JSON parsing errors
              let toolName, args, toolCallId;
              try {
                toolName = toolCall.function.name;
                args = JSON.parse(toolCall.function.arguments || '{}');
                toolCallId = toolCall.id;
              } catch (parseError) {
                console.error(chalk.red(`Error parsing tool call arguments: ${parseError.message}`));
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
            spinner.start();
            
            const toolResultPromises = toolCallsToProcess.map(async ({ toolName, args, toolCallId }) => {
              try {
                // Call the tool and get the result
                const result = await aiService.callTool(toolName, args);
                return { toolName, result, toolCallId, success: true };
              } catch (error) {
                // Create an error result object
                const errorResult = { 
                  error: true, 
                  message: error.message, 
                  content: [{ type: 'text', text: `Error executing tool ${toolName}: ${error.message}` }]
                };
                return { toolName, result: errorResult, toolCallId, success: false, error };
              }
            });
            
            // Wait for all tool calls to complete
            const toolResults = await Promise.all(toolResultPromises);
            spinner.stop();
            
            // Display all results
            toolResults.forEach(({ toolName, result, success, error }) => {
              if (success) {
                // Display successful result
                displayToolResult(result);
              } else {
                // Display error result
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
            spinner.start();
            
            try {
              // Process all results in one batch
              const analysisResponse = await aiService.processToolResultsBatch(toolResults);
              spinner.stop();
              
              // Update current response to the latest analysis
              currentResponse = analysisResponse;
              
              // Display the AI's analysis to the user
              displayLlmResponse(analysisResponse);
            } catch (analysisError) {
              // Handle analysis errors
              spinner.fail(`Error during AI analysis: ${analysisError.message}`);
              
              // Create a simple recovery message
              currentResponse = {
                role: 'assistant',
                content: `I encountered an error analyzing the tool results. Let's try a different approach.`
              };
              
              // Display the recovery message
              displayLlmResponse(currentResponse);
              
              // Exit the tool processing loop
              currentResponse = {}; // Clear any tool calls
              break;
            }
            
            // Check if we should continue with the next tool call iteration
            if (!continueToolProcessing) {
              break;
            }
          }
          
          // Prompt for next input
          promptUser();
        } catch (error) {
          spinner.fail(`Error: ${error.message}`);
          promptUser();
        }
      });
    }
    
    // Start interaction loop
    console.log(chalk.bold.greenBright('\nReady! Ask me anything or type "exit" to quit.\n'));
    promptUser();
  } catch (error) {
    spinner.fail(`Error initializing AI service: ${error.message}`);
  }
}