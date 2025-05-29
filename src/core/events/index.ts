import { EventEmitter } from 'events';

/**
 * Agent-level event names - events that occur at the agent/global level
 */
export const AGENT_EVENT_NAMES = [
    'saiki:conversationReset',
    'saiki:mcpServerConnected',
    'saiki:availableToolsUpdated',
    'saiki:llmSwitched',
] as const;

/**
 * Session-level event names - events that occur within individual sessions
 */
export const SESSION_EVENT_NAMES = [
    'messageManager:conversationReset',
    'llmservice:thinking',
    'llmservice:chunk',
    'llmservice:response',
    'llmservice:toolCall',
    'llmservice:toolResult',
    'llmservice:error',
    'llmservice:switched',
] as const;

/**
 * All event names combined for backward compatibility
 */
export const EVENT_NAMES = [...AGENT_EVENT_NAMES, ...SESSION_EVENT_NAMES] as const;

/**
 * Combined event map for the agent bus - includes agent events and session events with sessionId
 * This is what the global agent event bus uses to aggregate all events
 */
export interface AgentEventMap {
    // Agent-level events
    /** Fired when Saiki conversation is reset */
    'saiki:conversationReset': {
        sessionId?: string;
    };

    /** Fired when MCP server connection succeeds or fails */
    'saiki:mcpServerConnected': {
        name: string;
        success: boolean;
        error?: string;
        sessionId?: string;
    };

    /** Fired when available tools list updates */
    'saiki:availableToolsUpdated': {
        tools: string[];
        source: 'mcp' | 'builtin';
        sessionId?: string;
    };

    /** Fired when LLM service switched */
    'saiki:llmSwitched': {
        newConfig: any; // LLMConfig type
        router?: string;
        historyRetained?: boolean;
        sessionId?: string;
        sessionIds?: string[];
    };

    // Session events forwarded to agent bus (with sessionId added)
    /** Fired when MessageManager conversation is reset */
    'messageManager:conversationReset': {
        sessionId?: string;
    };

    /** LLM service started thinking */
    'llmservice:thinking': {
        sessionId?: string;
    };

    /** LLM service sent a streaming chunk */
    'llmservice:chunk': {
        content: string;
        isComplete?: boolean;
        sessionId?: string;
    };

    /** LLM service final response */
    'llmservice:response': {
        content: string;
        tokenCount?: number;
        model?: string;
        sessionId?: string;
    };

    /** LLM service requested a tool call */
    'llmservice:toolCall': {
        toolName: string;
        args: Record<string, any>;
        callId?: string;
        sessionId?: string;
    };

    /** LLM service returned a tool result */
    'llmservice:toolResult': {
        toolName: string;
        result: any;
        callId?: string;
        success: boolean;
        sessionId?: string;
    };

    /** LLM service error */
    'llmservice:error': {
        error: Error;
        context?: string;
        recoverable?: boolean;
        sessionId?: string;
    };

    /** LLM service switched */
    'llmservice:switched': {
        newConfig: any; // LLMConfig type
        router?: string;
        historyRetained?: boolean;
        sessionId?: string;
    };
}

/**
 * Session-level events - these occur within individual sessions without session context
 * (since they're already scoped to a session)
 */
export interface SessionEventMap {
    /** Fired when MessageManager conversation is reset */
    'messageManager:conversationReset': void;

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
}

export type AgentEventName = keyof AgentEventMap;
export type SessionEventName = keyof SessionEventMap;
export type EventName = keyof AgentEventMap;

/**
 * Compile-time checks to ensure event name arrays and maps stay synchronized
 */
type _AgentEventNamesInMap = (typeof AGENT_EVENT_NAMES)[number] extends keyof AgentEventMap
    ? true
    : never;
type _SessionEventNamesInMap = (typeof SESSION_EVENT_NAMES)[number] extends SessionEventName
    ? true
    : never;
type _EventNamesInMap = (typeof EVENT_NAMES)[number] extends EventName ? true : never;

const _checkAgentEventNames: _AgentEventNamesInMap = true;
const _checkSessionEventNames: _SessionEventNamesInMap = true;
const _checkEventNames: _EventNamesInMap = true;

// Explicitly mark compile-time checks as used to avoid linter warnings
void _checkAgentEventNames;
void _checkSessionEventNames;
void _checkEventNames;

/**
 * Runtime arrays of event names for iteration, validation, etc.
 */
export const AgentEventNames: readonly AgentEventName[] = Object.freeze([...AGENT_EVENT_NAMES]);
export const SessionEventNames: readonly SessionEventName[] = Object.freeze([
    ...SESSION_EVENT_NAMES,
]);
export const EventNames: readonly EventName[] = Object.freeze([...EVENT_NAMES]);

/**
 * Generic typed EventEmitter base class
 */
class BaseTypedEventEmitter<TEventMap extends Record<string, any>> extends EventEmitter {
    // Method overloads for typed events
    emit<K extends keyof TEventMap>(
        event: K,
        ...args: TEventMap[K] extends void ? [] : [TEventMap[K]]
    ): boolean;
    // Method overload for untyped events (compatibility)
    emit(event: string | symbol, ...args: any[]): boolean;
    // Implementation
    emit(event: any, ...args: any[]): boolean {
        return super.emit(event, ...args);
    }

    // Method overloads for typed events
    on<K extends keyof TEventMap>(
        event: K,
        listener: TEventMap[K] extends void ? () => void : (payload: TEventMap[K]) => void
    ): this;
    // Method overload for untyped events (compatibility)
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    // Implementation
    on(event: any, listener: any): this {
        return super.on(event, listener);
    }

    // Method overloads for typed events
    once<K extends keyof TEventMap>(
        event: K,
        listener: TEventMap[K] extends void ? () => void : (payload: TEventMap[K]) => void
    ): this;
    // Method overload for untyped events (compatibility)
    once(event: string | symbol, listener: (...args: any[]) => void): this;
    // Implementation
    once(event: any, listener: any): this {
        return super.once(event, listener);
    }

    // Method overloads for typed events
    off<K extends keyof TEventMap>(
        event: K,
        listener: TEventMap[K] extends void ? () => void : (payload: TEventMap[K]) => void
    ): this;
    // Method overload for untyped events (compatibility)
    off(event: string | symbol, listener: (...args: any[]) => void): this;
    // Implementation
    off(event: any, listener: any): this {
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
