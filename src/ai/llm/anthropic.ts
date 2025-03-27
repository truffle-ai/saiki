import Anthropic from '@anthropic-ai/sdk';
import { MCPClientManager } from '../../client/manager.js';
import { LLMCallbacks, LLMService } from './types.js';
import { McpTool } from '../types.js';
import { ToolHelper } from './tool-helper.js';
import { logger } from '../../utils/logger.js';

/**
 * Anthropic Claude implementation of LLMService
 * UNTESTED AS OF NOW
 */
export class AnthropicService implements LLMService {
  private anthropic: Anthropic;
  private model: string;
  private toolHelper: ToolHelper;
  private messages: any[] = [];
  private systemContext: string = '';
  
  constructor(mcpClientManager: MCPClientManager, apiKey: string, model?: string, options?: any) {
    this.model = model || 'claude-3-sonnet-20240229';
    this.anthropic = new Anthropic({ apiKey });
    this.toolHelper = new ToolHelper(mcpClientManager);
  }
  
  updateSystemContext(tools: McpTool[]): void {
    // Create a system context string for Claude
    // Claude doesn't use a system message like OpenAI, 
    // but we can prepend this to the first user message
    
    const toolDescriptions = tools
      .map((tool) => {
        let description = `- ${tool.name}: ${tool.description || 'No description provided'}`;
        if (tool.parameters && Object.keys(tool.parameters).length > 0) {
          description += '\n  Parameters:';
          for (const [paramName, param] of Object.entries(tool.parameters)) {
            description += `\n    - ${paramName}: ${param.description || 'No description'} ${param.type ? `(${param.type})` : ''}`;
          }
        }
        return description;
      })
      .join('\n');
      
    this.systemContext = `You are Claude, a helpful AI assistant with access to the following tools:\n\n${toolDescriptions}\n\nUse these tools when appropriate to answer user queries. You can use multiple tools in sequence to solve complex problems. After each tool result, determine if you need more information or can provide a final answer.`;
  }
  
  async completeTask(userInput: string, callbacks?: LLMCallbacks): Promise<string> {
    // Prepend system context to first message or use standalone
    const effectiveUserInput = this.messages.length === 0 
      ? `${this.systemContext}\n\n${userInput}`
      : userInput;
      
    // Add user message
    this.messages.push({ role: 'user', content: effectiveUserInput });
    
    // Get all tools
    const rawTools = await this.toolHelper.getAllTools();
    const formattedTools = this.formatToolsForClaude(rawTools);
    
    // Notify thinking
    callbacks?.onThinking?.();
    
    // Maximum number of tool use iterations
    const MAX_ITERATIONS = 10;
    let iterationCount = 0;
    let fullResponse = '';
    
    try {
      while (iterationCount < MAX_ITERATIONS) {
        iterationCount++;
        
        // Call Claude
        const response = await this.anthropic.messages.create({
          model: this.model,
          messages: this.messages,
          tools: formattedTools,
          max_tokens: 4096
        });
        
        // Extract text content and tool uses
        let textContent = '';
        const toolUses = [];
        
        for (const content of response.content) {
          if (content.type === 'text') {
            textContent += content.text;
          } else if (content.type === 'tool_use') {
            toolUses.push(content);
          }
        }
        
        // Add Claude's response to the conversation
        this.messages.push({
          role: 'assistant',
          content: response.content
        });
        
        // If no tools were used, we're done
        if (toolUses.length === 0) {
          fullResponse += textContent;
          callbacks?.onResponse?.(fullResponse);
          return fullResponse;
        }
        
        // If text content exists, append it to the full response
        if (textContent) {
          fullResponse += textContent + '\n';
        }
        
        // Handle tool uses
        const toolResults = [];
        
        for (const toolUse of toolUses) {
          const toolName = toolUse.name;
          const args = toolUse.input;
          
          // Notify tool call
          callbacks?.onToolCall?.(toolName, args);
          
          // Execute tool
          try {
            const result = await this.toolHelper.executeTool(toolName, args);
            toolResults.push({ toolName, result });
            
            // Notify tool result
            callbacks?.onToolResult?.(toolName, result);
          } catch (error) {
            // Handle tool execution error
            const errorMessage = error instanceof Error ? error.message : String(error);
            toolResults.push({ toolName, error: errorMessage });
            
            callbacks?.onToolResult?.(toolName, { error: errorMessage });
          }
        }
        
        // Add tool results as user messages
        for (const { toolName, result, error } of toolResults) {
          const content = error 
            ? `Tool '${toolName}' failed with error: ${error}`
            : `Tool '${toolName}' returned: ${JSON.stringify(result)}`;
          
          this.messages.push({ role: 'user', content });
        }
        
        // Notify thinking for next iteration
        callbacks?.onThinking?.();
      }
      
      // If we reached max iterations
      callbacks?.onResponse?.(fullResponse);
      return fullResponse || "Reached maximum number of tool call iterations without a final response.";
      
    } catch (error) {
      // Handle API errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error in Anthropic service:', errorMessage);
      
      return `Error: ${errorMessage}`;
    }
  }
  
  resetConversation(): void {
    // Clear all messages
    this.messages = [];
  }
  
  /**
   * Get configuration information about the LLM service
   * @returns Configuration object with provider and model information
   */
  getConfig(): { provider: string; model: string; [key: string]: any } {
    return {
      provider: 'anthropic',
      model: this.model
    };
  }
  
  private formatToolsForClaude(tools: McpTool[]): any[] {
    return tools.map(tool => {
      // Convert tool to Claude tool format
      return {
        name: tool.name,
        description: tool.description || `Tool for ${tool.name}`,
        input_schema: {
          type: 'object',
          properties: Object.entries(tool.parameters || {}).reduce(
            (acc, [name, param]) => {
              let paramType = 'string';
              
              // Convert possible type indicators
              if (param.type?.includes('number')) {
                paramType = 'number';
              } else if (param.type?.includes('boolean')) {
                paramType = 'boolean';
              } else if (param.type?.includes('enum')) {
                paramType = 'string';
                // For enums, we could add an enum field here if needed
              }
              
              acc[name] = {
                type: paramType,
                description: param.description || `The ${name} parameter`,
              };
              return acc;
            },
            {}
          ),
          required: Object.entries(tool.parameters || {})
            .filter(([, param]) => !param.default)
            .map(([name]) => name),
        },
      };
    });
  }
} 