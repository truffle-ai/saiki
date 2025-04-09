# Adding a New LLM Service

This guide explains how to add support for a new Large Language Model (LLM) provider to Saiki. The LLM service architecture is designed to be extensible, allowing you to integrate with different AI providers while maintaining consistent behavior.

## LLM Architecture Overview

Saiki uses an abstraction layer to interact with different LLM providers:

```
+-----------------+      +---------------------+      +---------------------+
|  Client Manager |----->|     LLM Factory     |<-----|       Config        |
| (Tool Execution)|      +----------+----------+      +---------------------+
+--------+--------+                 |
         |                         ▼
         |        +----------------------------------+
         |        |         LLM Interface            |
         +------->|       (ILLMService type)         |
                  +-----------------+----------------+
                                    |
                      +-------------+-------------+
                      |                           |
            +---------▼----------+     +----------▼---------+
            |   OpenAIService    |     |  AnthropicService  |  ... (Other Providers)
            | (Uses MessageMgr)  |     | (Uses MessageMgr)  |
            +--------------------+     +--------------------+
```

The main components are:

1.  **LLM Interface (`ILLMService`)** - Defines the contract that all LLM implementations must follow. It handles task completion, context updates, conversation state, and event emission.
2.  **Provider Implementations** - Each provider (e.g., OpenAI, Anthropic) has its own implementation of `ILLMService`. These services interact with the provider's specific API.
3.  **Factory (`factory.ts`)** - Creates the appropriate service (`OpenAIService`, `AnthropicService`, etc.) based on configuration (`LLMConfig`). It also handles API key extraction and can optionally create services compatible with the Vercel AI SDK.
4.  **Client Manager (`client/manager.ts`)** - Manages the available tools (getting definitions, executing them). LLM services use the `ClientManager` to get tool information and execute tool calls requested by the LLM.
5.  **Message Manager (`messages/manager.ts`)** - Manages the conversation history, formats messages according to the provider's requirements (using specific formatters), handles system prompts, applies compression strategies, and manages token limits. Each LLM service instance typically has its own `MessageManager`.
6.  **Event Emitter (`EventEmitter`)** - Used by LLM services to emit events during the task completion lifecycle (e.g., `thinking`, `toolCall`, `toolResult`, `response`, `error`). This allows other parts of the application to react to the LLM's progress.


## Overview of Implementation Steps

Adding a new LLM provider involves these main steps:

1.  **Choose LLM & Install SDK:** Select the provider and install its Node.js/TypeScript SDK.
2.  **Implement/Select Formatter:** Ensure a message formatter (`IMessageFormatter`) exists for the provider's API structure.
3.  **Implement/Select Tokenizer & Utilities:** Ensure a tokenizer (`ITokenizer`) and token limit information (`getMaxTokens`) are available for the chosen model(s).
4.  **Choose/Implement Compression Strategy(ies):** Decide which context compression strategies (`ICompressionStrategy`) the `MessageManager` should use if the token limit is exceeded.
5.  **Create `ILLMService` Implementation:** Build the core service class, integrating the SDK, `MessageManager`, `ClientManager`, and handling the API interaction logic.
6.  **Update Factory:** Modify the `factory.ts` to recognize and instantiate your new service.
7.  **Test:** Configure and run Saiki to test your new provider integration.

Let's look at each step in more detail.

## Step 1: Choose LLM & Install SDK

*   Select the Large Language Model provider you want to integrate (e.g., Google Gemini, Cohere, Mistral).
*   Find and install their official Node.js/TypeScript SDK:
    ```bash
    npm install @provider/sdk-library
    ```

## Step 2: Implement/Select Message Formatter (`IMessageFormatter`)

*   **Role:** Translates Saiki's internal message history (`InternalMessage[]`) into the specific array format required by your chosen LLM provider's API.
*   **Location:** `src/ai/llm/messages/formatters/`
*   **Action:**
    *   Check if a suitable formatter already exists (e.g., `OpenAIMessageFormatter`, `AnthropicMessageFormatter`).
    *   If not, create a new class (e.g., `YourProviderMessageFormatter.ts`) that implements the `IMessageFormatter` interface from `./types.ts`.
    *   Implement the `formatMessages` method to perform the required transformation based on the provider's API documentation (e.g., mapping roles, handling content types).
    *   Implement `formatSystemPrompt` if the provider handles system prompts separately from the main message list.

## Step 3: Implement/Select Tokenizer (`ITokenizer`) & Utilities

*   **Role:** Counts tokens in text according to the specific model's tokenization scheme. This is crucial for the `MessageManager` to manage the context window and apply compression strategies when the token limit is exceeded.
*   **Location:** `src/ai/llm/tokenizer/`
*   **Action:**
    1.  **Check/Add Tokenizer Logic:** Find a library or method (often part of the provider's SDK) to count tokens for your model. Integrate this into the `createTokenizer` function in `factory.ts` if possible, associating it with your provider name (e.g., `'your-provider-name'`). Alternatively, you can directly instantiate the tokenizer within your service constructor.
    2.  **Update `getMaxTokens`:** Add your model's maximum context window size (token limit) to the `getMaxTokens` function in `utils.ts`. This allows the system to calculate appropriate limits for `MessageManager`.
    *   Ensure your tokenizer implementation conforms to the `ITokenizer` interface from `./types.ts` (primarily the `countTokens(text: string): number` method).

## Step 4: Choose/Implement Compression Strategy(ies) (`ICompressionStrategy`)

*   **Role:** Defines how the `MessageManager` should reduce the token count of the conversation history when it exceeds the `maxTokens` limit. Strategies are applied sequentially until the history fits.
*   **Location:** `src/ai/llm/messages/compression/`
*   **Action:**
    *   Review the existing strategies: `OldestRemovalStrategy.ts` (removes oldest messages) and `MiddleRemovalStrategy.ts` (attempts to remove messages between the first user message and the latest messages).
    *   Decide which strategy or sequence of strategies is appropriate for your provider/use case. The default sequence used by `MessageManager` is `[MiddleRemovalStrategy, OldestRemovalStrategy]`.
    *   If necessary, implement a custom strategy by creating a class that implements the `ICompressionStrategy` interface from `./types.ts`, defining the `compress(messages: InternalMessage[], maxTokens: number, tokenizer: ITokenizer): InternalMessage[]` method.
    *   You will pass your chosen strategy instance(s) to the `MessageManager` constructor in the next step.

## Step 5: Create `ILLMService` Implementation

This is the core step where you tie everything together.

1.  **Create the Service File:** Create `src/ai/llm/services/your-provider.ts`.
2.  **Implement the Class:**

```typescript
import YourProviderSDK from '@provider/sdk-library'; // Your provider's SDK
import { ClientManager } from '../../../client/manager.js';
import { ILLMService } from './types.js';
import { ToolSet } from '../../types.js';
import { logger } from '../../../utils/logger.js';
import { EventEmitter } from 'events';
import { MessageManager } from '../messages/manager.js';
import { YourProviderMessageFormatter } from '../messages/formatters/your-provider.js'; // Your formatter
import { createTokenizer } from '../tokenizer/factory.js'; // Or direct tokenizer import
import { ITokenizer } from '../tokenizer/types.js';
import { getMaxTokens } from '../tokenizer/utils.js';
import { ICompressionStrategy } from '../messages/compression/types.js';
import { OldestRemovalStrategy, MiddleRemovalStrategy } from '../messages/compression/index.js'; // Example strategies

export class YourProviderService implements ILLMService {
    private providerClient: YourProviderSDK; // Provider SDK instance
    private model: string;
    private clientManager: ClientManager; // Passed in from factory
    private messageManager: MessageManager; // Manages history, formatting, compression
    private eventEmitter: EventEmitter; // For emitting lifecycle events
    private tokenizer: ITokenizer; // Tokenizer instance

    constructor(
        clientManager: ClientManager, // Provided by factory
        systemPrompt: string,      // Provided by factory from config
        apiKey: string,          // Provided by factory
        model?: string,           // Provided by factory from config
        // Optionally pass specific compression strategies if not using default
        compressionStrategies: ICompressionStrategy[] = [
            new MiddleRemovalStrategy(), 
            new OldestRemovalStrategy()
        ] 
    ) {
        this.model = model || 'default-your-provider-model';
        this.providerClient = new YourProviderSDK({ apiKey });
        this.clientManager = clientManager;
        this.eventEmitter = new EventEmitter();

        // --- Initialize Tokenizer ---
        // Preferably use the factory
        this.tokenizer = createTokenizer('your-provider-name', this.model); 
        // Alternatively: Instantiate directly if not using factory
        // this.tokenizer = new YourSpecificTokenizerLibrary(); 

        // --- Initialize Message Manager ---
        const formatter = new YourProviderMessageFormatter();
        const rawMaxTokens = getMaxTokens('your-provider-name', this.model);
        const maxTokensWithMargin = Math.floor(rawMaxTokens * 0.9); // Safety margin

        this.messageManager = new MessageManager(
            formatter,
            systemPrompt,
            maxTokensWithMargin,
            this.tokenizer, // Pass the instantiated tokenizer
            compressionStrategies // Pass chosen compression strategies
        );

        logger.info(`Initialized YourProviderService with model ${this.model}`);
    }

    // --- Implement ILLMService Methods ---

    getEventEmitter(): EventEmitter {
        return this.eventEmitter;
    }

    getAllTools(): Promise<ToolSet> {
        return this.clientManager.getAllTools();
    }

    updateSystemContext(newSystemPrompt: string): void {
        this.messageManager.setSystemPrompt(newSystemPrompt);
        logger.debug('System context updated.');
    }
    
    resetConversation(): void {
        this.messageManager.reset();
        this.eventEmitter.emit('conversationReset');
        logger.debug('Conversation reset.');
    }
    
    getConfig(): { provider: string; model: string; [key: string]: any } {
        const configuredMaxTokens = (this.messageManager as any).maxTokens; 
        return {
            provider: 'your-provider-name',
            model: this.model,
            configuredMaxTokens: configuredMaxTokens,
            modelMaxTokens: getMaxTokens('your-provider-name', this.model)
        };
    }

    async completeTask(userInput: string): Promise<string> {
        this.messageManager.addUserMessage(userInput);
        const rawTools = await this.clientManager.getAllTools();
        const formattedTools = this.formatToolsForProvider(rawTools);
        
        this.eventEmitter.emit('thinking');
        logger.debug('Starting completeTask loop');

        const MAX_ITERATIONS = 10;
        let iterationCount = 0;
        let finalResponseText = '';

        try {
            while (iterationCount < MAX_ITERATIONS) {
                iterationCount++;
                logger.debug(`LLM Iteration ${iterationCount}`);

                // Get formatted messages (compression applied if needed)
                const messages = this.messageManager.getFormattedMessages();
                const systemPrompt = this.messageManager.getFormattedSystemPrompt(); // Use if needed by provider

                logger.silly("Messages sent to provider:", messages);
                logger.silly("Formatted tools:", formattedTools);

                // --- Call Provider API ---
                const response = await this.providerClient.someApiCall({ // Replace with actual SDK call
                    model: this.model,
                    messages: messages,
                    system: systemPrompt, // If applicable
                    tools: formattedTools,
                    // ... other provider options
                });
                logger.silly("Raw response from provider:", response);

                // --- Process Response --- 
                const { textContent, toolCalls } = this.parseProviderResponse(response);
                logger.silly("Parsed response:", { textContent, toolCalls });

                // Add assistant message (handles text and/or tool calls)
                this.messageManager.addAssistantMessage(textContent, toolCalls);

                // --- Handle Tool Calls (if any) --- 
                if (!toolCalls || toolCalls.length === 0) {
                    logger.debug('No tool calls. Task complete.');
                    finalResponseText = textContent || '';
                    this.eventEmitter.emit('response', finalResponseText);
                    return finalResponseText; // Exit loop and return
                }
                
                // Optional: Accumulate intermediate text if provider sends text alongside tool calls
                if (textContent) {
                    finalResponseText += textContent + '\n'; 
                }

                logger.debug(`Processing ${toolCalls.length} tool calls.`);
                for (const toolCall of toolCalls) { 
                    const toolName = toolCall.function.name;
                    const toolCallId = toolCall.id;
                    let args: any = {};
                    try {
                        args = JSON.parse(toolCall.function.arguments);
                    } catch (e) {
                        logger.error(`Failed to parse arguments for tool ${toolName}: ${toolCall.function.arguments}`, e);
                        this.messageManager.addToolResult(toolCallId, toolName, { error: `Invalid arguments format: ${e}` });
                        this.eventEmitter.emit('toolResult', toolName, { error: `Invalid arguments format: ${e}` });
                        continue; // Skip executing this tool call
                    }

                    this.eventEmitter.emit('toolCall', toolName, args);
                    let result: any;
                    try {
                        result = await this.clientManager.executeTool(toolName, args);
                        logger.debug(`Tool ${toolName} executed successfully.`);
                        this.messageManager.addToolResult(toolCallId, toolName, result);
                        this.eventEmitter.emit('toolResult', toolName, result);
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        logger.error(`Tool execution error for ${toolName}: ${errorMessage}`);
                        result = { error: errorMessage }; 
                        this.messageManager.addToolResult(toolCallId, toolName, result);
                        this.eventEmitter.emit('toolResult', toolName, result);
                    }
                }
                
                // Prepare for next iteration
                this.eventEmitter.emit('thinking'); 

            } // End while loop

            // Max iterations reached
            logger.warn(`Reached maximum iterations (${MAX_ITERATIONS}).`);
            const maxIterResponse = finalResponseText || 'Reached maximum tool call iterations without a final answer.';
            this.eventEmitter.emit('response', maxIterResponse);
            return maxIterResponse;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error during completeTask execution: ${errorMessage}`, { error });
            this.eventEmitter.emit('error', error instanceof Error ? error : new Error(errorMessage));
            // Consider adding the error to message history if appropriate for the provider
            // this.messageManager.addAssistantMessage(`Error processing request: ${errorMessage}`);
            return `Error processing request: ${errorMessage}`;
        }
    }

    // --- Private Helper Methods --- 

    // Translates Saiki's internal ToolSet into the provider's specific format
    private formatToolsForProvider(tools: ToolSet): any[] { // Return type depends on provider SDK
        logger.debug(`Formatting ${Object.keys(tools).length} tools for provider.`);
        return Object.entries(tools).map(([toolName, toolDefinition]) => {
            // *** Provider-Specific Transformation Logic Here ***
            return {
                name: toolName,
                description: toolDefinition.description,
                input_schema: toolDefinition.parameters || { type: 'object', properties: {} } 
                // Add/modify fields based on provider's requirements
            };
        });
    }

    // Parses the raw response from the provider's API 
    private parseProviderResponse(response: any): { textContent: string | null; toolCalls: any[] | null } {
         // *** Provider-Specific Parsing Logic Here ***
         // Needs to extract:
         // 1. The main textual response (if any)
         // 2. Any tool call requests, formatted into the structure MessageManager expects:
         //    { id: string, type: 'function', function: { name: string, arguments: string } }[]
         
         // Example structure (adapt heavily):
         let textContent: string | null = response?.choices?.[0]?.message?.content || null;
         let toolCalls: any[] | null = response?.choices?.[0]?.message?.tool_calls || null; 

         // If textContent and toolCalls are mixed (like Anthropic), parse and separate them.
         // Ensure tool call 'arguments' are stringified JSON.

         return { textContent, toolCalls };
       }
   }
   ```

## Step 6: Update the Factory (`factory.ts`)

The factory (`src/ai/llm/services/factory.ts`) creates the correct LLM service based on the configuration.

1.  **Import Your Service:** Add `import { YourProviderService } from './your-provider.js';` at the top.
2.  **Add to `_createLLMService`:** Add a `case` for your provider name in the `switch` statement within the `_createLLMService` function:
    ```typescript
    case 'your-provider-name':
        return new YourProviderService(clientManager, config.systemPrompt, apiKey, config.model);
    ```
3.  **Update API Key Env Var (If Needed):** If your provider uses a standard environment variable name different from `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, update the `switch` statement within the `extractApiKey` function (or the `getApiKeyEnvVarName` helper if used) to include your provider's key name.
    ```typescript
    case 'your-provider-name': apiKeyEnvVar = 'YOUR_PROVIDER_API_KEY'; break;
    ```
4.  **Optional: Add Vercel AI SDK Support:** If your provider is supported by `@ai-sdk` and you want to enable Vercel mode, import its SDK function (e.g., `import { yourProvider } from '@ai-sdk/your-provider';`) and add a case to `_createVercelModel`:
    ```typescript
     case 'your-provider-name': return yourProvider(model);
    ```

## Step 7: Test Your Implementation

1.  **Configure `saiki.yml`:** Update your configuration file to use your new provider:
   ```yaml
   # your-provider configuration
   llm:
     provider: your-provider-name
     model: your-model-name
     # you can update the system prompt to change the behavior of the llm
     systemPrompt: |
       Optional: Your custom system prompt.
     apiKey: env:YOUR_PROVIDER_API_KEY
   ```
2.  **Set API Key:** Ensure the API key is available either directly in the config (not recommended for production) or in your environment variables (e.g., in a `.env` file loaded by your application).
3.  **Run Saiki:** Start the application (`npm start` or similar).
4.  **Test Thoroughly:**
    *   Send simple prompts.
    *   Send prompts designed to trigger tool usage.
    *   Send long conversations to test context window limits and compression.
    *   Monitor the logs (set log level to `debug` or `silly` for detailed info during development).
    *   Check for expected events from the `EventEmitter` if applicable.

By following these steps, you should be able to successfully integrate a new LLM provider into Saiki's extensible architecture. 