import { EventEmitter } from 'events';

/**
 * Input event names - events that can trigger agent processing
 */
export const INPUT_EVENT_NAMES = [
    'saiki:triggerConversation',
    'saiki:scheduleMessage',
    'saiki:cronTrigger',
    'saiki:webhookReceived',
    'saiki:externalTrigger',
] as const;

/**
 * Agent-level event names - events that occur at the agent/global level
 */
export const AGENT_EVENT_NAMES = [
    'saiki:conversationReset',
    'saiki:mcpServerConnected',
    'saiki:availableToolsUpdated',
    'saiki:llmSwitched',
    // Agent state manager events
    'saiki:stateChanged',
    'saiki:stateExported',
    'saiki:stateReset',
    'saiki:sessionOverrideSet',
    'saiki:sessionOverrideCleared',
    'saiki:mcpServerAdded',
    'saiki:mcpServerRemoved',
    'saiki:mcpServerUpdated',
    // Tool confirmation events
    'saiki:toolConfirmationRequest',
    'saiki:toolConfirmationResponse',
] as const;

/**
 * Session-level event names - events that occur within individual sessions
 */
export const SESSION_EVENT_NAMES = [
    'llmservice:thinking',
    'llmservice:chunk',
    'llmservice:response',
    'llmservice:toolCall',
    'llmservice:toolResult',
    'llmservice:error',
    'llmservice:switched',
    'llmservice:unsupportedInput',
] as const;

/**
 * All event names combined for backward compatibility
 */
export const EVENT_NAMES = [
    ...AGENT_EVENT_NAMES,
    ...SESSION_EVENT_NAMES,
    ...INPUT_EVENT_NAMES,
] as const;

/**
 * Combined event map for the agent bus - includes agent events and session events with sessionId
 * This is what the global agent event bus uses to aggregate all events
 */
export interface AgentEventMap {
    // Input events that can trigger agent processing
    /** Triggered to start a conversation with specific message and optional context */
    'saiki:triggerConversation': {
        message: string;
        sessionId?: string;
        metadata?: Record<string, any>;
        imageData?: { image: string; mimeType: string };
        source?: string; // Source identifier (e.g., 'scheduler', 'webhook', 'cron')
    };

    /** Triggered to schedule a message for future processing */
    'saiki:scheduleMessage': {
        message: string;
        scheduledFor: Date;
        sessionId?: string;
        metadata?: Record<string, any>;
        scheduleId: string;
        recurring?: {
            pattern: 'daily' | 'weekly' | 'monthly' | 'custom';
            interval?: number; // For custom patterns
            cron?: string; // For cron expressions
        };
    };

    /** Triggered by cron-style scheduler */
    'saiki:cronTrigger': {
        cronExpression: string;
        triggerId: string;
        message: string;
        sessionId?: string;
        metadata?: Record<string, any>;
        nextExecution?: Date;
    };

    /** Triggered when external webhook is received */
    'saiki:webhookReceived': {
        webhookId: string;
        payload: Record<string, any>;
        headers: Record<string, string>;
        source: string;
        transformedMessage?: string; // Optional pre-processed message
        sessionId?: string;
    };

    /** Generic external trigger event */
    'saiki:externalTrigger': {
        triggerId: string;
        source: string;
        data: Record<string, any>;
        message?: string;
        sessionId?: string;
        metadata?: Record<string, any>;
    };

    // Agent-level events
    /** Fired when Saiki conversation is reset */
    'saiki:conversationReset': {
        sessionId: string;
    };

    /** Fired when MCP server connection succeeds or fails */
    'saiki:mcpServerConnected': {
        name: string;
        success: boolean;
        error?: string;
    };

    /** Fired when available tools list updates */
    'saiki:availableToolsUpdated': {
        tools: string[];
        source: 'mcp' | 'builtin';
    };

    /** Fired when LLM service switched */
    'saiki:llmSwitched': {
        newConfig: any; // LLMConfig type
        router?: string;
        historyRetained?: boolean;
        sessionIds: string[];
    };

    // Session events forwarded to agent bus (with sessionId added)
    /** LLM service started thinking */
    'llmservice:thinking': {
        sessionId: string;
    };

    /** LLM service sent a streaming chunk */
    'llmservice:chunk': {
        content: string;
        isComplete?: boolean;
        sessionId: string;
    };

    /** LLM service final response */
    'llmservice:response': {
        content: string;
        tokenCount?: number;
        model?: string;
        sessionId: string;
    };

    /** LLM service requested a tool call */
    'llmservice:toolCall': {
        toolName: string;
        args: Record<string, any>;
        callId?: string;
        sessionId: string;
    };

    /** LLM service returned a tool result */
    'llmservice:toolResult': {
        toolName: string;
        result: any;
        callId?: string;
        success: boolean;
        sessionId: string;
    };

    /** LLM service error */
    'llmservice:error': {
        error: Error;
        context?: string;
        recoverable?: boolean;
        sessionId: string;
    };

    /** LLM service switched */
    'llmservice:switched': {
        newConfig: any; // LLMConfig type
        router?: string;
        historyRetained?: boolean;
        sessionId: string;
    };

    /** LLM service unsupported input */
    'llmservice:unsupportedInput': {
        errors: string[];
        provider: string;
        model?: string;
        fileType?: string;
        details?: any;
        sessionId: string;
    };

    // Agent state manager events
    /** Fired when agent runtime state changes */
    'saiki:stateChanged': {
        field: string; // keyof AgentRuntimeState
        oldValue: any;
        newValue: any;
        sessionId?: string;
    };

    /** Fired when agent state is exported as config */
    'saiki:stateExported': {
        config: any; // AgentConfig type
        runtimeSettings: any;
    };

    /** Fired when agent state is reset to baseline */
    'saiki:stateReset': {
        toConfig: any; // AgentConfig type
    };

    /** Fired when session override is set */
    'saiki:sessionOverrideSet': {
        sessionId: string;
        override: any; // SessionOverride type
    };

    /** Fired when session override is cleared */
    'saiki:sessionOverrideCleared': {
        sessionId: string;
    };

    /** Fired when MCP server is added to runtime state */
    'saiki:mcpServerAdded': {
        serverName: string;
        config: any; // McpServerConfig type
    };

    /** Fired when MCP server is removed from runtime state */
    'saiki:mcpServerRemoved': {
        serverName: string;
    };

    /** Fired when MCP server is updated in runtime state */
    'saiki:mcpServerUpdated': {
        serverName: string;
        config: any; // McpServerConfig type
    };

    /** Fired when tool confirmation is requested */
    'saiki:toolConfirmationRequest': {
        toolName: string;
        args: Record<string, any>;
        description?: string;
        executionId: string;
        timestamp: Date;
        sessionId?: string;
    };

    /** Fired when tool confirmation response is received */
    'saiki:toolConfirmationResponse': {
        executionId: string;
        approved: boolean;
        rememberChoice?: boolean;
        sessionId?: string;
    };
}

/**
 * Session-level events - these occur within individual sessions without session context
 * (since they're already scoped to a session)
 */
export interface SessionEventMap {
    /** LLM service started thinking */
    'llmservice:thinking': void;

    /** LLM service sent a streaming chunk */
    'llmservice:chunk': {
        content: string;
        isComplete?: boolean;
    };

    /** LLM service final response */
    'llmservice:response': {
        content: string;
        tokenCount?: number;
        model?: string;
    };

    /** LLM service requested a tool call */
    'llmservice:toolCall': {
        toolName: string;
        args: Record<string, any>;
        callId?: string;
    };

    /** LLM service returned a tool result */
    'llmservice:toolResult': {
        toolName: string;
        result: any;
        callId?: string;
        success: boolean;
    };

    /** LLM service error */
    'llmservice:error': {
        error: Error;
        context?: string;
        recoverable?: boolean;
    };

    /** LLM service switched */
    'llmservice:switched': {
        newConfig: any; // LLMConfig type
        router?: string;
        historyRetained?: boolean;
    };

    /** LLM service unsupported input */
    'llmservice:unsupportedInput': {
        errors: string[];
        provider: string;
        model?: string;
        fileType?: string;
        details?: any;
    };
}

export type AgentEventName = keyof AgentEventMap;
export type SessionEventName = keyof SessionEventMap;
export type EventName = keyof AgentEventMap;
export type InputEventName = (typeof INPUT_EVENT_NAMES)[number];

/**
 * Compile-time checks to ensure event name arrays and maps stay synchronized
 */
type _InputEventNamesInMap = (typeof INPUT_EVENT_NAMES)[number] extends keyof AgentEventMap
    ? true
    : never;
type _AgentEventNamesInMap = (typeof AGENT_EVENT_NAMES)[number] extends keyof AgentEventMap
    ? true
    : never;
type _SessionEventNamesInMap = (typeof SESSION_EVENT_NAMES)[number] extends SessionEventName
    ? true
    : never;
type _EventNamesInMap = (typeof EVENT_NAMES)[number] extends EventName ? true : never;

const _checkInputEventNames: _InputEventNamesInMap = true;
const _checkAgentEventNames: _AgentEventNamesInMap = true;
const _checkSessionEventNames: _SessionEventNamesInMap = true;
const _checkEventNames: _EventNamesInMap = true;

// Explicitly mark compile-time checks as used to avoid linter warnings
void _checkInputEventNames;
void _checkAgentEventNames;
void _checkSessionEventNames;
void _checkEventNames;

/**
 * Runtime arrays of event names for iteration, validation, etc.
 */
export const InputEventNames: readonly InputEventName[] = Object.freeze([...INPUT_EVENT_NAMES]);
export const AgentEventNames: readonly AgentEventName[] = Object.freeze([...AGENT_EVENT_NAMES]);
export const SessionEventNames: readonly SessionEventName[] = Object.freeze([
    ...SESSION_EVENT_NAMES,
]);
export const EventNames: readonly EventName[] = Object.freeze([...EVENT_NAMES]);

/**
 * Generic typed EventEmitter base class
 */
class BaseTypedEventEmitter<TEventMap extends Record<string, any>> extends EventEmitter {
    // Store listeners with their abort controllers for cleanup
    private _abortListeners = new WeakMap<AbortSignal, Set<{ event: any; listener: any }>>();

    // Method overloads for typed events
    override emit<K extends keyof TEventMap>(
        event: K,
        ...args: TEventMap[K] extends void ? [] : [TEventMap[K]]
    ): boolean;
    // Method overload for untyped events (compatibility)
    override emit(event: string | symbol, ...args: any[]): boolean;
    // Implementation
    override emit(event: any, ...args: any[]): boolean {
        return super.emit(event, ...args);
    }

    // Method overloads for typed events with AbortController support
    override on<K extends keyof TEventMap>(
        event: K,
        listener: TEventMap[K] extends void ? () => void : (payload: TEventMap[K]) => void,
        options?: { signal?: AbortSignal }
    ): this;
    // Method overload for untyped events (compatibility)
    override on(
        event: string | symbol,
        listener: (...args: any[]) => void,
        options?: { signal?: AbortSignal }
    ): this;
    // Implementation
    override on(event: any, listener: any, options?: { signal?: AbortSignal }): this {
        // If signal is already aborted, don't add the listener
        if (options?.signal?.aborted) {
            return this;
        }

        // Add the listener
        super.on(event, listener);

        // Set up abort handling if signal is provided
        if (options?.signal) {
            const signal = options.signal;

            // Track this listener for cleanup
            if (!this._abortListeners.has(signal)) {
                this._abortListeners.set(signal, new Set());
            }
            this._abortListeners.get(signal)!.add({ event, listener });

            // Set up abort handler
            const abortHandler = () => {
                this.off(event, listener);

                // Clean up tracking
                const listeners = this._abortListeners.get(signal);
                if (listeners) {
                    listeners.delete({ event, listener });
                    if (listeners.size === 0) {
                        this._abortListeners.delete(signal);
                    }
                }
            };

            signal.addEventListener('abort', abortHandler, { once: true });
        }

        return this;
    }

    // Method overloads for typed events with AbortController support
    override once<K extends keyof TEventMap>(
        event: K,
        listener: TEventMap[K] extends void ? () => void : (payload: TEventMap[K]) => void,
        options?: { signal?: AbortSignal }
    ): this;
    // Method overload for untyped events (compatibility)
    override once(
        event: string | symbol,
        listener: (...args: any[]) => void,
        options?: { signal?: AbortSignal }
    ): this;
    // Implementation
    override once(event: any, listener: any, options?: { signal?: AbortSignal }): this {
        // If signal is already aborted, don't add the listener
        if (options?.signal?.aborted) {
            return this;
        }

        // Create a wrapper that handles both once and abort cleanup
        const onceWrapper = (...args: any[]) => {
            // Clean up abort tracking before calling the original listener
            if (options?.signal) {
                const listeners = this._abortListeners.get(options.signal);
                if (listeners) {
                    listeners.delete({ event, listener: onceWrapper });
                    if (listeners.size === 0) {
                        this._abortListeners.delete(options.signal);
                    }
                }
            }
            listener(...args);
        };

        // Add the wrapped listener
        super.once(event, onceWrapper);

        // Set up abort handling if signal is provided
        if (options?.signal) {
            const signal = options.signal;

            // Track this listener for cleanup
            if (!this._abortListeners.has(signal)) {
                this._abortListeners.set(signal, new Set());
            }
            this._abortListeners.get(signal)!.add({ event, listener: onceWrapper });

            // Set up abort handler
            const abortHandler = () => {
                this.off(event, onceWrapper);

                // Clean up tracking
                const listeners = this._abortListeners.get(signal);
                if (listeners) {
                    listeners.delete({ event, listener: onceWrapper });
                    if (listeners.size === 0) {
                        this._abortListeners.delete(signal);
                    }
                }
            };

            signal.addEventListener('abort', abortHandler, { once: true });
        }

        return this;
    }

    // Method overloads for typed events
    override off<K extends keyof TEventMap>(
        event: K,
        listener: TEventMap[K] extends void ? () => void : (payload: TEventMap[K]) => void
    ): this;
    // Method overload for untyped events (compatibility)
    override off(event: string | symbol, listener: (...args: any[]) => void): this;
    // Implementation
    override off(event: any, listener: any): this {
        return super.off(event, listener);
    }
}

/**
 * Agent-level typed event emitter for global agent events
 */
export class AgentEventBus extends BaseTypedEventEmitter<AgentEventMap> {}

/**
 * Session-level typed event emitter for session-scoped events
 */
export class SessionEventBus extends BaseTypedEventEmitter<SessionEventMap> {}

/**
 * Combined typed event emitter for backward compatibility
 */
export class TypedEventEmitter extends BaseTypedEventEmitter<AgentEventMap> {}

/**
 * Global shared event bus (backward compatibility)
 */
export const eventBus = new TypedEventEmitter();
