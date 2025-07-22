/**
 * Base plugin class and hook execution utilities
 */

import { logger } from '../logger/index.js';
import type {
    IPlugin,
    PluginHooks,
    PluginContext,
    HookResult,
    PluginExecutionResult,
} from './types.js';
import { HookPriority, PluginState } from './types.js';

/**
 * Base plugin class that provides common functionality
 */
export abstract class BasePlugin implements IPlugin {
    public abstract readonly name: string;
    public abstract readonly version: string;
    public readonly description?: string;
    public abstract readonly hooks: PluginHooks;
    public readonly configSchema?: any;

    protected context?: PluginContext;
    protected config?: any;
    protected state: PluginState = PluginState.UNLOADED;

    /**
     * Initialize the plugin with context and configuration
     */
    public async initialize(context: PluginContext, config?: any): Promise<void> {
        this.state = PluginState.INITIALIZING;
        this.context = context;
        this.config = config;

        try {
            await this.onInitialize();
            this.state = PluginState.ACTIVE;
            logger.info(`Plugin '${this.name}' initialized successfully`);
        } catch (error) {
            this.state = PluginState.ERROR;
            logger.error(
                `Plugin '${this.name}' initialization failed: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    }

    /**
     * Cleanup plugin resources
     */
    public async cleanup(): Promise<void> {
        try {
            await this.onCleanup();
            this.state = PluginState.UNLOADED;
            logger.info(`Plugin '${this.name}' cleaned up successfully`);
        } catch (error) {
            logger.error(
                `Plugin '${this.name}' cleanup failed: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    }

    /**
     * Get plugin state
     */
    public getState(): PluginState {
        return this.state;
    }

    /**
     * Get plugin context
     */
    protected getContext(): PluginContext {
        if (!this.context) {
            throw new Error(`Plugin '${this.name}' has not been initialized`);
        }
        return this.context;
    }

    /**
     * Get plugin configuration
     */
    protected getConfig(): any {
        return this.config;
    }

    /**
     * Template method for plugin initialization
     */
    protected async onInitialize(): Promise<void> {
        // Override in subclasses
    }

    /**
     * Template method for plugin cleanup
     */
    protected async onCleanup(): Promise<void> {
        // Override in subclasses
    }

    /**
     * Create a standardized hook result
     */
    protected createHookResult(
        continue_: boolean = true,
        modifiedData?: any,
        error?: Error,
        message?: string
    ): HookResult {
        const result: HookResult = {
            continue: continue_,
        };
        if (modifiedData !== undefined) {
            result.modifiedData = modifiedData;
        }
        if (error !== undefined) {
            result.error = error;
        }
        if (message !== undefined) {
            result.message = message;
        }
        return result;
    }

    /**
     * Log plugin activity
     */
    protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
        logger[level](`[Plugin:${this.name}] ${message}`, data);
    }
}

/**
 * Hook executor for running plugin hooks in sequence
 */
export class HookExecutor {
    private plugins: Map<string, { plugin: IPlugin; priority: number }> = new Map();

    /**
     * Register a plugin with the executor
     */
    public registerPlugin(plugin: IPlugin, priority: number = HookPriority.NORMAL): void {
        this.plugins.set(plugin.name, { plugin, priority });
        logger.debug(`Registered plugin '${plugin.name}' with priority ${priority}`);
    }

    /**
     * Unregister a plugin from the executor
     */
    public unregisterPlugin(pluginName: string): void {
        this.plugins.delete(pluginName);
        logger.debug(`Unregistered plugin '${pluginName}'`);
    }

    /**
     * Get plugins that implement a specific hook, sorted by priority
     */
    private getPluginsWithHook<T extends keyof PluginHooks>(
        hookName: T
    ): Array<{ plugin: IPlugin; priority: number }> {
        return Array.from(this.plugins.values())
            .filter(({ plugin }) => plugin.hooks[hookName])
            .sort((a, b) => a.priority - b.priority);
    }

    /**
     * Execute a hook across all registered plugins
     */
    public async executeHook<T extends keyof PluginHooks>(
        hookName: T,
        context: Parameters<NonNullable<PluginHooks[T]>>[0],
        initialData?: any
    ): Promise<PluginExecutionResult> {
        const startTime = Date.now();
        logger.debug(`Executing hook '${hookName}' across ${this.plugins.size} plugins`);

        // Get plugins that implement this hook, sorted by priority
        const pluginsWithHook = this.getPluginsWithHook(hookName);

        if (pluginsWithHook.length === 0) {
            logger.debug(`No plugins implement hook '${hookName}'`);
            return {
                success: true,
                result: initialData,
                messages: [],
            };
        }

        let currentData = initialData;
        const messages: string[] = [];

        try {
            // Execute hooks in priority order
            for (const { plugin } of pluginsWithHook) {
                const hookFn = plugin.hooks[hookName];
                if (!hookFn) continue;

                logger.debug(`Executing hook '${hookName}' for plugin '${plugin.name}'`);

                try {
                    const result = await (hookFn as any)(context);

                    // Handle hook result
                    if (result && typeof result === 'object' && 'continue' in result) {
                        const hookResult = result as HookResult;

                        if (hookResult.message) {
                            messages.push(`${plugin.name}: ${hookResult.message}`);
                        }

                        if (hookResult.error) {
                            logger.error(
                                `Plugin '${plugin.name}' hook '${hookName}' failed: ${hookResult.error.message}`
                            );
                            return {
                                success: false,
                                error: hookResult.error,
                                messages,
                            };
                        }

                        if (hookResult.modifiedData !== undefined) {
                            currentData = hookResult.modifiedData;
                        }

                        if (!hookResult.continue) {
                            logger.debug(
                                `Plugin '${plugin.name}' terminated hook chain for '${hookName}'`
                            );
                            break;
                        }
                    }
                } catch (error) {
                    const err = error instanceof Error ? error : new Error(String(error));
                    logger.error(
                        `Plugin '${plugin.name}' hook '${hookName}' threw error: ${err.message}`
                    );
                    return {
                        success: false,
                        error: err,
                        messages,
                    };
                }
            }

            const duration = Date.now() - startTime;
            logger.debug(`Hook '${hookName}' execution completed in ${duration}ms`);

            return {
                success: true,
                result: currentData,
                messages,
            };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`Hook '${hookName}' execution failed: ${err.message}`);
            return {
                success: false,
                error: err,
                messages,
            };
        }
    }

    /**
     * Execute a lifecycle hook (no return value expected)
     */
    public async executeLifecycleHook<T extends 'onSessionStart' | 'onSessionEnd'>(
        hookName: T,
        context: Parameters<NonNullable<PluginHooks[T]>>[0]
    ): Promise<void> {
        const startTime = Date.now();
        logger.debug(`Executing lifecycle hook '${hookName}' across ${this.plugins.size} plugins`);

        // Get plugins that implement this hook, sorted by priority
        const pluginsWithHook = this.getPluginsWithHook(hookName);

        if (pluginsWithHook.length === 0) {
            logger.debug(`No plugins implement lifecycle hook '${hookName}'`);
            return;
        }

        const errors: Error[] = [];

        // Execute hooks in priority order
        for (const { plugin } of pluginsWithHook) {
            const hookFn = plugin.hooks[hookName];
            if (!hookFn) continue;

            logger.debug(`Executing lifecycle hook '${hookName}' for plugin '${plugin.name}'`);

            try {
                await (hookFn as any)(context);
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                logger.error(
                    `Plugin '${plugin.name}' lifecycle hook '${hookName}' failed: ${err.message}`
                );
                errors.push(err);
            }
        }

        const duration = Date.now() - startTime;
        logger.debug(`Lifecycle hook '${hookName}' execution completed in ${duration}ms`);

        // If any errors occurred, log them but don't throw (lifecycle hooks are best-effort)
        if (errors.length > 0) {
            logger.warn(`${errors.length} plugins failed during lifecycle hook '${hookName}'`);
        }
    }

    /**
     * Get all registered plugins
     */
    public getRegisteredPlugins(): string[] {
        return Array.from(this.plugins.keys());
    }

    /**
     * Get plugin count
     */
    public getPluginCount(): number {
        return this.plugins.size;
    }

    /**
     * Clear all registered plugins
     */
    public clear(): void {
        this.plugins.clear();
        logger.debug('Cleared all registered plugins from hook executor');
    }
}

/**
 * Default hook result for continuing execution
 */
export const CONTINUE_HOOK_RESULT: HookResult = {
    continue: true,
};

/**
 * Create a hook result that stops execution
 */
export function stopHookExecution(message?: string, error?: Error): HookResult {
    const result: HookResult = {
        continue: false,
    };
    if (message !== undefined) {
        result.message = message;
    }
    if (error !== undefined) {
        result.error = error;
    }
    return result;
}

/**
 * Create a hook result that modifies data
 */
export function modifyHookData(data: any, message?: string): HookResult {
    const result: HookResult = {
        continue: true,
        modifiedData: data,
    };
    if (message !== undefined) {
        result.message = message;
    }
    return result;
}
