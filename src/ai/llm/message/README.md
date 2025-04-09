# Message Management System

## Overview

The Message Management System provides a unified approach to handling message history and formatting for different LLM providers. It separates the concerns of message storage from provider-specific formatting, creating a flexible and maintainable architecture.

## Core Components

### `MessageManager`

The central class responsible for:
- Storing and validating conversation messages
- Managing the system prompt
- Exposing formatted messages through an injected formatter
- Providing conversation utilities (reset, history access)

```typescript
// Create a message manager with the appropriate formatter
const formatter = new OpenAIFormatter();
const manager = new MessageManager(formatter, "You are a helpful assistant");

// Add messages
manager.addUserMessage("Hello, can you help me?");
manager.addAssistantMessage("Of course! What do you need help with?");

// Get formatted messages for API call
const messages = manager.getFormattedMessages();
```

### `IMessageFormatter`

Interface implemented by provider-specific formatters:

```typescript
interface IMessageFormatter {
    format(history: Readonly<InternalMessage[]>, systemPrompt?: string | null): any[];
    getSystemPrompt?(systemPrompt: string | null): string | null | undefined;
}
```

### `InternalMessage`

Standardized internal message representation:

```typescript
interface InternalMessage {
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

## Available Formatters

The system includes formatters for major LLM providers:

### OpenAI Formatter
- Formats messages for OpenAI Chat Completion API
- Includes system prompt in the messages array
- Handles tool calls and results in OpenAI's format

### Anthropic Formatter
- Formats messages for Anthropic's Claude API
- Handles system prompt separately
- Converts tool calls/results to Anthropic's content array format

### Vercel Formatter
- Formats messages for Vercel AI SDK
- Uses function_call instead of tool_calls
- Converts tool results to 'function' role

## Usage with LLM Services

```typescript
export class AnthropicService implements ILLMService {
    private messageManager: MessageManager;
    
    constructor(clientManager: ClientManager, systemPrompt: string) {
        const formatter = new AnthropicFormatter();
        this.messageManager = new MessageManager(formatter, systemPrompt);
    }
    
    async completeTask(userInput: string): Promise<string> {
        this.messageManager.addUserMessage(userInput);
        
        const messagesForAPI = this.messageManager.getFormattedMessages();
        const systemPromptForAPI = this.messageManager.getFormattedSystemPrompt();
        
        // Call Anthropic API with formatted messages
        const response = await this.anthropic.messages.create({
            messages: messagesForAPI,
            system: systemPromptForAPI,
            // ... other parameters
        });
        
        // Process response
        // ...
    }
}
```

## Tool Execution Flow

1. Assistant requests tool execution:
   ```typescript
   manager.addAssistantMessage(null, [{
     id: "call_abc123",
     type: "function",
     function: {
       name: "get_weather",
       arguments: '{"location":"San Francisco"}'
     }
   }]);
   ```

2. Add tool execution result:
   ```typescript
   manager.addToolResult(
     "call_abc123", 
     "get_weather", 
     '{"temp":72,"condition":"sunny"}'
   );
   ```

3. The formatter will handle proper pairing and formatting of tool calls with their results.