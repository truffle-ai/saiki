import OpenAI from 'openai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpTool } from './types.js';

/**
 * AI Service that orchestrates interactions between LLM and MCP client
 */
export class AiService {
  private openai: OpenAI;
  private client: Client;
  private conversationHistory: any[] = [];
  private model: string;
  
  /**
   * Create a new AI Service
   * @param client MCP Client
   * @param apiKey OpenAI API key
   * @param model OpenAI model to use
   */
  constructor(client: Client, apiKey: string, model: string = 'gpt-4o-mini') {
    this.client = client;
    this.model = model;
    
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || apiKey,
      baseURL: 'https://api.openai.com/v1'
    });
    
    // Initialize conversation history with a basic system message
    // This will be updated with specific tool details when updateSystemMessage is called
    this.conversationHistory.push({
      role: 'system',
      content: 'You are an AI assistant with access to MCP tools. Your job is to help users accomplish their tasks using the available tools. You can chain multiple tools together to solve complex problems. Always analyze each tool result carefully to determine next steps.'
    });
  }

  /**
   * Update the system message with available tools
   * @param tools Available MCP tools
   */
  updateSystemMessage(tools: McpTool[]): void {
    // Create a more detailed system message with tool descriptions
    const toolDescriptions = tools.map(tool => {
      let description = `- ${tool.name}: ${tool.description || 'No description provided'}`;
      if (tool.parameters && Object.keys(tool.parameters).length > 0) {
        description += '\n  Parameters:';
        for (const [paramName, param] of Object.entries(tool.parameters)) {
          description += `\n    - ${paramName}: ${param.description || 'No description'} ${param.type ? `(${param.type})` : ''}`;
        }
      }
      return description;
    }).join('\n');

    // Update the system message with available tools and enhanced guidance
    this.conversationHistory[0].content = `You are an AI assistant with access to MCP tools. Your job is to help users accomplish their tasks by calling appropriate tools.

Available tools:
${toolDescriptions}

Follow these guidelines when using tools:
1. Use tools whenever they can help complete the user's request.
2. You can call multiple tools in sequence to solve complex problems.
3. After each tool returns a result, analyze the result carefully to determine next steps.
4. If the result indicates you need additional information, call another tool to get that information.
5. Continue this process until you have all the information needed to fulfill the user's request.
6. Be concise in your responses, focusing on the task at hand.
7. When presenting tool results to the user, format them in a clear and readable way.
8. If a tool returns an error, try a different approach or ask the user for clarification.

Remember: You can use multiple tool calls in a sequence to solve multi-step problems.`;
  }
  
  /**
   * Format tools for OpenAI function calling
   * @param tools MCP tools
   * @returns OpenAI tools format
   */
  private formatToolsForOpenAI(tools: McpTool[]): any[] {
    return tools.map(tool => {
      // Convert parameters to OpenAI function parameters format
      const parameters: any = {
        type: 'object',
        properties: {},
        required: []
      };

      if (tool.parameters) {
        Object.entries(tool.parameters).forEach(([name, param]) => {
          let paramType = 'string';
          let paramEnum = undefined;

          // Convert Zod types to JSON Schema types
          if (param.type?.includes('number')) {
            paramType = 'number';
          } else if (param.type?.includes('boolean')) {
            paramType = 'boolean';
          } else if (param.type?.includes('enum')) {
            paramType = 'string';
            // Extract enum values if they exist
            const enumMatch = param.type.match(/\[(.*?)\]/);
            if (enumMatch) {
              paramEnum = enumMatch[1].split(',').map(v => v.trim().replace(/["']/g, ''));
            }
          }

          parameters.properties[name] = {
            type: paramType,
            description: param.description || `The ${name} parameter`,
          };

          if (paramEnum) {
            parameters.properties[name].enum = paramEnum;
          }

          // Add to required if no default value
          if (!param.default) {
            parameters.required.push(name);
          }
        });
      }

      return {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description || `Tool for ${tool.name}`,
          parameters: parameters
        }
      };
    });
  }
  
  /**
   * Process user input with OpenAI
   * @param userInput User input
   * @param tools Available MCP tools
   * @returns OpenAI response
   */
  async processUserInput(userInput: string, tools: McpTool[]): Promise<any> {
    try {
      // Format tools for OpenAI function calling
      const openaiTools = this.formatToolsForOpenAI(tools);
      
      // Add user message to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: userInput
      });

      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: this.conversationHistory,
        tools: openaiTools,
        tool_choice: 'auto',
      });

      // Get the response message
      const responseMessage = response.choices[0].message;
      
      // Add response to conversation history
      this.conversationHistory.push(responseMessage);
      
      return responseMessage;
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  }
  
  /**
   * Call an MCP tool
   * @param toolName Tool name
   * @param args Tool arguments
   * @returns Tool result
   */
  async callTool(toolName: string, args: any): Promise<any> {
    return await this.client.callTool({
      name: toolName,
      arguments: args
    });
  }
  
  /**
   * Process tool results with OpenAI
   * @param toolName Tool name
   * @param toolResults Tool results
   * @param toolCallId ID of the tool call (optional)
   * @returns OpenAI response
   */
  /**
   * Process a single tool result with OpenAI
   * @param toolName Tool name
   * @param toolResults Tool results
   * @param toolCallId ID of the tool call (optional)
   * @returns OpenAI response
   */
  async processToolResults(toolName: string, toolResults: any, toolCallId?: string): Promise<any> {
    // Debug the conversation state
    this.logConversationState();
    
    // Create a batch with just this single result
    return this.processToolResultsBatch([{ toolName, result: toolResults, toolCallId }]);
  }
  
  /**
   * Process multiple tool results in a batch with OpenAI
   * @param toolResults Array of tool results
   * @returns OpenAI response
   */
  async processToolResultsBatch(toolResults: Array<{toolName: string, result: any, toolCallId?: string}>): Promise<any> {
    // Debug the conversation state before processing
    this.logConversationState();
    
    console.log(`Processing batch of ${toolResults.length} tool results`);
    
    // Step 1: Register all tool results with their tool call IDs
    for (const { toolName, result, toolCallId } of toolResults) {
      this.registerToolResult(toolName, result, toolCallId);
    }
    
    // Step 2: Ensure all pending tool calls have responses
    this.ensureAllToolCallsHaveResponses();
    
    // Step 3: Validate the conversation structure
    const isValid = this.validateConversationStructure();
    if (!isValid) {
      console.log("Conversation structure is invalid. Attempting repair...");
      this.repairConversationStructure();
    }
    
    // Step 4: Send the conversation to the LLM for analysis
    return this.getAIResponse();
  }
  
  /**
   * Log the current state of the conversation for debugging
   */
  private logConversationState(): void {
    console.log("===== CONVERSATION STATE =====");
    
    // Create a simplified version of the conversation for logging
    const simplifiedConversation = this.conversationHistory.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: msg.role,
          tool_call_id: msg.tool_call_id,
          name: msg.name
        };
      } else if (msg.role === 'assistant' && msg.tool_calls) {
        return {
          role: msg.role,
          tool_calls: msg.tool_calls.map(tc => ({
            id: tc.id,
            name: tc.function.name
          }))
        };
      } else {
        return {
          role: msg.role,
          has_content: Boolean(msg.content)
        };
      }
    });
    
    console.log(JSON.stringify(simplifiedConversation, null, 2));
    console.log("===============================");
  }
  
  /**
   * Validate the conversation structure to ensure it follows OpenAI's requirements
   * @returns true if the conversation is valid, false otherwise
   */
  private validateConversationStructure(): boolean {
    // Check that all tool calls have corresponding tool responses
    const toolCallIds = new Set<string>();
    const toolResponseIds = new Set<string>();
    
    // Gather all tool call IDs
    for (const message of this.conversationHistory) {
      if (message.role === 'assistant' && message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          toolCallIds.add(toolCall.id);
        }
      }
    }
    
    // Gather all tool response IDs
    for (const message of this.conversationHistory) {
      if (message.role === 'tool' && message.tool_call_id) {
        toolResponseIds.add(message.tool_call_id);
      }
    }
    
    // Check for any tool calls without responses
    for (const id of toolCallIds) {
      if (!toolResponseIds.has(id)) {
        console.log(`Missing tool response for tool call ID: ${id}`);
        return false;
      }
    }
    
    // Check for any tool responses without tool calls
    for (const id of toolResponseIds) {
      if (!toolCallIds.has(id)) {
        console.log(`Tool response references non-existent tool call ID: ${id}`);
        return false;
      }
    }
    
    // Make sure assistant messages with tool_calls are followed by tool messages
    for (let i = 0; i < this.conversationHistory.length - 1; i++) {
      const message = this.conversationHistory[i];
      if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
        const nextNonToolCallCount = this.countNonToolMessagesAfter(i);
        if (nextNonToolCallCount > 0) {
          console.log(`Found ${nextNonToolCallCount} non-tool messages after tool calls at index ${i}`);
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Count non-tool messages after a specific index
   * @param index The starting index
   * @returns Number of non-tool messages before the next tool message
   */
  private countNonToolMessagesAfter(index: number): number {
    let count = 0;
    let i = index + 1;
    
    while (i < this.conversationHistory.length) {
      const message = this.conversationHistory[i];
      if (message.role !== 'tool') {
        // Found a non-tool message
        count++;
      } else {
        // Found a tool message, so we can stop counting
        break;
      }
      i++;
    }
    
    return count;
  }
  
  /**
   * Repair the conversation structure if it's invalid
   */
  private repairConversationStructure(): void {
    // First, check for tool responses without valid tool calls
    const validToolCallIds = this.getValidToolCallIds();
    const invalidResponses: number[] = [];
    
    for (let i = 0; i < this.conversationHistory.length; i++) {
      const message = this.conversationHistory[i];
      if (message.role === 'tool' && message.tool_call_id) {
        if (!validToolCallIds.includes(message.tool_call_id)) {
          invalidResponses.push(i);
        }
      }
    }
    
    // Remove invalid tool responses
    for (let i = invalidResponses.length - 1; i >= 0; i--) {
      const index = invalidResponses[i];
      console.log(`Removing invalid tool response at index ${index}`);
      this.conversationHistory.splice(index, 1);
    }
    
    // Next, ensure all tool calls have responses
    this.ensureAllToolCallsHaveResponses();
    
    // Finally, check the structure again
    const isValid = this.validateConversationStructure();
    if (!isValid) {
      // If still invalid, try a more aggressive repair
      console.log("Conversation structure still invalid after repair. Trying more aggressive repair...");
      this.removeLastToolCallSequence();
    }
  }
  
  /**
   * Remove the last sequence of tool calls if the conversation is broken
   */
  private removeLastToolCallSequence(): void {
    // Find the last assistant message with tool calls
    let lastToolCallIndex = -1;
    for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
      const message = this.conversationHistory[i];
      if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
        lastToolCallIndex = i;
        break;
      }
    }
    
    if (lastToolCallIndex === -1) {
      console.log("No tool call messages found to remove");
      return;
    }
    
    // Find all related tool responses
    const toolCallIds = this.conversationHistory[lastToolCallIndex].tool_calls.map(tc => tc.id);
    const relatedIndices: number[] = [lastToolCallIndex];
    
    for (let i = lastToolCallIndex + 1; i < this.conversationHistory.length; i++) {
      const message = this.conversationHistory[i];
      if (message.role === 'tool' && toolCallIds.includes(message.tool_call_id)) {
        relatedIndices.push(i);
      } else if (message.role === 'assistant') {
        // Stop at the next assistant message
        break;
      }
    }
    
    // Remove all related messages in reverse order to avoid index shifting
    for (let i = relatedIndices.length - 1; i >= 0; i--) {
      const index = relatedIndices[i];
      console.log(`Removing problematic message at index ${index}`);
      this.conversationHistory.splice(index, 1);
    }
    
    // Add a recovery message
    this.conversationHistory.push({
      role: 'assistant',
      content: "I ran into an issue processing the previous tool calls. Let's try a different approach. How can I help you?"
    });
  }
  
  /**
   * Register a tool result in the conversation history with proper tool call ID
   * @param toolName Name of the tool that was called
   * @param toolResults Results returned from the tool
   * @param toolCallId Optional explicit tool call ID
   */
  private registerToolResult(toolName: string, toolResults: any, toolCallId?: string): void {
    // First, ensure we only use tool call IDs that exist in the previous message
    const validToolCallIds = this.getValidToolCallIds();
    console.log(`Valid tool call IDs: ${JSON.stringify(validToolCallIds)}`);
    
    // Determine the appropriate tool call ID
    let effectiveToolCallId = null;
    
    // If provided ID is valid, use it
    if (toolCallId && validToolCallIds.includes(toolCallId)) {
      effectiveToolCallId = toolCallId;
      console.log(`Using provided tool call ID: ${effectiveToolCallId}`);
    } 
    // Otherwise try to find a match by tool name
    else {
      // Get pending calls (tool calls without responses)
      const pendingCalls = this.findPendingToolCalls();
      console.log(`Pending tool calls: ${JSON.stringify(pendingCalls.map(c => ({ id: c.id, name: c.name })))}`);
      
      // Try to match by tool name first
      const matchByName = pendingCalls.find(call => call.name === toolName);
      if (matchByName && validToolCallIds.includes(matchByName.id)) {
        effectiveToolCallId = matchByName.id;
        console.log(`Matched tool call by name: ${toolName} → ${effectiveToolCallId}`);
      }
      // If no match by name, use the first pending call if available
      else if (pendingCalls.length > 0) {
        // Make sure we only use valid tool call IDs
        const validPendingCalls = pendingCalls.filter(call => validToolCallIds.includes(call.id));
        if (validPendingCalls.length > 0) {
          effectiveToolCallId = validPendingCalls[0].id;
          console.log(`Using first valid pending call ID: ${effectiveToolCallId}`);
        }
      }
    }
    
    // If we couldn't find a valid tool call ID, we'll need to defer this response
    if (!effectiveToolCallId) {
      console.log(`No valid tool call ID found for ${toolName}. Cannot register tool result yet.`);
      return;
    }
    
    // Format and add the tool result message to conversation history
    const toolResultMessage = {
      role: 'tool',
      tool_call_id: effectiveToolCallId,
      name: toolName,
      content: JSON.stringify(toolResults || { error: "Tool returned null or undefined" })
    };
    
    // Add to conversation history
    this.conversationHistory.push(toolResultMessage);
    console.log(`Successfully registered tool result for: ${toolName} with ID: ${effectiveToolCallId}`);
  }
  
  /**
   * Get all valid tool call IDs from the conversation history
   * @returns Array of valid tool call IDs
   */
  private getValidToolCallIds(): string[] {
    const validIds: string[] = [];
    
    // Find all assistant messages with tool_calls
    for (const message of this.conversationHistory) {
      if (message.role === 'assistant' && message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          validIds.push(toolCall.id);
        }
      }
    }
    
    return validIds;
  }
  
  /**
   * Ensure all pending tool calls in the conversation have corresponding responses
   */
  private ensureAllToolCallsHaveResponses(): void {
    // Find any tool calls that still need responses after our registration
    const pendingCalls = this.findPendingToolCalls();
    
    if (pendingCalls.length > 0) {
      console.log(`Found ${pendingCalls.length} tool calls still needing responses`);
      
      // Add placeholder responses for all remaining pending calls
      for (const call of pendingCalls) {
        console.log(`Adding placeholder response for: ${call.name} (${call.id})`);
        
        this.conversationHistory.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.name,
          content: JSON.stringify({
            status: "placeholder",
            message: "This tool call was acknowledged but not fully processed"
          })
        });
      }
      
      // Verify that we've handled all pending calls
      const stillPending = this.findPendingToolCalls();
      if (stillPending.length > 0) {
        console.warn(`WARNING: Still have ${stillPending.length} pending tool calls after fixes`);
      } else {
        console.log('All tool calls now have responses');
      }
    } else {
      console.log('No pending tool calls - all are properly responded to');
    }
  }
  
  /**
   * Get a response from the AI based on the current conversation history
   * @returns The AI's response message
   */
  private async getAIResponse(): Promise<any> {
    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    
    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      
      try {
        console.log(`API call attempt ${attempts}...`);
        
        // Find available tools to offer to the model
        const availableTools = this.findAvailableTools();
        
        // Call OpenAI API 
        const response = await this.openai.chat.completions.create({
          model: this.model,
          messages: this.conversationHistory,
          tools: attempts === 1 ? availableTools : [], // Only offer tools on first attempt
          tool_choice: attempts === 1 ? 'auto' : 'none', // Disable tool choice on retry
        });
        
        // Get and add the response to conversation history
        const responseMessage = response.choices[0].message;
        this.conversationHistory.push(responseMessage);
        
        console.log("API call successful");
        return responseMessage;
      } catch (error) {
        console.error(`API call attempt ${attempts} failed:`, error.message);
        
        if (error.message && error.message.includes('not found in \'tool_calls\'')) {
          // Handle specific error case for invalid tool call IDs
          this.handleInvalidToolCallError(error);
        } else if (error.message && error.message.includes('tool_call_ids did not have response messages')) {
          // Handle missing tool response error
          this.handleMissingToolResponseError(error);
        } else {
          // For other errors, if we're at max attempts, return a fallback
          if (attempts >= MAX_ATTEMPTS) {
            console.log("Max retry attempts reached, returning fallback message");
            return this.createRecoveryMessage();
          }
        }
        
        // For retry, simplify the conversation by removing tool calls
        if (attempts < MAX_ATTEMPTS) {
          this.simplifyConversationForRetry();
        }
      }
    }
    
    // If we get here, all attempts failed
    return this.createRecoveryMessage();
  }
  
  /**
   * Handle invalid tool call ID error
   * @param error The error containing invalid tool call ID information
   */
  private handleInvalidToolCallError(error: any): void {
    // Extract the invalid tool call ID from the error message
    const invalidIdMatch = error.message.match(/'tool_call_id' of '([^']+)' not found/);
    if (!invalidIdMatch) {
      console.error('Could not parse invalid tool call ID from error');
      return;
    }
    
    const invalidId = invalidIdMatch[1];
    console.log(`Found invalid tool call ID: ${invalidId}`);
    
    // Find and remove the invalid tool response
    for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
      const message = this.conversationHistory[i];
      if (message.role === 'tool' && message.tool_call_id === invalidId) {
        console.log(`Removing invalid tool response at index ${i}`);
        this.conversationHistory.splice(i, 1);
      }
    }
  }
  
  /**
   * Handle missing tool response error
   * @param error The error containing missing tool response information
   */
  private handleMissingToolResponseError(error: any): void {
    // Extract the missing tool call ID from the error message
    const missingIdMatch = error.message.match(/tool_call_ids did not have response messages: ([a-zA-Z0-9_]+)/);
    if (!missingIdMatch) {
      console.error('Could not parse missing tool call ID from error');
      return;
    }
    
    const missingId = missingIdMatch[1];
    console.log(`Found missing tool response ID: ${missingId}`);
    
    // Add a placeholder response for this tool call
    this.conversationHistory.push({
      role: 'tool',
      tool_call_id: missingId,
      name: 'emergency_recovery',
      content: JSON.stringify({ 
        status: "error_recovery", 
        message: "This tool call response was missing and has been auto-generated"
      })
    });
  }
  
  /**
   * Simplify the conversation for retry attempts
   */
  private simplifyConversationForRetry(): void {
    // Get the last user message index
    let lastUserIndex = -1;
    for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
      if (this.conversationHistory[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }
    
    if (lastUserIndex === -1) {
      console.log("No user message found for simplification");
      return;
    }
    
    // Remove everything after the last user message except one assistant response
    if (lastUserIndex < this.conversationHistory.length - 1) {
      // Keep one simple assistant response after the user message
      const responseMessage = {
        role: 'assistant',
        content: "I'm working on your request. Let me think about this differently."
      };
      
      // Truncate the conversation after the user message
      this.conversationHistory = [
        ...this.conversationHistory.slice(0, lastUserIndex + 1),
        responseMessage
      ];
      
      console.log("Simplified conversation for retry");
    }
  }
  
  /**
   * Handle errors that occur when getting an AI response
   * @param error The error that was thrown
   * @returns A fallback response message
   */
  private handleAIResponseError(error: any): any {
    console.error('Error getting AI response:', error);
    
    // Handle specific case of missing tool call responses
    if (error.message && error.message.includes('tool_call_ids did not have response messages')) {
      return this.handleMissingToolCallError(error);
    }
    
    // Generic fallback for other errors
    const fallbackResponse = {
      role: 'assistant',
      content: `I encountered an error analyzing the tool results. Let me try a different approach.`
    };
    
    this.conversationHistory.push(fallbackResponse);
    return fallbackResponse;
  }
  
  /**
   * Special handling for the "missing tool call responses" error
   * @param error The error containing missing tool call ID information
   * @returns A recovery response message
   */
  private handleMissingToolCallError(error: any): any {
    // Extract the missing tool call ID from the error message
    const missingIdMatch = error.message.match(/tool_call_ids did not have response messages: ([a-zA-Z0-9_]+)/);
    if (!missingIdMatch) {
      console.error('Could not parse missing tool call ID from error:', error.message);
      return this.createRecoveryMessage();
    }
    
    const missingId = missingIdMatch[1];
    console.log(`Found missing tool call ID: ${missingId}`);
    
    // Add an emergency response for this specific ID
    this.conversationHistory.push({
      role: 'tool',
      tool_call_id: missingId,
      name: 'emergency_recovery',
      content: JSON.stringify({ 
        status: "error_recovery", 
        message: "This tool call response was missing and has been auto-generated"
      })
    });
    
    // Try once more with the fixed history
    try {
      const retryPromise = this.openai.chat.completions.create({
        model: this.model,
        messages: this.conversationHistory,
        tools: [] // No tools to avoid more calls
      });
      
      const recoveryMessage = {
        role: 'assistant',
        content: "I had a problem with one of the tool results, but I've fixed it. How else can I help you?"
      };
      
      this.conversationHistory.push(recoveryMessage);
      return recoveryMessage;
    } catch (retryError) {
      console.error('Retry failed after fixing missing tool call:', retryError);
      return this.createRecoveryMessage();
    }
  }
  
  /**
   * Create a generic recovery message for error conditions
   * @returns A recovery response message
   */
  private createRecoveryMessage(): any {
    const recoveryMessage = {
      role: 'assistant',
      content: "I encountered a technical issue, but I'm still here to help. What would you like me to do next?"
    };
    
    this.conversationHistory.push(recoveryMessage);
    return recoveryMessage;
  }
  
  /**
   * Find all available tools from the most recent message with tools
   * @returns Array of available tools in OpenAI format
   */
  private findAvailableTools(): any[] {
    for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
      if (this.conversationHistory[i].tools) {
        return this.conversationHistory[i].tools;
      }
    }
    return [];
  }
  
  /**
   * Find all pending tool calls that need responses
   * @returns Array of pending tool calls with their IDs and names
   */
  private findPendingToolCalls(): Array<{id: string, name: string}> {
    const pendingCalls: Array<{id: string, name: string}> = [];
    const respondedIds = new Set<string>();
    
    // First, collect all tool response IDs
    for (const message of this.conversationHistory) {
      if (message.role === 'tool' && message.tool_call_id) {
        respondedIds.add(message.tool_call_id);
      }
    }
    
    // Then find all tool calls that don't have responses
    for (const message of this.conversationHistory) {
      if (message.role === 'assistant' && message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          if (!respondedIds.has(toolCall.id)) {
            pendingCalls.push({
              id: toolCall.id,
              name: toolCall.function.name
            });
          }
        }
      }
    }
    
    return pendingCalls;
  }
  
  /**
   * Get all available tools from the client
   * @returns Available MCP tools
   */
  async getAvailableTools(): Promise<McpTool[]> {
    const toolsResult = await this.client.listTools();
    return toolsResult.tools as McpTool[];
  }
  
  /**
   * Clear conversation history
   */
  clearConversation(): void {
    // Reset conversation history to just the system message
    const systemMessage = this.conversationHistory[0];
    this.conversationHistory = [systemMessage];
  }
}