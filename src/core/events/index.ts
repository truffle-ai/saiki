import { EventEmitter } from 'events';

/**
 * Event name definitions - the single source of truth for event names.
 * Add new events here and TypeScript will enforce you update the EventMap below.
 */
export const EVENT_NAMES = [
    'saiki:conversationReset',
    'saiki:mcpServerConnected',
    'saiki:availableToolsUpdated',
    'messageManager:conversationReset',
    'llmservice:thinking',
    'llmservice:chunk',
    'llmservice:response',
    'llmservice:toolCall',
    'llmservice:toolResult',
    'llmservice:error',
] as const;

/**
 * Type-level mapping of event names to their payload types.
 * Using single objects instead of tuple arrays for better maintainability.
 * This MUST include all events from EVENT_NAMES (enforced by compile-time checks below).
 */
export interface EventMap {
    /** Fired when Saiki conversation is reset */
    'saiki:conversationReset': void;

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
}

export type EventName = keyof EventMap;

/**
 * Compile-time checks to ensure EVENT_NAMES and EventMap stay synchronized.
 * These will cause TypeScript errors if they get out of sync:
 * - If you add an event to EVENT_NAMES but not EventMap, you'll get an error
 * - If you add an event to EventMap but not EVENT_NAMES, you'll get an error
 */
type _EventNamesInMap = (typeof EVENT_NAMES)[number] extends EventName ? true : never;
type _EventMapInNames = EventName extends (typeof EVENT_NAMES)[number] ? true : never;

// These lines will error if the above checks fail
const _checkEventNamesInMap: _EventNamesInMap = true;
const _checkEventMapInNames: _EventMapInNames = true;

/**
 * Runtime array of event names for iteration, validation, etc.
 */
export const EventNames: readonly EventName[] = Object.freeze([...EVENT_NAMES]);

/**
 * A strongly typed EventEmitter using our EventMap as the payload definitions.
 * Modified to work with single object payloads instead of tuple arrays.
 */
export class TypedEventEmitter extends EventEmitter {
    /** Emit an event with a single payload object (or void for no payload) */
    emit<K extends keyof EventMap>(
        event: K,
        ...args: EventMap[K] extends void ? [] : [EventMap[K]]
    ): boolean {
        return super.emit(event as string, ...args);
    }

    /** Register a listener with a single payload object (or void for no payload) */
    on<K extends keyof EventMap>(
        event: K,
        listener: EventMap[K] extends void ? () => void : (payload: EventMap[K]) => void
    ): this {
        return super.on(event as string, listener as (...args: any[]) => void);
    }

    /** Register a one-time listener with a single payload object (or void for no payload) */
    once<K extends keyof EventMap>(
        event: K,
        listener: EventMap[K] extends void ? () => void : (payload: EventMap[K]) => void
    ): this {
        return super.once(event as string, listener as (...args: any[]) => void);
    }

    /** Remove a listener */
    off<K extends keyof EventMap>(
        event: K,
        listener: EventMap[K] extends void ? () => void : (payload: EventMap[K]) => void
    ): this {
        return super.off(event as string, listener as (...args: any[]) => void);
    }
}

/**
 * Global shared event bus (Node.js built-in EventEmitter).
 */
export const eventBus = new TypedEventEmitter();
