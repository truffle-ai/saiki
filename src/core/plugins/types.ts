/**
 * Plugin system types and interfaces for Saiki
 *
 * This module defines the core plugin architecture that allows users to customize
 * the Saiki agent workflow at key points like tool execution and LLM responses.
 */

import type { AgentEventBus, SessionEventBus } from '../events/index.js';
import type { MCPManager } from '../client/manager.js';
import type { PromptManager } from '../ai/systemPrompt/manager.js';
import type { AgentStateManager } from '../config/agent-state-manager.js';
import type { Logger } from '../logger/index.js';

/**
 * Result returned by plugin hooks to control execution flow
 */
export interface HookResult {
    /** Whether to continue with the normal execution flow */
    continue: boolean;
    /** Optional modified data to use instead of original */
    modifiedData?: any;
    /** Optional error to throw */
    error?: Error;
    /** Optional message for logging */
    message?: string;
}

/**
 * Context passed to all plugin hooks with access to core services
 */
export interface PluginContext {
    /** Session ID for session-scoped operations */
    sessionId: string;
    /** Agent event bus for global events */
    agentEventBus: AgentEventBus;
    /** Session event bus for session-scoped events */
    sessionEventBus: SessionEventBus;
    /** Logger instance for plugin logging */
    logger: Logger;
    /** MCP manager for tool access */
    mcpManager: MCPManager;
    /** Prompt manager for system prompt access */
    promptManager: PromptManager;
    /** Agent state manager for configuration access */
    stateManager: AgentStateManager;
}

/**
 * Context for tool call hooks (before/after tool execution)
 */
export interface ToolCallHookContext extends PluginContext {
    /** Name of the tool being executed */
    toolName: string;
    /** Arguments passed to the tool */
    args: Record<string, any>;
    /** Optional call ID for tracking */
    callId?: string;
}

/**
 * Context for tool result hooks (after tool execution)
 */
export interface ToolResultHookContext extends PluginContext {
    /** Name of the tool that was executed */
    toolName: string;
    /** Arguments that were passed to the tool */
    args: Record<string, any>;
    /** Result returned by the tool */
    result: any;
    /** Whether the tool execution was successful */
    success: boolean;
    /** Optional call ID for tracking */
    callId?: string;
}

/**
 * Context for LLM request hooks (before LLM processing)
 */
export interface LLMRequestHookContext extends PluginContext {
    /** User input being processed */
    userInput: string;
    /** Optional image data for multimodal input */
    imageData?: { image: string; mimeType: string };
    /** Current conversation history */
    conversationHistory: any[];
    /** System prompt being used */
    systemPrompt: string;
}

/**
 * Context for LLM response hooks (after LLM processing)
 */
export interface LLMResponseHookContext extends PluginContext {
    /** Original user input */
    userInput: string;
    /** Response from the LLM */
    response: string;
    /** Optional token count information */
    tokenCount?: number;
    /** Model used for the response */
    model?: string;
    /** Whether this was a streaming response */
    streaming?: boolean;
}

/**
 * Context for session lifecycle hooks
 */
export interface SessionHookContext extends PluginContext {
    /** Session metadata */
    sessionMetadata?: {
        createdAt: Date;
        lastActiveAt: Date;
        messageCount: number;
    };
}

/**
 * Plugin hook definitions
 */
export interface PluginHooks {
    /** Called before a tool is executed */
    beforeToolCall?: (context: ToolCallHookContext) => Promise<HookResult>;
    /** Called after a tool is executed */
    afterToolCall?: (context: ToolResultHookContext) => Promise<HookResult>;
    /** Called before LLM processes a request */
    beforeLLMRequest?: (context: LLMRequestHookContext) => Promise<HookResult>;
    /** Called after LLM generates a response */
    afterLLMResponse?: (context: LLMResponseHookContext) => Promise<HookResult>;
    /** Called when a session is created */
    onSessionStart?: (context: SessionHookContext) => Promise<void>;
    /** Called when a session is ended */
    onSessionEnd?: (context: SessionHookContext) => Promise<void>;
}

/**
 * Main plugin interface that all plugins must implement
 */
export interface IPlugin {
    /** Unique plugin name */
    name: string;
    /** Plugin version */
    version: string;
    /** Plugin description */
    description?: string;
    /** Hook implementations */
    hooks: PluginHooks;
    /** Plugin configuration schema (optional) */
    configSchema?: any;

    /** Initialize the plugin with context and configuration */
    initialize(context: PluginContext, config?: any): Promise<void>;
    /** Cleanup plugin resources */
    cleanup(): Promise<void>;
}

/**
 * Plugin configuration from agent.yml
 */
export interface PluginConfig {
    /** Plugin name (must match the plugin's name property) */
    name: string;
    /** Relative path to the plugin file */
    path: string;
    /** Whether the plugin is enabled */
    enabled: boolean;
    /** Plugin-specific configuration */
    config?: Record<string, any>;
    /** Plugin load priority (lower numbers load first) */
    priority?: number;
}

/**
 * Plugin loading result
 */
export interface PluginLoadResult {
    /** Whether loading was successful */
    success: boolean;
    /** The loaded plugin instance */
    plugin?: IPlugin;
    /** Error message if loading failed */
    error?: string;
    /** Warning messages during loading */
    warnings?: string[];
}

/**
 * Plugin execution result for hook chains
 */
export interface PluginExecutionResult {
    /** Whether all plugins succeeded */
    success: boolean;
    /** Final result after all plugins */
    result?: any;
    /** Error if any plugin failed */
    error?: Error;
    /** Messages from plugin executions */
    messages?: string[];
}

/**
 * Hook execution priority
 */
export enum HookPriority {
    HIGHEST = 0,
    HIGH = 25,
    NORMAL = 50,
    LOW = 75,
    LOWEST = 100,
}

/**
 * Plugin lifecycle state
 */
export enum PluginState {
    UNLOADED = 'unloaded',
    LOADING = 'loading',
    LOADED = 'loaded',
    INITIALIZING = 'initializing',
    ACTIVE = 'active',
    ERROR = 'error',
    DISABLED = 'disabled',
}

/**
 * Plugin registry entry
 */
export interface PluginRegistryEntry {
    /** Plugin configuration */
    config: PluginConfig;
    /** Plugin instance */
    plugin?: IPlugin;
    /** Current plugin state */
    state: PluginState;
    /** Load result */
    loadResult?: PluginLoadResult;
    /** Last error */
    lastError?: string;
    /** Load timestamp */
    loadedAt?: Date;
}
