/**
 * Audit Logger Plugin
 *
 * This plugin logs all tool calls and responses for audit purposes.
 * It demonstrates how to create a plugin with beforeToolCall and afterToolCall hooks.
 */

import { BasePlugin } from '../dist/src/core/index.js';
import type {
    IPlugin,
    PluginHooks,
    ToolCallHookContext,
    ToolResultHookContext,
    SessionHookContext,
    HookResult,
} from '../dist/src/core/index.js';

interface AuditLoggerConfig {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    outputPath?: string;
    enableFileOutput?: boolean;
}

interface AuditEntry {
    timestamp: string;
    eventType: string;
    pluginName: string;
    data: any;
}

/**
 * Audit Logger Plugin - properly implements IPlugin interface
 */
export default class AuditLoggerPlugin extends BasePlugin implements IPlugin {
    public readonly name = 'audit-logger';
    public readonly version = '1.0.0';
    public readonly description = 'Logs all tool calls and responses for audit purposes';

    public readonly hooks: PluginHooks = {
        beforeToolCall: this.beforeToolCall.bind(this),
        afterToolCall: this.afterToolCall.bind(this),
        onSessionStart: this.onSessionStart.bind(this),
        onSessionEnd: this.onSessionEnd.bind(this),
    };

    private config!: AuditLoggerConfig;

    /**
     * Initialize the plugin with context and configuration
     */
    protected async onInitialize(): Promise<void> {
        const context = this.getContext();
        const rawConfig = this.getConfig() as AuditLoggerConfig;

        // Validate and set configuration with defaults
        this.config = {
            logLevel: rawConfig?.logLevel ?? 'info',
            outputPath: rawConfig?.outputPath ?? './audit.log',
            enableFileOutput: rawConfig?.enableFileOutput ?? false,
        };

        context.logger.info(
            `AuditLogger plugin initialized with logLevel: ${this.config.logLevel}`
        );

        // Create audit log entry for plugin initialization
        this.logAuditEvent('plugin_initialized', {
            pluginName: this.name,
            version: this.version,
            config: this.config,
        });
    }

    /**
     * Cleanup plugin resources
     */
    protected async onCleanup(): Promise<void> {
        const context = this.getContext();
        context.logger.info('AuditLogger plugin cleaned up');

        // Log cleanup event
        this.logAuditEvent('plugin_cleanup', {
            pluginName: this.name,
        });
    }

    /**
     * Hook called before a tool is executed
     */
    private async beforeToolCall(context: ToolCallHookContext): Promise<HookResult> {
        const auditData = {
            timestamp: new Date().toISOString(),
            sessionId: context.sessionId,
            toolName: context.toolName,
            args: context.args,
            event: 'tool_call_start',
        };

        this.logAuditEvent('tool_call_start', auditData);

        // Log to console based on log level
        if (this.config.logLevel === 'debug' || this.config.logLevel === 'info') {
            const pluginContext = this.getContext();
            pluginContext.logger.info(`[AuditLogger] Tool call started: ${context.toolName}`, {
                sessionId: context.sessionId,
                args: context.args,
            });
        }

        // Continue with normal execution
        return this.createHookResult(
            true, // continue
            undefined, // no data modification
            undefined, // no error
            `Audit logged tool call: ${context.toolName}`
        );
    }

    /**
     * Hook called after a tool is executed
     */
    private async afterToolCall(context: ToolResultHookContext): Promise<HookResult> {
        const auditData = {
            timestamp: new Date().toISOString(),
            sessionId: context.sessionId,
            toolName: context.toolName,
            args: context.args,
            result: context.result,
            success: context.success,
            event: 'tool_call_end',
        };

        this.logAuditEvent('tool_call_end', auditData);

        // Log to console based on log level
        if (this.config.logLevel === 'debug' || this.config.logLevel === 'info') {
            const pluginContext = this.getContext();
            pluginContext.logger.info(`[AuditLogger] Tool call completed: ${context.toolName}`, {
                sessionId: context.sessionId,
                success: context.success,
                resultSummary:
                    typeof context.result === 'object'
                        ? `Object with ${Object.keys(context.result || {}).length} keys`
                        : String(context.result).substring(0, 100),
            });
        }

        // Continue with normal execution
        return this.createHookResult(
            true, // continue
            undefined, // no data modification
            undefined, // no error
            `Audit logged tool result: ${context.toolName}`
        );
    }

    /**
     * Hook called when a session starts
     */
    private async onSessionStart(context: SessionHookContext): Promise<HookResult> {
        const auditData = {
            timestamp: new Date().toISOString(),
            sessionId: context.sessionId,
            event: 'session_start',
            metadata: context.sessionMetadata,
        };

        this.logAuditEvent('session_start', auditData);

        const pluginContext = this.getContext();
        pluginContext.logger.info(`[AuditLogger] Session started: ${context.sessionId}`);

        return this.createHookResult(true, undefined, undefined, 'Session start logged');
    }

    /**
     * Hook called when a session ends
     */
    private async onSessionEnd(context: SessionHookContext): Promise<HookResult> {
        const auditData = {
            timestamp: new Date().toISOString(),
            sessionId: context.sessionId,
            event: 'session_end',
            metadata: context.sessionMetadata,
        };

        this.logAuditEvent('session_end', auditData);

        const pluginContext = this.getContext();
        pluginContext.logger.info(`[AuditLogger] Session ended: ${context.sessionId}`);

        return this.createHookResult(true, undefined, undefined, 'Session end logged');
    }

    /**
     * Log an audit event
     */
    private logAuditEvent(eventType: string, data: any): void {
        const auditEntry: AuditEntry = {
            timestamp: new Date().toISOString(),
            eventType,
            pluginName: this.name,
            data,
        };

        // In a real implementation, this would write to a file or database
        // For now, we'll just log to console with a special prefix
        this.logToExternalService(auditEntry);
    }

    /**
     * Mock implementation of external logging service
     * In production, this would send to a real logging service
     */
    private logToExternalService(entry: AuditEntry): void {
        // Mock external logging - in production would be HTTP call, file write, etc.
        const context = this.getContext();
        context.logger.info(`[AUDIT] ${JSON.stringify(entry)}`);
    }

    /**
     * Get audit statistics (public method for testing/monitoring)
     */
    public getAuditStats(): { pluginName: string; version: string; config: AuditLoggerConfig } {
        return {
            pluginName: this.name,
            version: this.version,
            config: { ...this.config },
        };
    }
}
