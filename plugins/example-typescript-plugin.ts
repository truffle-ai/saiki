/**
 * TypeScript Example Plugin
 *
 * This plugin demonstrates how to create a plugin in TypeScript
 * with full type safety and proper interface implementation.
 */

import { BasePlugin } from '../dist/src/core/index.js';
import type {
    IPlugin,
    PluginHooks,
    ToolCallHookContext,
    ToolResultHookContext,
    HookResult,
} from '../dist/src/core/index.js';

interface ExamplePluginConfig {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    enableMetrics: boolean;
    customMessage?: string;
}

/**
 * Example TypeScript plugin showing proper interface implementation
 */
export default class ExampleTypescriptPlugin extends BasePlugin implements IPlugin {
    public readonly name = 'example-typescript-plugin';
    public readonly version = '1.0.0';
    public readonly description = 'Example plugin demonstrating TypeScript implementation';

    public readonly hooks: PluginHooks = {
        beforeToolCall: this.beforeToolCall.bind(this),
        afterToolCall: this.afterToolCall.bind(this),
    };

    private config!: ExamplePluginConfig;
    private callCount = 0;
    private startTime!: number;

    /**
     * Initialize the plugin with context and configuration
     */
    protected async onInitialize(): Promise<void> {
        const context = this.getContext();
        const rawConfig = this.getConfig() as ExamplePluginConfig;

        // Validate and set configuration with defaults
        this.config = {
            logLevel: rawConfig?.logLevel ?? 'info',
            enableMetrics: rawConfig?.enableMetrics ?? true,
            customMessage: rawConfig?.customMessage,
        };

        this.startTime = Date.now();

        context.logger.info(`[${this.name}] TypeScript plugin initialized`, {
            config: this.config,
            startTime: this.startTime,
        });
    }

    /**
     * Cleanup plugin resources
     */
    protected async onCleanup(): Promise<void> {
        const context = this.getContext();
        const uptime = Date.now() - this.startTime;

        context.logger.info(`[${this.name}] Plugin cleanup completed`, {
            uptime,
            totalCalls: this.callCount,
        });
    }

    /**
     * Hook called before a tool is executed
     */
    private async beforeToolCall(context: ToolCallHookContext): Promise<HookResult> {
        this.callCount++;

        const pluginContext = this.getContext();

        if (this.config.logLevel === 'debug') {
            pluginContext.logger.debug(`[${this.name}] Before tool call #${this.callCount}`, {
                toolName: context.toolName,
                sessionId: context.sessionId,
                args: context.args,
            });
        }

        // Example: Add metadata to tool arguments
        const modifiedArgs = {
            ...context.args,
            _pluginMetadata: {
                pluginName: this.name,
                callNumber: this.callCount,
                timestamp: new Date().toISOString(),
                customMessage: this.config.customMessage,
            },
        };

        return this.createHookResult(
            true, // continue
            modifiedArgs, // modified data
            undefined, // no error
            `Tool call #${this.callCount}: ${context.toolName}`
        );
    }

    /**
     * Hook called after a tool is executed
     */
    private async afterToolCall(context: ToolResultHookContext): Promise<HookResult> {
        const pluginContext = this.getContext();

        if (this.config.enableMetrics) {
            // Log metrics about the tool call
            pluginContext.logger.info(`[${this.name}] Tool execution metrics`, {
                toolName: context.toolName,
                success: context.success,
                sessionId: context.sessionId,
                hasResult: context.result !== undefined,
                resultType: typeof context.result,
                callNumber: this.callCount,
            });
        }

        // Example: Modify result to include plugin information
        const enhancedResult = {
            originalResult: context.result,
            pluginInfo: {
                processedBy: this.name,
                version: this.version,
                callNumber: this.callCount,
                timestamp: new Date().toISOString(),
            },
        };

        return this.createHookResult(
            true, // continue
            enhancedResult, // modified result
            undefined, // no error
            `Processed by ${this.name}`
        );
    }

    /**
     * Get plugin statistics
     */
    public getStats(): { callCount: number; uptime: number; config: ExamplePluginConfig } {
        return {
            callCount: this.callCount,
            uptime: Date.now() - this.startTime,
            config: { ...this.config },
        };
    }

    /**
     * Reset call counter (for testing)
     */
    public resetCallCount(): void {
        this.callCount = 0;
    }
}
