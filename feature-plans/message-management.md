# Message Management Refactoring

## Goal
Refactor the message management layer in our LLM services to be more generic, maintainable, and extensible. Currently, each LLM service (OpenAI, Anthropic, Vercel) manages its own message history and formatting, leading to duplicated code and potential inconsistencies. We need a unified approach that handles message storage and formatting while supporting the specific requirements of each LLM provider.

## Advantages Over Current Implementation

### 1. Reduced Code Duplication
- Eliminates redundant message handling code across different LLM services
- Consolidates common functionality into a single `MessageManager`
- Follows DRY principles with shared message formatting logic
- Reduces maintenance burden of duplicate code

### 2. Better Maintainability
- API format changes only require updating one formatter instead of multiple services
- Bug fixes in message handling only need to be applied once
- New features can be added in a centralized location
- Testing becomes more focused and comprehensive

### 3. Improved Type Safety
- `InternalMessage` interface provides consistent type-safe format
- Catches message formatting errors at compile time
- Reduces runtime errors from incorrect message structure
- Better IDE support and code completion

### 4. Easier Integration of New LLM Providers
- Only requires creating a new formatter implementing `IMessageFormatter`
- No need to reimplement message storage or validation
- Reuse existing message management utilities
- Significantly reduces time to add new providers

### 5. Consistent Behavior
- Uniform system prompt handling across services
- Consistent tool calls and results handling
- Standardized message history management
- Reduces bugs from inconsistent implementations

### 6. Better Separation of Concerns
- Message storage separated from message formatting
- Formatters handle only provider-specific transformations
- Services focus on core API communication
- More modular and comprehensible code structure

### 7. Enhanced Debugging and Logging
- Centralized logging for message operations
- Easier message lifecycle tracking
- Simpler formatting issue debugging
- Better conversation state visibility

### 8. Future-Proofing
- Ready for features like:
  - Token counting and context window management
  - Message persistence
  - Conversation branching
  - Message validation rules
- Flexible structure supports API evolution

### 9. Testing Benefits
- Independent message management testing
- Easy mocking for service logic
- Isolated formatter testing
- More targeted unit tests

### 10. Performance Optimization Opportunities
- Formatted message caching
- Centralized message pruning strategies
- Optimized memory usage
- Better API payload size control

Without this refactoring, we would continue to face:
- Repeated implementation of message handling for each new LLM integration
- Bug fixes required in multiple locations
- Increasingly difficult code maintenance
- Inconsistencies between implementations
- More complex testing requirements
- Scattered feature additions across services

The investment in this refactoring will quickly pay off through improved development velocity, code quality, and maintainability, especially as we expand our LLM provider support and enhance message handling capabilities.

## Architecture Considerations

We explored two main approaches:

### Approach 1: Separate Manager and Formatter
- `MessageManager` only stores messages
- Each `ILLMService` holds both a `MessageManager` and a separate `IMessageFormatter`
- Services coordinate between manager and formatter
- **Pros**: Very clear separation of concerns
- **Cons**: More complex interaction pattern in services

### Approach 2: Formatter-Injected Manager (Chosen ✅)
- `MessageManager` stores messages AND holds an injected `IMessageFormatter`
- Each `ILLMService` creates appropriate formatter and injects it into manager
- Services only interact with manager
- **Pros**: 
  - Simpler API for services
  - Natural coupling of message storage with formatting
  - Still maintains separation of formatting logic
  - Follows dependency injection pattern
- **Cons**: 
  - Manager slightly more complex
  - Manager needs to understand formatting concept

We chose Approach 2 because:
1. It provides a cleaner API for services
2. The coupling between message storage and formatting feels natural
3. It maintains good separation of concerns while being pragmatic
4. It's easily extensible for new LLM providers

## Implementation Details

### 1. Message Formatter Interface
```typescript
// src/ai/llm/message/formatter.ts

export interface IMessageFormatter {
    /**
     * Formats the internal message history for a specific LLM provider API.
     * @param history The raw internal message history
     * @param systemPrompt The system prompt, if any
     * @returns The message history structured for the target API
     */
    format(history: Readonly<InternalMessage[]>, systemPrompt: string | null): any[];

    /**
     * Optional: Some formatters might need separate system prompt handling
     */
    getSystemPrompt?(systemPrompt: string | null): string | null | undefined;
}
```

### 2. Internal Message Types
```typescript
// src/ai/llm/message/types.ts

export interface InternalMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    toolCalls?: Array<{
        id: string;
        type: 'function';
        function: {
            name: string;
            arguments: string;
        };
    }>;
    toolCallId?: string;
    name?: string;
}
```

### 3. Message Manager
```typescript
// src/ai/llm/message/manager.ts

import { IMessageFormatter } from './formatter';
import { InternalMessage } from './types';
import { logger } from '../../utils/logger.js';

export class MessageManager {
    private history: InternalMessage[] = [];
    private systemPrompt: string | null = null;
    private formatter: IMessageFormatter;
    private maxTokens: number | null = null;

    constructor(
        formatter: IMessageFormatter,
        systemPrompt?: string,
        maxTokens?: number
    ) {
        this.formatter = formatter;
        if (systemPrompt) {
            this.setSystemPrompt(systemPrompt);
        }
        this.maxTokens = maxTokens ?? null;
    }

    // Message management methods
    addMessage(message: InternalMessage): void {
        // Validation and addition logic
        this.history.push(message);
    }

    addUserMessage(content: string): void {
        this.addMessage({ role: 'user', content });
    }

    addAssistantMessage(
        content: string | null,
        toolCalls?: InternalMessage['toolCalls']
    ): void {
        this.addMessage({ role: 'assistant', content, toolCalls });
    }

    addToolResult(toolCallId: string, name: string, result: any): void {
        const content = typeof result === 'string' ? result : JSON.stringify(result);
        this.addMessage({ role: 'tool', content, toolCallId, name });
    }

    // System prompt management
    setSystemPrompt(prompt: string): void {
        this.systemPrompt = prompt;
    }

    getSystemPrompt(): string | null {
        return this.systemPrompt;
    }

    // Formatted message access
    getFormattedMessages(): any[] {
        return this.formatter.format(this.history, this.systemPrompt);
    }

    getFormattedSystemPrompt(): string | null | undefined {
        return this.formatter.getSystemPrompt?.(this.systemPrompt);
    }

    // Conversation management
    reset(): void {
        this.history = [];
    }
}
```

### 4. Example Formatter Implementation (Anthropic)
```typescript
// src/ai/llm/message/anthropic_formatter.ts

import { IMessageFormatter } from './formatter';
import { InternalMessage } from './types';
import { logger } from '../../utils/logger.js';

export class AnthropicFormatter implements IMessageFormatter {
    format(history: Readonly<InternalMessage[]>, systemPrompt: string | null): any[] {
        const formatted = [];
        let currentAssistantContent = [];

        for (const msg of history) {
            if (msg.role === 'system') continue;

            // Format logic for each message type
            // ... (detailed implementation)
        }

        return formatted;
    }

    getSystemPrompt(systemPrompt: string | null): string | null | undefined {
        return systemPrompt; // Anthropic uses separate system parameter
    }
}
```

### 5. Example Formatter Implementation (Vercel)
```typescript
// src/ai/llm/message/vercel_formatter.ts

import { IMessageFormatter } from './formatter';
import { InternalMessage } from './types';
import { logger } from '../../utils/logger.js';

// Note: Based on observations, Vercel's generateText/streamText
// methods handle tool execution implicitly and don't require
// explicit 'tool_calls' in the outgoing messages array. This
// formatter focuses on converting internal messages to the standard
// Vercel format, including handling incoming tool results ('function' role).
export class VercelFormatter implements IMessageFormatter {
    format(history: Readonly<InternalMessage[]>, systemPrompt: string | null): any[] {
        const formatted = [];

        // Add system message if present
        if (systemPrompt) {
            formatted.push({
                role: 'system',
                content: systemPrompt
            });
        }

        for (const msg of history) {
            switch (msg.role) {
                case 'user':
                case 'system':
                    formatted.push({
                        role: msg.role,
                        content: msg.content
                    });
                    break;

                case 'assistant':
                    if (msg.toolCalls) {
                        formatted.push({
                            role: 'assistant',
                            content: msg.content,
                            function_call: {
                                name: msg.toolCalls[0].function.name,
                                arguments: msg.toolCalls[0].function.arguments
                            }
                        });
                    } else {
                        formatted.push({
                            role: 'assistant',
                            content: msg.content
                        });
                    }
                    break;

                case 'tool':
                    // Convert internal tool results back to Vercel's expected format
                    formatted.push({
                        role: 'function',
                        name: msg.name!,
                        content: msg.content
                    });
                    break;

                default:
                    logger.warn(`Unexpected message role: ${msg.role}`);
                    break;
            }
        }

        return formatted;
    }

    // Vercel includes system prompt in the messages array
    getSystemPrompt(): null {
        return null;
    }
}
```

### 6. Modified Service Example (Anthropic)
```typescript
// src/ai/llm/anthropic.ts

export class AnthropicService implements ILLMService {
    private messageManager: MessageManager;
    // ... other properties

    constructor(
        clientManager: ClientManager,
        systemPrompt: string,
        apiKey: string,
        model?: string,
    ) {
        // ... other initialization
        const formatter = new AnthropicFormatter();
        this.messageManager = new MessageManager(formatter, systemPrompt);
    }

    async completeTask(userInput: string): Promise<string> {
        this.messageManager.addUserMessage(userInput);
        
        // Get formatted messages directly from manager
        const messagesForAPI = this.messageManager.getFormattedMessages();
        const systemPromptForAPI = this.messageManager.getFormattedSystemPrompt();

        // Use in API call
        const response = await this.anthropic.messages.create({
            messages: messagesForAPI,
            system: systemPromptForAPI,
            // ... other parameters
        });

        // ... process response
    }
}
```

## Implementation Tasks

### Phase 1: Core Structure
- [ ] Create new directory structure:
  ```
  src/ai/llm/message/
    ├── types.ts
    ├── formatter.ts
    ├── manager.ts
    └── formatters/
        ├── anthropic.ts
        ├── openai.ts
        └── vercel.ts
  ```
- [ ] Create `types.ts` with `InternalMessage` interface
- [ ] Create `formatter.ts` with `IMessageFormatter` interface
- [ ] Create `manager.ts` with basic `MessageManager` class structure

### Phase 2: Formatter Implementations
- [ ] Implement `AnthropicFormatter`
  - [ ] Basic message role conversion
  - [ ] Tool call formatting
  - [ ] Tool result formatting
  - [ ] System prompt handling
- [ ] Implement `OpenAIFormatter`
  - [ ] Basic message conversion
  - [ ] Tool call formatting
  - [ ] System message inclusion
- [ ] Implement `VercelFormatter`
  - [ ] Message conversion (user, assistant, system)
  - [ ] Verify correct formatting for sending tool results back to Vercel (likely `role: 'function'`).
  - [ ] Handle incoming assistant messages that *might* contain `function_call` (if applicable to other Vercel methods).
  - [ ] Note: Standard text generation typically doesn't require sending explicit `tool_calls` to Vercel.
  - [ ] System prompt handling (inclusion in messages array).

### Phase 3: Message Manager Implementation
- [ ] Implement core message storage
- [ ] Add message validation
- [ ] Add convenience methods (addUserMessage, etc.)
- [ ] Add formatter integration
- [ ] Add system prompt management
- [ ] Add reset functionality

### Phase 4: Service Integration
- [ ] Modify `AnthropicService`
  - [ ] Update constructor
  - [ ] Update message handling in completeTask
  - [ ] Test integration
- [ ] Modify `OpenAIService`
  - [ ] Update constructor
  - [ ] Update message handling
  - [ ] Test integration
- [ ] Modify `VercelService`
  - [ ] Update constructor
  - [ ] Update message handling
  - [ ] Test integration

### Phase 5: Testing
- [ ] Create unit tests for `MessageManager`
- [ ] Create unit tests for each formatter
- [ ] Create integration tests for each service
- [ ] Test error cases and edge conditions
- [ ] Test conversation flows with tools

### Phase 6: Documentation and Cleanup
- [ ] Add JSDoc comments to all classes and methods
- [ ] Create usage examples
- [ ] Update README with new architecture
- [ ] Clean up any deprecated code
- [ ] Add logging for debugging

### Phase 7: Validation and Release
- [ ] Perform end-to-end testing
- [ ] Review error handling
- [ ] Check logging coverage
- [ ] Create migration guide
- [ ] Plan release strategy 