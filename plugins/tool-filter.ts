/**
 * Tool Filter Plugin
 *
 * This plugin filters tool calls based on configuration.
 * It demonstrates how to modify tool execution behavior.
 */

import { BasePlugin } from '../dist/src/core/index.js';
import type {
    IPlugin,
    PluginHooks,
    ToolCallHookContext,
    HookResult,
} from '../dist/src/core/index.js';

interface ToolFilterConfig {
    mode: 'allow' | 'deny';
    allowedTools?: string[];
    deniedTools?: string[];
}

/**
 * Tool Filter Plugin - properly implements IPlugin interface
 */
export default class ToolFilterPlugin extends BasePlugin implements IPlugin {
    public readonly name = 'tool-filter';
    public readonly version = '1.0.0';
    public readonly description = 'Filters tool calls based on allow/deny lists';

    public readonly hooks: PluginHooks = {
        beforeToolCall: this.beforeToolCall.bind(this),
    };

    private config!: ToolFilterConfig;

    /**
     * Initialize the plugin with context and configuration
     */
    protected async onInitialize(): Promise<void> {
        const context = this.getContext();
        const rawConfig = this.getConfig() as ToolFilterConfig;

        // Validate and set configuration with defaults
        this.config = {
            mode: rawConfig?.mode ?? 'allow',
            allowedTools: rawConfig?.allowedTools ?? [],
            deniedTools: rawConfig?.deniedTools ?? [],
        };

        context.logger.info(`ToolFilter plugin initialized with mode: ${this.config.mode}`, {
            allowedTools: this.config.allowedTools,
            deniedTools: this.config.deniedTools,
        });
    }

    /**
     * Cleanup plugin resources
     */
    protected async onCleanup(): Promise<void> {
        const context = this.getContext();
        context.logger.info('ToolFilter plugin cleaned up');
    }

    /**
     * Hook called before a tool is executed - filters based on configuration
     */
    private async beforeToolCall(context: ToolCallHookContext): Promise<HookResult> {
        const { toolName } = context;

        let isAllowed = true;
        let reason = '';

        if (this.config.mode === 'allow') {
            // Allow mode: only allow tools in the allowedTools list
            if (this.config.allowedTools && this.config.allowedTools.length > 0) {
                isAllowed = this.config.allowedTools.includes(toolName);
                reason = isAllowed
                    ? `Tool '${toolName}' is in allow list`
                    : `Tool '${toolName}' is not in allow list`;
            }
        } else if (this.config.mode === 'deny') {
            // Deny mode: deny tools in the deniedTools list
            if (this.config.deniedTools) {
                isAllowed = !this.config.deniedTools.includes(toolName);
                reason = isAllowed
                    ? `Tool '${toolName}' is not in deny list`
                    : `Tool '${toolName}' is in deny list`;
            }
        }

        const pluginContext = this.getContext();

        if (!isAllowed) {
            pluginContext.logger.warn(`[ToolFilter] Blocking tool call: ${toolName}`, {
                reason,
                sessionId: context.sessionId,
            });

            return this.createHookResult(
                false, // don't continue
                undefined, // no data modification
                new Error(`Tool '${toolName}' is not allowed by plugin policy: ${reason}`),
                `Tool blocked by filter: ${toolName}`
            );
        }

        // Tool is allowed, continue with normal execution
        pluginContext.logger.debug(`[ToolFilter] Allowing tool call: ${toolName}`, {
            reason,
            sessionId: context.sessionId,
        });

        return this.createHookResult(
            true, // continue
            undefined, // no data modification
            undefined, // no error
            `Tool allowed: ${toolName}`
        );
    }

    /**
     * Get filter statistics (public method for testing/monitoring)
     */
    public getFilterStats(): {
        mode: string;
        allowedCount: number;
        deniedCount: number;
        config: ToolFilterConfig;
    } {
        return {
            mode: this.config.mode,
            allowedCount: this.config.allowedTools?.length ?? 0,
            deniedCount: this.config.deniedTools?.length ?? 0,
            config: { ...this.config },
        };
    }

    /**
     * Check if a tool would be allowed (utility method for testing)
     */
    public wouldAllowTool(toolName: string): boolean {
        if (this.config.mode === 'allow') {
            return (
                this.config.allowedTools?.length === 0 ||
                this.config.allowedTools?.includes(toolName) === true
            );
        } else if (this.config.mode === 'deny') {
            return !this.config.deniedTools?.includes(toolName);
        }
        return true;
    }
}
