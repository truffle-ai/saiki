# Event System

> **[AGENTS - READ THIS DOCUMENT AND KEEP IT UP TO DATE, EVALUATE INCONSISTENCIES AND FLAG THEM]**

The comprehensive event system for Saiki that provides type-safe, hierarchical event management across agent-level and session-level contexts.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────────────────────┐    ┌─────────────────┐
│  Event Sources  │───▶│         Event System             │───▶│  Event Consumers│
│                 │    │      (Type-Safe Events)          │    │                 │
│ • LLM Services  │    │                                  │    │ • WebUI         │
│ • Tool Manager  │    │ • AgentEventBus (Global)         │    │ • CLI           │
│ • Session Mgr   │    │ • SessionEventBus (Per-Session)  │    │ • External APIs │
│ • State Manager │    │ • Event Forwarding               │    │ • Webhooks      │
│ • MCP Manager   │    │ • AbortController Support        │    │ • Integrations  │
└─────────────────┘    │ • Compile-time Type Safety       │    └─────────────────┘
                       └──────────────────────────────────┘
```

## Core Components

### AgentEventBus (`AgentEventBus`)
**Global event bus** for agent-level events that affect the entire system.

**Key Responsibilities:**
- **Global Coordination**: Events that affect multiple sessions or the entire agent
- **Session Context**: All events include `sessionId` for context tracking
- **State Changes**: Agent configuration, MCP server, and tool management events
- **Cross-Session Events**: LLM switching, conversation resets, tool confirmations

**Event Categories:**
```typescript
// Agent state management
'saiki:stateChanged'           // Runtime configuration changes
'saiki:sessionOverrideSet'     // Session-specific overrides
'saiki:mcpServerAdded'         // Dynamic MCP server management

// System-wide operations  
'saiki:conversationReset'      // Conversation history cleared
'saiki:llmSwitched'           // LLM model changed
'saiki:availableToolsUpdated' // Tool set modified

// Security and confirmation
'saiki:toolConfirmationRequest'  // Tool execution requires approval
'saiki:toolConfirmationResponse' // Tool execution approved/denied
```

### SessionEventBus (`SessionEventBus`)
**Session-scoped event bus** for events within individual chat sessions.

**Key Responsibilities:**
- **Session Isolation**: Events scoped to specific conversation contexts
- **LLM Interaction**: Real-time events during AI conversation processing
- **Tool Execution**: Tool call and result events within session context
- **Event Forwarding**: Automatically forward to AgentEventBus with session context

**Event Categories:**
```typescript
// LLM conversation flow
'llmservice:thinking'         // AI processing started
'llmservice:chunk'           // Streaming response chunk
'llmservice:response'        // Final AI response

// Tool execution
'llmservice:toolCall'        // Tool execution requested
'llmservice:toolResult'      // Tool execution completed

// Error handling
'llmservice:error'           // LLM service error
'llmservice:unsupportedInput' // Invalid input for model
```

### BaseTypedEventEmitter (`BaseTypedEventEmitter<T>`)
**Type-safe EventEmitter base class** with AbortController support.

**Key Features:**
- **Full Type Safety**: Compile-time event name and payload validation
- **AbortController Support**: Automatic listener cleanup with abort signals
- **Method Overloads**: Support both typed and untyped events for compatibility
- **Memory Management**: Automatic cleanup to prevent memory leaks

## Key Design Principles

### 1. Hierarchical Event Architecture
```typescript
// Global agent events (with session context)
agentEventBus.emit('saiki:llmSwitched', {
    newConfig: { provider: 'openai', model: 'gpt-4' },
    sessionIds: ['session-1', 'session-2']
});

// Session-specific events (without session context)
sessionEventBus.emit('llmservice:response', {
    content: 'Hello, world!',
    tokenCount: 12
});

// Automatic forwarding adds session context
// → agentEventBus receives: { content: 'Hello, world!', tokenCount: 12, sessionId: 'session-1' }
```

### 2. Compile-Time Type Safety
```typescript
// Event maps define allowed events and payloads
interface AgentEventMap {
    'saiki:llmSwitched': {
        newConfig: ValidatedLLMConfig;
        sessionIds: string[];
    };
}

// Type-safe event emission
agentEventBus.emit('saiki:llmSwitched', {
    newConfig: llmConfig,  // ✅ Type-checked
    sessionIds: ['session-1']
});

// Compile error for invalid events
agentEventBus.emit('invalid:event', {}); // ❌ TypeScript error
```

### 3. AbortController Integration
```typescript
const controller = new AbortController();

// Listeners automatically cleaned up on abort
agentEventBus.on('llmservice:response', (payload) => {
    console.log('Response:', payload.content);
}, { signal: controller.signal });

// Clean up all listeners
controller.abort();
```

### 4. Event Forwarding and Context
- **Session → Agent**: Session events automatically forwarded with `sessionId`
- **Context Preservation**: Session context added without modifying original event
- **Selective Forwarding**: Only configured session events forwarded to agent bus
- **Isolation**: Sessions don't receive other sessions' events

## Event Categories and Usage

### LLM Service Events
**Real-time conversation processing events**

```typescript
// Session-level usage
sessionEventBus.on('llmservice:thinking', () => {
    showThinkingIndicator();
});

sessionEventBus.on('llmservice:chunk', ({ content, isComplete }) => {
    appendToResponse(content);
    if (isComplete) hideThinkingIndicator();
});

sessionEventBus.on('llmservice:response', ({ content, tokenCount, model }) => {
    finalizeResponse(content);
    updateTokenUsage(tokenCount);
});
```

### Tool Execution Events
**Tool call and result tracking**

```typescript
// Monitor tool execution
sessionEventBus.on('llmservice:toolCall', ({ toolName, args, callId }) => {
    showToolExecution(toolName, args);
});

sessionEventBus.on('llmservice:toolResult', ({ toolName, result, success }) => {
    if (success) {
        displayToolResult(result);
    } else {
        showToolError(result.error);
    }
});
```

### Agent State Events
**System-wide configuration and state changes**

```typescript
// Global state monitoring
agentEventBus.on('saiki:stateChanged', ({ field, oldValue, newValue, sessionId }) => {
    logStateChange(field, oldValue, newValue);
    if (sessionId) {
        notifySessionOfStateChange(sessionId, field, newValue);
    }
});

agentEventBus.on('saiki:llmSwitched', ({ newConfig, sessionIds }) => {
    updateUIModelIndicator(newConfig.provider, newConfig.model);
    sessionIds.forEach(sessionId => 
        notifySessionOfModelChange(sessionId, newConfig)
    );
});
```

### Tool Confirmation Events
**Security and approval workflow**

```typescript
// Tool confirmation flow
agentEventBus.on('saiki:toolConfirmationRequest', async ({ 
    toolName, args, executionId, sessionId 
}) => {
    const approved = await showConfirmationDialog(toolName, args);
    
    agentEventBus.emit('saiki:toolConfirmationResponse', {
        executionId,
        approved,
        sessionId
    });
});
```

## Advanced Usage Patterns

### Multi-Consumer Event Handling
```typescript
// WebUI consumer
agentEventBus.on('llmservice:response', ({ content, sessionId }) => {
    updateChatUI(sessionId, content);
});

// Analytics consumer  
agentEventBus.on('llmservice:response', ({ tokenCount, model, sessionId }) => {
    recordUsageMetrics(sessionId, model, tokenCount);
});

// Logging consumer
agentEventBus.on('llmservice:response', ({ content, sessionId }) => {
    logger.info(`Session ${sessionId} response: ${content.slice(0, 100)}...`);
});
```

### Event-Driven Architecture
```typescript
// React hook for event integration
function useSessionEvents(sessionId: string) {
    const [messages, setMessages] = useState([]);
    const [isThinking, setIsThinking] = useState(false);
    
    useEffect(() => {
        const controller = new AbortController();
        
        agentEventBus.on('llmservice:thinking', ({ sessionId: eventSessionId }) => {
            if (eventSessionId === sessionId) {
                setIsThinking(true);
            }
        }, { signal: controller.signal });
        
        agentEventBus.on('llmservice:response', ({ content, sessionId: eventSessionId }) => {
            if (eventSessionId === sessionId) {
                setIsThinking(false);
                setMessages(prev => [...prev, { role: 'assistant', content }]);
            }
        }, { signal: controller.signal });
        
        return () => controller.abort();
    }, [sessionId]);
    
    return { messages, isThinking };
}
```

### Error Handling and Recovery
```typescript
// Comprehensive error handling
agentEventBus.on('llmservice:error', ({ error, context, recoverable, sessionId }) => {
    logger.error(`LLM error in session ${sessionId}: ${error.message}`, { context });
    
    if (recoverable) {
        showRecoverableError(sessionId, error.message);
    } else {
        handleFatalError(sessionId, error);
    }
});

// Unsupported input handling
agentEventBus.on('llmservice:unsupportedInput', ({ 
    errors, provider, model, fileType, sessionId 
}) => {
    const message = `${provider}/${model} doesn't support ${fileType}: ${errors.join(', ')}`;
    showInputValidationError(sessionId, message);
});
```

## Type Safety and Validation

### Event Map Definitions
```typescript
interface AgentEventMap {
    'saiki:llmSwitched': {
        newConfig: ValidatedLLMConfig;    // Strongly typed
        router?: string;
        historyRetained?: boolean;
        sessionIds: string[];
    };
    
    'llmservice:response': {
        content: string;                  // Required fields
        tokenCount?: number;              // Optional fields  
        model?: string;
        sessionId: string;                // Added by forwarding
    };
}
```

### Compile-Time Validation
```typescript
// Arrays and maps must stay synchronized
type _EventNamesInMap = (typeof EVENT_NAMES)[number] extends EventName ? true : never;
const _checkEventNames: _EventNamesInMap = true; // Compile error if mismatch
```

### Runtime Event Names
```typescript
// Available for iteration, validation, etc.
export const AgentEventNames: readonly AgentEventName[] = [...AGENT_EVENT_NAMES];
export const SessionEventNames: readonly SessionEventName[] = [...SESSION_EVENT_NAMES];

// Dynamic event handling
AgentEventNames.forEach(eventName => {
    agentEventBus.on(eventName, (payload) => {
        logEvent(eventName, payload);
    });
});
```

## Memory Management

### Automatic Cleanup
```typescript
class SessionManager {
    private sessionControllers = new Map<string, AbortController>();
    
    createSession(sessionId: string) {
        const controller = new AbortController();
        this.sessionControllers.set(sessionId, controller);
        
        // All session event listeners auto-cleanup on session end
        agentEventBus.on('llmservice:response', handleResponse, {
            signal: controller.signal
        });
    }
    
    destroySession(sessionId: string) {
        const controller = this.sessionControllers.get(sessionId);
        if (controller) {
            controller.abort(); // Cleans up all listeners
            this.sessionControllers.delete(sessionId);
        }
    }
}
```

## Testing

The event system has comprehensive test coverage:

### Event System Tests (`index.test.ts`) - 5 tests
- **Type Safety**: Event name and payload type validation
- **Event Forwarding**: Session to agent event forwarding with context
- **AbortController**: Automatic listener cleanup on abort
- **Memory Management**: WeakMap cleanup and leak prevention
- **Backward Compatibility**: Support for untyped events

## Future Architecture

This design supports future enhancements:
- **Event Persistence**: Store and replay events for debugging
- **Event Metrics**: Performance monitoring and analytics
- **Event Routing**: Conditional event routing based on content
- **Event Transformation**: Middleware for event processing and filtering