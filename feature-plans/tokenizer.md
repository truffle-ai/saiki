# Tokenizer System Implementation

## Goal
Implement a tokenizer system for our LLM services to accurately measure and manage token usage within conversation contexts. This system will integrate with our MessageManager to enable proper context window management, intelligent message pruning, and context compression. The tokenizer will help ensure we stay within each LLM provider's token limits while maximizing the useful context available to the model.

## Advantages Over Current Implementation

### 1. Accurate Token Counting
- Precise measurement of token usage specific to each LLM provider
- Prevention of context window overflow errors
- Better utilization of available context space
- Ability to estimate token usage costs

### 2. Intelligent Context Management
- Dynamic pruning of conversation history when approaching limits
- Preservation of most important context elements
- Support for various compression strategies
- Avoidance of arbitrary message truncation

### 3. Provider-Specific Optimization
- Different tokenizers for different LLM providers (OpenAI, Anthropic, etc.)
- Optimized token usage for each specific model
- Adaptation to different context window sizes
- Support for provider-specific tokenization quirks

### 4. Enhanced Reliability
- Reduced API errors due to context overflows
- Graceful degradation when approaching limits
- Predictable behavior across different conversation lengths
- Better handling of edge cases with large inputs

### 5. Improved User Experience
- Maintenance of conversation coherence even with long histories
- More consistent model responses
- Support for longer conversations
- Transparent token usage reporting

### 6. Cost Management
- Better prediction of API costs based on token usage
- Optimization of token usage to minimize costs
- Ability to set token budgets for conversations
- Reporting on token consumption patterns

### 7. Developer Experience
- Abstraction of token counting complexity
- Consistent API across different LLM providers
- Easy integration with existing message management
- Better debugging of context window issues

### 8. Future-Proofing
- Ready for features like:
  - Context compression via summarization
  - Selective message pruning strategies
  - Long-term memory management
  - Hybrid storage approaches (vector DB + messages)
- Adaptable to new LLM provider tokenization schemes

Without this implementation, we would continue to face:
- Unexpected errors from exceeding context limits
- Inaccurate character-based estimations of token usage
- Inefficient use of available context windows
- Inability to effectively manage long conversations
- Poor user experience when context limits are exceeded
- Higher costs from inefficient token usage

## Architecture Considerations

We explored two main approaches:

### Approach 1: Standalone Tokenizer Service
- Create a separate `TokenizerService` that LLM services call directly
- Each service manages its own token counting and pruning
- MessageManager remains unaware of tokenization
- **Pros**: Complete separation of concerns
- **Cons**: Duplicated token management logic in each service

### Approach 2: Tokenizer Injected into MessageManager (Chosen ✅)
- Create an `ITokenizer` interface that specific implementations will follow
- Inject the appropriate tokenizer into MessageManager
- Centralize token counting and compression logic in MessageManager
- **Pros**: 
  - Unified token management
  - Consistent compression strategies
  - Single point of responsibility for context management
  - Natural extension of MessageManager's existing role
- **Cons**: 
  - Makes MessageManager more complex
  - Requires passing tokenizer instances through service initialization

We chose Approach 2 because:
1. It aligns with our existing design where MessageManager already handles message history
2. It allows for centralized context compression strategies
3. It keeps token management logic DRY across services
4. It maintains clean separation between formatting and token management

## Implementation Details

### 1. Tokenizer Interface
```typescript
// src/ai/llm/tokenizer/tokenizer.ts

export interface ITokenizer {
    /**
     * Counts the number of tokens in the provided text according
     * to the specific LLM provider's tokenization rules
     * @param text Text content to count tokens for
     * @returns Number of tokens in the text
     */
    countTokens(text: string): number;
    
    /**
     * Gets the name of the LLM provider this tokenizer is for
     * @returns Provider name (e.g., "openai", "anthropic")
     */
    getProviderName(): string;
}
```

### 2. Example Implementation (OpenAI Tokenizer)
```typescript
// src/ai/llm/tokenizer/openai.ts

import { ITokenizer } from './tokenizer';
import { encoding_for_model } from 'tiktoken';

export class OpenAITokenizer implements ITokenizer {
    private model: string;
    private tokenizer: any; // Tiktoken encoding
    
    constructor(model: string = 'gpt-3.5-turbo') {
        this.model = model;
        this.tokenizer = encoding_for_model(model);
    }
    
    countTokens(text: string): number {
        if (!text) return 0;
        const tokens = this.tokenizer.encode(text);
        return tokens.length;
    }
    
    getProviderName(): string {
        return 'openai';
    }
}
```

### 3. Example Implementation (Anthropic Tokenizer)
```typescript
// src/ai/llm/tokenizer/anthropic.ts

import { ITokenizer } from './tokenizer';
// Note: Anthropic doesn't have an official JS tokenizer
// We may need to use their API or an approximation
// This is a placeholder implementation

export class AnthropicTokenizer implements ITokenizer {
    constructor() {}
    
    countTokens(text: string): number {
        // This is a very rough approximation
        // Anthropic's Claude roughly uses 4 characters per token
        if (!text) return 0;
        return Math.ceil(text.length / 4);
    }
    
    getProviderName(): string {
        return 'anthropic';
    }
}
```

### 4. Updated MessageManager
```typescript
// src/ai/llm/message/manager.ts

import { IMessageFormatter } from './formatter';
import { InternalMessage } from './types';
import { ITokenizer } from '../tokenizer/tokenizer';

export class MessageManager {
    private history: InternalMessage[] = [];
    private systemPrompt: string | null = null;
    private formatter: IMessageFormatter;
    private maxTokens: number | null = null;
    private tokenizer: ITokenizer | null = null;
    
    constructor(
        formatter: IMessageFormatter,
        systemPrompt?: string,
        maxTokens?: number,
        tokenizer?: ITokenizer
    ) {
        this.formatter = formatter;
        if (systemPrompt) {
            this.setSystemPrompt(systemPrompt);
        }
        this.maxTokens = maxTokens ?? null;
        this.tokenizer = tokenizer ?? null;
        
        // Warning if max tokens set but no tokenizer
        if (this.maxTokens && !this.tokenizer) {
            console.warn("MessageManager: maxTokens is set but no tokenizer provided. Token limit will not be enforced.");
        }
    }
    
    // ... existing methods ...
    
    /**
     * Counts total tokens in current conversation including system prompt
     * @returns Total token count or null if no tokenizer
     */
    countTotalTokens(): number | null {
        if (!this.tokenizer) return null;
        
        let total = 0;
        
        // Count system prompt
        if (this.systemPrompt) {
            total += this.tokenizer.countTokens(this.systemPrompt);
        }
        
        // Count each message
        for (const message of this.history) {
            if (message.content) {
                total += this.tokenizer.countTokens(message.content);
            }
            
            // Count tool calls if present
            if (message.toolCalls) {
                for (const call of message.toolCalls) {
                    total += this.tokenizer.countTokens(call.function.name);
                    total += this.tokenizer.countTokens(call.function.arguments);
                }
            }
        }
        
        // Add format overhead (this will vary by model)
        // A more accurate implementation would use the formatter to create the actual payload
        // and then count tokens on that, but this is a reasonable approximation
        total += this.history.length * 4; // 4 tokens per message for format
        
        return total;
    }
    
    /**
     * Gets the conversation history formatted for the target LLM provider
     * Applies compression if token limit is exceeded
     * 
     * @returns Formatted messages ready to send to the LLM provider API
     * @throws Error if formatting fails
     */
    getFormattedMessages(): any[] {
        // Apply compression if needed
        this.compressHistoryIfNeeded();
        
        try {
            // Pass a read-only view of history to the formatter
            return this.formatter.format([...this.history], this.systemPrompt);
        } catch (error) {
            console.error("Error formatting messages:", error);
            throw new Error(`Failed to format messages: ${error}`);
        }
    }
    
    /**
     * Compresses history if token count exceeds maxTokens
     * Uses progressive strategies to reduce token count
     */
    private compressHistoryIfNeeded(): void {
        if (!this.maxTokens || !this.tokenizer) return;
        
        const totalTokens = this.countTotalTokens();
        if (totalTokens === null || totalTokens <= this.maxTokens) return;
        
        // Apply compression strategies in order of preservation priority
        logger.debug(`Compressing history`)
        // Strategy 1: Remove old messages in the middle, preserving the most recent context
        // and the earliest messages for continuity
        this.applyMiddleRemovalCompression(totalTokens);
        
        // If still over limit, apply more aggressive pruning
        if (this.countTotalTokens()! > this.maxTokens) {
            // Strategy 2: Start removing oldest messages entirely
            this.applyOldestRemovalCompression();
        }
    }
    
    /**
     * Strategy 1: Remove messages from the middle of the conversation
     * Preserves first few and most recent messages
     */
    private applyMiddleRemovalCompression(totalTokens: number): void {
        if (this.history.length < 6) return; // Need enough messages to make this worthwhile
        
        // Keep the first 2 exchanges (4 messages) and the last 5 messages
        // Remove messages from the middle until under token limit
        const preserveStart = 4; // First 2 exchanges
        const preserveEnd = 5;   // Last 5 messages
        
        // Don't remove messages if we don't have enough to preserve start and end
        if (this.history.length <= preserveStart + preserveEnd) return;
        
        // Start removing from oldest middle message until we're under the limit
        // or until we hit the preservation boundary
        let middleIndex = preserveStart;
        while (
            this.countTotalTokens()! > this.maxTokens! && 
            middleIndex < this.history.length - preserveEnd
        ) {
            this.history.splice(middleIndex, 1);
            // Note: don't increment middleIndex since we've removed an item
            // and the array has shifted
        }
    }
    
    /**
     * Strategy 2: Remove oldest messages entirely
     * More aggressive approach when we're still over token limit
     */
    private applyOldestRemovalCompression(): void {
        // Keep removing oldest messages until under token limit
        // Always preserve at least the latest 4 messages
        while (
            this.countTotalTokens()! > this.maxTokens! && 
            this.history.length > 4
        ) {
            this.history.shift(); // Remove oldest message
        }
    }
}
```

### 5. Tokenizer Factory
```typescript
// src/ai/llm/tokenizer/factory.ts

import { ITokenizer } from './tokenizer';
import { OpenAITokenizer } from './openai';
import { AnthropicTokenizer } from './anthropic';

export class TokenizerFactory {
    /**
     * Creates the appropriate tokenizer for the specified provider and model
     * @param provider The LLM provider name
     * @param model The specific model name
     * @returns An appropriate tokenizer implementation
     */
    static createTokenizer(provider: string, model: string): ITokenizer {
        switch (provider.toLowerCase()) {
            case 'openai':
                return new OpenAITokenizer(model);
            case 'anthropic':
                return new AnthropicTokenizer();
            // Add cases for other providers
            default:
                throw new Error(`No tokenizer implementation for provider: ${provider}`);
        }
    }
}
```

### 6. Modified Service Example (Anthropic)
```typescript
// src/ai/llm/anthropic.ts

export class AnthropicService implements ILLMService {
    private messageManager: MessageManager;
    private model: string;
    // ... other properties

    constructor(
        clientManager: ClientManager,
        systemPrompt: string,
        apiKey: string,
        model: string = 'claude-2',
    ) {
        this.model = model;
        // ... other initialization
        
        // Create formatter
        const formatter = new AnthropicFormatter();
        
        // Create appropriate tokenizer
        const tokenizer = TokenizerFactory.createTokenizer('anthropic', model);
        
        // Get max tokens based on model
        const maxTokens = this.getMaxTokensForModel(model);
        
        // Create message manager with both formatter and tokenizer
        this.messageManager = new MessageManager(
            formatter, 
            systemPrompt,
            maxTokens * 0.9, // Use 90% of max tokens as limit
            tokenizer
        );
    }

    private getMaxTokensForModel(model: string): number {
        // Model-specific context windows
        const contextSizes: Record<string, number> = {
            'claude-2': 100000,
            'claude-3-sonnet': 180000,
            'claude-3-opus': 180000,
            'claude-instant-1': 100000
        };
        return contextSizes[model] || 100000; // Default to 100k if unknown model
    }

    // ... rest of the service implementation
}
```

## Implementation Tasks

### Phase 1: Core Structure & Utilities
- [x] Create directory structure:
  ```
  src/ai/llm/tokenizer
    ├── tokenizer.ts  // Interface + Error
    ├── factory.ts    // Factory
    ├── openai.ts
    ├── anthropic.ts
    └── utils.ts      // Added for shared utilities
  ```
- [x] Define core interfaces in `tokenizer.ts`:
  - [x] `ITokenizer` interface
  - [x] Error types (e.g., `TokenizationError`)
  - [ ] Compression strategy types
- [x] Create basic `TokenizerFactory` in `factory.ts`:
  - [x] Provider registration mechanism (switch case)
  - [x] Error handling for unknown providers
- [x] **Define Shared Utilities** (in `utils.ts`):
  - [x] Implement `getProviderFromModel(model: string): string` logic.
  - [x] Implement generalized `getMaxTokens(provider: string, model: string): number`.
    - [x] Include helper logic for specific providers (OpenAI, Anthropic, etc.).
    - [x] Add robust handling for unknown models/providers.

### Phase 2: Provider Implementations
- [x] Implement OpenAI tokenizer:
  - [x] Set up tiktoken dependency (installed)
  - [x] Implement token counting with proper error handling (basic done)
  - [ ] Add caching for performance if needed
  - [ ] Add retry logic for API failures
- [x] Implement Anthropic tokenizer:
  - [ ] Research optimal tokenization approach
  - [x] Implement chosen solution with fallback options (approximation done)
  - [x] Add proper error handling (basic done)
  - [x] Document accuracy limitations (done via comments)

### Phase 3: Basic MessageManager Integration
- [x] Update MessageManager:
  - [x] Add tokenizer support to constructor
  - [x] Implement token counting methods (`countTotalTokens`)
  - [x] Add basic logging (via `logger`)
- [x] Implement basic compression:
  - [x] Add compression trigger points (`getFormattedMessages` -> `compressHistoryIfNeeded`)
  - [x] Implement middle removal strategy (`applyMiddleRemovalCompression`)
  - [x] Implement oldest message removal (`applyOldestRemovalCompression`)
  - [x] Add compression events logging (via `logger`)

### Phase 4a: Basic Compression Refinement
- [ ] Improve basic compression strategies:
  - [ ] Add configurable preservation thresholds
  - [ ] Add message importance scoring
  - [ ] Implement smarter message selection
- [ ] Add compression analytics:
  - [ ] Track compression frequency
  - [ ] Measure token reduction effectiveness
  - [ ] Log preservation patterns

### Phase 4b: Advanced Compression (Summarization)
- [ ] Design summarization interface
- [ ] Implement summary generation:
  - [ ] Add summary placeholder messages
  - [ ] Track original vs. compressed sizes
  - [ ] Handle summary token counting
- [ ] Add summary management:
  - [ ] Track which messages were summarized
  - [ ] Handle summary updates
  - [ ] Implement summary caching

### Phase 4c: Intelligent Preservation
- [ ] Implement message scoring:
  - [ ] Define importance criteria
  - [ ] Add scoring algorithm
  - [ ] Test with different conversation patterns
- [ ] Add selective preservation:
  - [ ] Preserve high-value messages
  - [ ] Handle dependencies between messages
  - [ ] Maintain conversation coherence

### Phase 5: Service Integration
- [x] **Update Provider-Specific Services** (e.g., Anthropic, OpenAI):
  - [x] Integrate with AnthropicService:
    - [x] Use Factory to get tokenizer.
    - [x] **Refactor to use generalized `getMaxTokens` utility** from `utils.ts`.
    - [x] Pass tokenizer/limit to MessageManager.
    - [x] Add model-specific limits (partially done, needs util update).
    - [ ] Add token usage monitoring (future task).
    - [ ] Test with various message patterns (future task).
  - [x] Integrate with OpenAIService (or similar):
    - [x] Use Factory to get tokenizer.
    - [x] Use generalized `getMaxTokens` utility from `utils.ts`.
    - [x] Pass tokenizer/limit to MessageManager.
    - [x] Add model-specific configurations (via `getMaxTokens`).
    - [ ] Implement usage tracking (future task).
    - [ ] Test different models (future task).
- [x] **Integrate Generic / Multi-Provider Services** (e.g., VercelLLMService):
  - [x] In service constructor:
    - [x] Use `getProviderFromModel` utility to detect provider from the `model` string.
    - [x] Use `TokenizerFactory` to create the correct `ITokenizer`.
    - [x] Use generalized `getMaxTokens` utility to get the token limit.
    - [x] Determine/select the appropriate `IMessageFormatter` based on provider or service config.
    - [x] Instantiate `MessageManager` with formatter, tokenizer, and max token limit (with safety margin).
  - [ ] Add token usage monitoring (future task).
  - [ ] Test with various models across supported providers (future task).

### Phase 6: Testing
- [ ] Unit tests:
  - [ ] Tokenizer implementations
  - [x] **Shared Utilities (`getProviderFromModel`, `getMaxTokens`)**
  - [ ] Compression strategies
  - [ ] Factory patterns
  - [ ] Error handling
- [ ] Integration tests:
  - [ ] Full message flow
  - [ ] Compression triggers
  - [x] Service integration (**including generic services**)
- [ ] Performance tests:
  - [ ] Token counting benchmarks
  - [ ] Compression speed tests
  - [ ] Memory usage analysis
- [ ] Edge cases:
  - [ ] Very large messages
  - [ ] Mixed content types
  - [ ] API failures
  - [ ] Invalid inputs

### Phase 7: Monitoring
- [ ] Add metrics collection:
  - [ ] Token usage per conversation
  - [ ] Compression frequency
  - [ ] API latency tracking
- [ ] Implement alerts:
  - [ ] Token limit warnings
  - [ ] API failure notifications
  - [ ] Performance degradation
- [ ] Create dashboards:
  - [ ] Token usage patterns
  - [ ] Compression effectiveness
  - [ ] Error rates

### Phase 8: Documentation
- [ ] Technical documentation:
  - [ ] Architecture overview
  - [ ] Interface descriptions
  - [x] **Utility function descriptions**
  - [ ] Error handling guide
- [ ] Usage documentation:
  - [x] Integration examples (**including generic services**)
  - [ ] Configuration guide
  - [ ] Best practices
- [ ] Maintenance documentation:
  - [ ] Monitoring guide
  - [ ] Troubleshooting steps
  - [ ] Update procedures
- [ ] Migration guide:
  - [ ] Step-by-step migration
  - [ ] Breaking changes
  - [ ] Verification steps 