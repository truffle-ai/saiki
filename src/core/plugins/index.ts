/**
 * Plugin system exports
 */

export * from './types.js';
export * from './base.js';
export * from './manager.js';

// Re-export commonly used types for convenience
export type {
    IPlugin,
    PluginConfig as PluginSystemConfig,
    PluginHooks,
    PluginContext,
    HookResult,
    PluginLoadResult,
    PluginExecutionResult,
    ToolCallHookContext,
    ToolResultHookContext,
    LLMRequestHookContext,
    LLMResponseHookContext,
    SessionHookContext,
} from './types.js';

export {
    BasePlugin,
    HookExecutor,
    CONTINUE_HOOK_RESULT,
    stopHookExecution,
    modifyHookData,
} from './base.js';

export { PluginManager } from './manager.js';
