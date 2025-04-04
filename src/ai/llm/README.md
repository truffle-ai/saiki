# Adding a New LLM Service

This guide explains how to add support for a new Large Language Model (LLM) provider to Saiki. The LLM service architecture is designed to be extensible, allowing you to integrate with different AI providers while maintaining consistent behavior.

## LLM Architecture Overview

Saiki uses an abstraction layer to interact with different LLM providers:

```
                     ┌─────────────┐
                     │ LLM Factory │
                     └──────┬──────┘
                            │
                            ▼
           ┌───────────────────────────────┐
           │        LLM Interface          │
           │      (LLMService type)        │
           └───────────────────────────────┘
                            │
                  ┌─────────┴─────────┐
                  │                   │
          ┌───────▼────────┐  ┌───────▼────────┐
          │  OpenAIService │  │AnthropicService│
          └────────────────┘  └────────────────┘
```

The main components are:

1. **LLM Interface (`LLMService`)** - Defines the contract that all LLM implementations must follow.
2. **Provider Implementations** - Each provider (e.g., OpenAI, Anthropic) has its own implementation.
3. **Factory** - Creates the appropriate service based on configuration.
4. **Tool Helper** - Manages the tools available to the model.

## Step 1: Understand the LLMService Interface

Every LLM implementation must implement the `LLMService` interface defined in `types.ts`:

```typescript
export interface LLMService {
    // Process a user request and return a response
    completeTask(userInput: string, callbacks?: LLMCallbacks): Promise<string>;
    
    // Update the system context with available tools
    updateSystemContext(tools: McpTool[]): void;
    
    // Clear conversation history
    resetConversation(): void;
    
    // Get configuration info
    getConfig(): { provider: string; model: string };
}
```

## Step 2: Create Your Service Implementation

1. Create a new file in the `src/ai/llm` directory (e.g., `your-provider.ts`).
2. Install the necessary SDK for your LLM provider:
   ```bash
   npm install your-provider-sdk
   ```
3. Implement the `LLMService` interface. Here's a template:

```typescript
import YourProviderSDK from 'your-provider-sdk';
import { ClientManager } from '../../client/manager.js';
import { LLMCallbacks, LLMService } from './types.js';
import { McpTool } from '../types.js';
import { ToolHelper } from './tool-helper.js';
import { logger } from '../../utils/logger.js';

export class YourProviderService implements LLMService {
    private client: YourProviderSDK;
    private model: string;
    private toolHelper: ToolHelper;
    private conversationHistory: any[] = [];
    
    constructor(clientManager: ClientManager, apiKey: string, model?: string, options?: any) {
        this.model = model || 'default-model-name';
        this.client = new YourProviderSDK({ apiKey });
        this.toolHelper = new ToolHelper(clientManager);
        
        // Initialize conversation history or state
        // This will vary based on how your provider handles conversations
    }
    
    updateSystemContext(tools: McpTool[]): void {
        // Format tool descriptions for your provider
        // Set system instructions
        // This will depend on how your provider handles system instructions
    }
    
    async completeTask(userInput: string, callbacks?: LLMCallbacks): Promise<string> {
        // 1. Add user input to conversation
        // 2. Get all tools
        // 3. Format tools for your provider
        // 4. Call the provider's API
        // 5. Process tool calls if needed (may require iterations)
        // 6. Return the final response
        
        // Example basic implementation:
        try {
            // Add user message
            this.addUserMessage(userInput);
            
            // Get and format tools
            const rawTools = await this.toolHelper.getAllTools();
            const formattedTools = this.formatToolsForProvider(rawTools);
            
            // Notify that we're processing
            callbacks?.onThinking?.();
            
            // Call the API
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: this.conversationHistory,
                tools: formattedTools,
                // Other provider-specific options
            });
            
            // Handle tool calls if your provider supports them
            // This will often require a loop to handle multiple tool calls
            
            // Extract the response
            const responseText = this.extractResponseText(response);
            
            // Add assistant response to history
            this.addAssistantResponse(response);
            
            // Notify with final response
            callbacks?.onResponse?.(responseText);
            return responseText;
        } catch (error) {
            // Handle API errors
            logger.error(`Error in Your Provider service: ${error}`);
            return `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
    
    resetConversation(): void {
        // Clear conversation history
        // Keep only system messages if applicable
    }
    
    getConfig(): { provider: string; model: string } {
        return {
            provider: 'your-provider-name',
            model: this.model
        };
    }
    
    // Add private helper methods as needed
    private formatToolsForProvider(tools: McpTool[]): any[] {
        // Convert Saiki's tool format to the format expected by your provider
        return tools.map(tool => {
            // Provider-specific transformation
        });
    }
    
    // Other helper methods as needed
}
```

## Step 3: Update the Factory

Modify `factory.ts` to support your new provider:

1. Import your new service class:
   ```typescript
   import { YourProviderService } from './your-provider.js';
   ```

2. Add your provider to the `createLLMService` function:
   ```typescript
   export function createLLMService(
       config: LLMConfig,
       clientManager: ClientManager
   ): LLMService {
       // Extract and validate API key
       const apiKey = extractApiKey(config);
       
       switch (config.provider.toLowerCase()) {
           case 'openai':
               return new OpenAIService(clientManager, apiKey, config.model, config.providerOptions);
           case 'anthropic':
               return new AnthropicService(clientManager, apiKey, config.model, config.providerOptions);
           case 'your-provider-name':
               return new YourProviderService(clientManager, apiKey, config.model, config.providerOptions);
           default:
               throw new Error(`Unsupported LLM provider: ${config.provider}`);
       }
   }
   ```

3. If needed, update the `extractApiKey` function to handle your provider:
   ```typescript
   function extractApiKey(config: LLMConfig): string {
       const provider = config.provider;
       
       // Get API key from config or environment
       let apiKey = config.apiKey || '';
       if (apiKey.startsWith('env:')) {
           // If the API key is specified as an environment variable reference
           const envVarName = apiKey.substring(4);
           apiKey = process.env[envVarName] || '';
       } else {
           // Fall back to environment variables if not in config
           const apiKeyEnvVar = getApiKeyEnvVar(provider);
           apiKey = apiKey || process.env[apiKeyEnvVar] || '';
       }
       
       // ...validation and error handling
       
       return apiKey;
   }
   
   function getApiKeyEnvVar(provider: string): string {
       switch (provider.toLowerCase()) {
           case 'openai': return 'OPENAI_API_KEY';
           case 'anthropic': return 'ANTHROPIC_API_KEY';
           case 'your-provider-name': return 'YOUR_PROVIDER_API_KEY';
           default: return `${provider.toUpperCase()}_API_KEY`;
       }
   }
   ```

## Step 4: Implement Tool Handling

Tools are a critical part of the LLM service. Each provider has its own way of handling tool definitions and tool calls.

Your implementation needs to:

1. Format the tools for your provider's API in `updateSystemContext` and/or in the completion call
2. Process the tool calls from the provider's response
3. Use the `ToolHelper` to execute the tools
4. Handle the results and make them available to the next model request

Study how this is done in `openai.ts` and `anthropic.ts` for examples of different approaches.

## Step 5: Test Your Implementation

1. Update your `mcp.json` configuration to use your new provider:
   ```json
   {
     "llm": {
       "provider": "your-provider-name",
       "model": "your-model-name",
       "apiKey": "env:YOUR_PROVIDER_API_KEY",
       "providerOptions": {
         // Any specific options for your provider
       }
     }
   }
   ```

2. Make sure your API key is set in the environment or `.env` file.

3. Run Saiki and test various tool interactions.

## Tips for Different Providers

### Handling Conversation State

Different LLM providers handle conversation state differently:

- **OpenAI**: Uses an array of message objects with roles
- **Anthropic**: Similar to OpenAI but with slight differences in message structure
- **Others**: May have completely different mechanisms

Adapt your implementation to match your provider's approach.

### System Instructions

Providers also vary in how they handle system instructions:

- **OpenAI**: Supports a dedicated "system" role in messages
- **Anthropic**: Requires prepending system instructions to the first user message
- **Others**: May have specific parameters or different approaches

### Tool Definitions

The format for defining tools varies widely:

- **OpenAI**: Uses a "functions" structure with JSON Schema
- **Anthropic**: Has its own "tools" format
- **Others**: May have different structures or capabilities

You'll need to translate Saiki's tool format to your provider's expected format.

## Example: Implementation Patterns

For inspiration, look at how the existing implementations handle key challenges:

### OpenAI Tool Handling Pattern

```typescript
// 1. Format tools for OpenAI
private formatToolsForOpenAI(tools: McpTool[]): any[] {
    return tools.map(tool => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters || { type: 'object', properties: {} }
        }
    }));
}

// 2. Process tool calls
for (const toolCall of message.tool_calls) {
    const toolName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);
    
    // 3. Execute tool
    const result = await this.toolHelper.executeTool(toolName, args);
    
    // 4. Register result for next iteration
    this.registerToolResult(toolName, result, toolCall.id);
}
```

### Anthropic Tool Handling Pattern

```typescript
// 1. Format tools for Anthropic
private formatToolsForClaude(tools: McpTool[]): any[] {
    return tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        input_schema: tool.parameters || { type: 'object', properties: {} }
    }));
}

// 2. Process tool uses
for (const toolUse of toolUses) {
    const toolName = toolUse.name;
    const args = toolUse.input;
    
    // 3. Execute tool
    const result = await this.toolHelper.executeTool(toolName, args);
    
    // 4. Format result for next iteration
    contentArray.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: resultValue
    });
}
```

By following these patterns and understanding your LLM provider's specific requirements, you can successfully integrate a new AI service into Saiki. 