# Event-Based Architecture for Agent UI Flexibility

This document outlines the plan to transition from a callback-based to an event-based architecture for our agent system, enabling greater flexibility in UI implementations.

## Current Architecture

Our current system uses callbacks for communication between the LLM service and the CLI:

```typescript
// LLMCallbacks interface
interface LLMCallbacks {
    onThinking?: () => void;
    onToolCall?: (toolName: string, args: any) => void;
    onToolResult?: (toolName: string, result: any) => void;
    onResponse?: (response: string) => void;
    onChunk?: (text: string) => void;
}

// Usage in completeTask
async completeTask(userInput: string, callbacks?: LLMCallbacks): Promise<string> {
    // ...
    callbacks?.onThinking?.();
    // ...
    callbacks?.onToolCall?.(toolCall.toolName, toolCall.args);
    // ...
}
```

## Proposed Architecture

We'll transition to an event-based architecture that:

1. Uses EventEmitter for internal event management
2. Defines a formal subscriber interface
3. Enables multiple UIs to connect to the same agent
4. Supports network-based communication (WebSockets)

### Core Components

#### 1. Enhanced ILLMService Interface

```typescript
// src/ai/llm/types.ts
import { EventEmitter } from 'events';

export interface ILLMService {
    completeTask(userInput: string): Promise<string>;
    resetConversation(): void;
    getConfig(): any;
    getEventEmitter(): EventEmitter;
}
```

#### 2. Agent Subscriber Interface

```typescript
// src/ai/llm/types.ts
export interface AgentSubscriber {
    onThinking?(): void;
    onChunk?(text: string): void;
    onToolCall?(toolName: string, args: any): void;
    onToolResult?(toolName: string, result: any): void;
    onResponse?(text: string): void;
    onError?(error: Error): void;
    onConversationReset?(): void;
}
```

#### 3. Event Manager

```typescript
// src/ai/llm/event-manager.ts
export class AgentEventManager {
    private subscribers: AgentSubscriber[] = [];
    private llmService: ILLMService;

    constructor(llmService: ILLMService) {
        this.llmService = llmService;
        this.setupEventListeners();
    }

    registerSubscriber(subscriber: AgentSubscriber): void {
        this.subscribers.push(subscriber);
    }

    removeSubscriber(subscriber: AgentSubscriber): void {
        const index = this.subscribers.indexOf(subscriber);
        if (index !== -1) {
            this.subscribers.splice(index, 1);
        }
    }

    private setupEventListeners(): void {
        const emitter = this.llmService.getEventEmitter();
        
        emitter.on('thinking', () => {
            this.subscribers.forEach(sub => sub.onThinking?.());
        });
        
        emitter.on('chunk', (text: string) => {
            this.subscribers.forEach(sub => sub.onChunk?.(text));
        });
        
        emitter.on('toolCall', (toolName: string, args: any) => {
            this.subscribers.forEach(sub => sub.onToolCall?.(toolName, args));
        });
        
        emitter.on('toolResult', (toolName: string, result: any) => {
            this.subscribers.forEach(sub => sub.onToolResult?.(toolName, result));
        });
        
        emitter.on('response', (text: string) => {
            this.subscribers.forEach(sub => sub.onResponse?.(text));
        });
        
        emitter.on('error', (error: Error) => {
            this.subscribers.forEach(sub => sub.onError?.(error));
        });
        
        emitter.on('conversationReset', () => {
            this.subscribers.forEach(sub => sub.onConversationReset?.());
        });
    }
}
```

#### 4. Updated VercelLLMService

```typescript
// src/ai/llm/vercel.ts
import { EventEmitter } from 'events';

export class VercelLLMService implements ILLMService {
    private model: VercelLLM;
    private clientManager: ClientManager;
    private messages: CoreMessage[] = [];
    private systemContext: string = '';
    private eventEmitter = new EventEmitter();
    
    constructor(
        clientManager: ClientManager, 
        model: VercelLLM,
        systemPrompt: string
    ) {
        this.model = model;
        this.clientManager = clientManager;
        this.systemContext = systemPrompt;
        logger.debug(`[VercelLLMService] System context: ${this.systemContext}`);
    }
    
    getEventEmitter(): EventEmitter {
        return this.eventEmitter;
    }
    
    async completeTask(userInput: string): Promise<string> {
        // Prepend system context to first message or use standalone
        const effectiveUserInput =
            this.messages.length === 0 ? `${this.systemContext}\n\n${userInput}` : userInput;

        // Add user message
        this.messages.push({ role: 'user', content: effectiveUserInput });

        // Get all tools
        const tools: any = await this.clientManager.getAllTools();
        const formattedTools = this.formatTools(tools);
        
        // Maximum number of tool use iterations
        const MAX_ITERATIONS = 10;
        let iterationCount = 0;
        let fullResponse = '';

        try {
            while (iterationCount < 1) {
                this.eventEmitter.emit('thinking');
                iterationCount++;
                logger.debug(`Iteration ${iterationCount}`);
                
                fullResponse = await this.generateText(formattedTools, MAX_ITERATIONS);
            }
            
            this.eventEmitter.emit('response', fullResponse);
            
            return fullResponse || 'Reached maximum number of tool call iterations without a final response.';
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error in vercel llm service: ${error}`);
            this.eventEmitter.emit('error', error);
            return `Error: ${errorMessage}`;
        }
    }
    
    async generateText(tools: VercelToolSet, maxSteps: number = 10): Promise<string> {
        let stepIteration = 0;
        const response = await generateText({
            model: this.model,
            messages: this.messages,
            tools,
            onStepFinish: (step) => {
                stepIteration++;
                
                if (step.stepType === 'tool-result') {
                    for (const toolResult of step.toolResults as any) {
                        this.eventEmitter.emit('toolResult', toolResult.toolName, toolResult.result);
                    }
                }
                if (step.toolCalls) {
                    for (const toolCall of step.toolCalls) {
                        this.eventEmitter.emit('toolCall', toolCall.toolName, toolCall.args);
                    }
                }
            },
            maxSteps: maxSteps,
        });

        const fullResponse = response.text;
        
        // Add assistant message
        this.messages.push({ role: 'assistant', content: fullResponse });
        
        return fullResponse;
    }
    
    async processStream(tools: VercelToolSet, maxSteps: number = 10): Promise<string> {
        const stream = await this.streamText(tools, maxSteps);
        let fullResponse = '';
        for await (const textPart of stream) {
            fullResponse += textPart;
            this.eventEmitter.emit('chunk', textPart);
        }
        return fullResponse;
    }
    
    resetConversation(): void {
        this.messages = [];
        this.eventEmitter.emit('conversationReset');
    }
}
```

### UI Implementation Examples

#### CLI Subscriber Implementation

```typescript
// app/cli-subscriber.ts
export class CLISubscriber implements AgentSubscriber {
    private accumulatedResponse: string = '';
    private currentLines: number = 0;
    
    onThinking(): void {
        logger.info('AI thinking...');
    }
    
    onToolCall(toolName: string, args: any): void {
        logger.toolCall(toolName, args);
    }
    
    onToolResult(toolName: string, result: any): void {
        logger.toolResult(result);
    }
    
    onChunk(text: string): void {
        // Append the new chunk to the accumulated response
        this.accumulatedResponse += text;

        // Generate the new box
        const box = boxen(chalk.white(this.accumulatedResponse), {
            padding: 1,
            borderColor: 'yellow',
            title: '🤖 AI Response',
            titleAlignment: 'center',
        });
        const newLines = box.split('\n').length;

        // Move cursor up to the start of the previous box (if it exists)
        if (this.currentLines > 0) {
            process.stdout.write(`\x1b[${this.currentLines}A`);
        }

        // Print the new box (this overwrites the old one)
        process.stdout.write(box);

        // Update the line count
        this.currentLines = newLines;

        // Move cursor to the end of the box to allow logs below
        process.stdout.write('\n');
    }
    
    onResponse(text: string): void {
        logger.displayAIResponse({ content: text });
        this.accumulatedResponse = '';
        this.currentLines = 0;
    }
    
    onError(error: Error): void {
        logger.error(`Error: ${error.message}`);
        this.accumulatedResponse = '';
        this.currentLines = 0;
    }
    
    onConversationReset(): void {
        logger.info('Conversation history cleared.');
        this.accumulatedResponse = '';
        this.currentLines = 0;
    }
}
```

#### Updated CLI Main Function

```typescript
// app/cli.ts
export async function runAiCli(
    clientManager: ClientManager,
    llmService: ILLMService
) {
    // Initial setup and logging...

    try {
        // Create event manager and register CLI subscriber
        const eventManager = new AgentEventManager(llmService);
        const cliSubscriber = new CLISubscriber();
        eventManager.registerSubscriber(cliSubscriber);
        
        // Get available tools from all connected servers
        logger.info('Loading available tools...');
        const tools = await clientManager.getAllTools();
        logger.info(
            `Loaded ${Object.keys(tools).length} tools from ${clientManager.getClients().size} MCP servers\n`
        );
        logger.info('AI Agent initialized successfully!', null, 'green');

        // Create readline interface
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.bold.green('\nWhat would you like to do? '),
        });

        // Make sure stdin is in flowing mode
        process.stdin.resume();
        rl.prompt();

        // Main interaction loop with the same user experience
        const promptUser = () => {
            return new Promise<string>((resolve) => {
                process.stdin.resume();
                rl.question(chalk.bold.green('\nWhat would you like to do? '), (answer) => {
                    resolve(answer.trim());
                });
            });
        };

        try {
            while (true) {
                const userInput = await promptUser();

                if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
                    logger.warn('Exiting AI CLI. Goodbye!');
                    rl.close();
                    process.exit(0);
                    break;
                }

                if (userInput.toLowerCase() === 'clear') {
                    llmService.resetConversation();
                    continue;
                }

                try {
                    // Simply call completeTask - all updates happen via events
                    await llmService.completeTask(userInput);
                } catch (error) {
                    logger.error(`Error in processing input: ${error.message}`);
                }
            }
        } finally {
            rl.close();
        }
    } catch (error) {
        logger.error(`Error during initialization: ${error.message}`);
    }
}
```

#### WebSocket Subscriber (For Future Use)

```typescript
// app/websocket-subscriber.ts
export class WebSocketSubscriber implements AgentSubscriber {
    private websocket: WebSocket;
    
    constructor(websocket: WebSocket) {
        this.websocket = websocket;
    }
    
    onThinking(): void {
        this.sendEvent('thinking');
    }
    
    onChunk(text: string): void {
        this.sendEvent('chunk', { text });
    }
    
    onToolCall(toolName: string, args: any): void {
        this.sendEvent('toolCall', { toolName, args });
    }
    
    onToolResult(toolName: string, result: any): void {
        this.sendEvent('toolResult', { toolName, result });
    }
    
    onResponse(text: string): void {
        this.sendEvent('response', { text });
    }
    
    onError(error: Error): void {
        this.sendEvent('error', { message: error.message });
    }
    
    onConversationReset(): void {
        this.sendEvent('conversationReset');
    }
    
    private sendEvent(eventName: string, data?: any): void {
        if (this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({
                event: eventName,
                data: data || {}
            }));
        }
    }
}
```

## Benefits of This Architecture

1. **Decoupling**: The LLM service is not tied to any specific UI implementation
2. **Extensibility**: New UIs can be added without modifying the core service
3. **Multiple Subscribers**: Multiple UIs can listen to the same agent simultaneously
4. **Network Ready**: The architecture naturally extends to WebSocket/API scenarios
5. **Type Safety**: Formal interfaces ensure correct implementation

## Task Checklist

### Phase 1: Core Event System
- [ ] Update `ILLMService` interface to include event emitter methods
- [ ] Add EventEmitter to `VercelLLMService` implementation
- [ ] Create the `AgentSubscriber` interface
- [ ] Implement the `AgentEventManager` class
- [ ] Update all event emission points in `VercelLLMService`

### Phase 2: CLI Adaptation
- [ ] Create `CLISubscriber` class implementing `AgentSubscriber`
- [ ] Update `runAiCli` function to use event-based architecture
- [ ] Test CLI functionality with new architecture
- [ ] Ensure all existing CLI features work correctly

### Phase 3: WebSocket/API Support (Future)
- [ ] Create basic WebSocket server implementation
- [ ] Implement `WebSocketSubscriber` class
- [ ] Add authentication for WebSocket connections
- [ ] Create simple example web client for testing
- [ ] Add HTTP API endpoints for non-streaming operations

### Phase 4: Documentation & Examples
- [ ] Document event-based architecture
- [ ] Create example for adding custom subscribers
- [ ] Update developer documentation
- [ ] Add diagrams explaining architecture
- [ ] Create example web/mobile UI implementation 