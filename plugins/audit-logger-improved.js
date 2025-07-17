/**
 * Audit Logger Plugin
 * 
 * This plugin logs all tool calls and responses for audit purposes.
 * It demonstrates how to create a plugin that implements the IPlugin interface
 * with beforeToolCall and afterToolCall hooks.
 * 
 * @implements {IPlugin}
 */
export default class AuditLoggerPlugin {
    /**
     * Plugin name - must match the name in agent.yml configuration
     * @type {string}
     */
    name = 'audit-logger';
    
    /**
     * Plugin version
     * @type {string}
     */
    version = '1.0.0';
    
    /**
     * Plugin description
     * @type {string}
     */
    description = 'Logs all tool calls and responses for audit purposes';
    
    /**
     * Hook implementations
     * @type {PluginHooks}
     */
    hooks = {
        beforeToolCall: this.beforeToolCall.bind(this),
        afterToolCall: this.afterToolCall.bind(this),
        onSessionStart: this.onSessionStart.bind(this),
        onSessionEnd: this.onSessionEnd.bind(this)
    };

    /**
     * Initialize the plugin with context and configuration
     * @param {PluginContext} context - Plugin context with access to core services
     * @param {Object} config - Plugin-specific configuration
     * @returns {Promise<void>}
     */
    async initialize(context, config) {
        this.context = context;
        this.config = config || {};
        this.logLevel = this.config.logLevel || 'info';
        this.outputPath = this.config.outputPath || './audit.log';
        
        context.logger.info(`AuditLogger plugin initialized with logLevel: ${this.logLevel}`);
        
        // Create audit log entry for plugin initialization
        this.logAuditEvent('plugin_initialized', {
            pluginName: this.name,
            version: this.version,
            config: this.config
        });
    }

    /**
     * Cleanup plugin resources
     * @returns {Promise<void>}
     */
    async cleanup() {
        this.context.logger.info('AuditLogger plugin cleaned up');
        
        // Log cleanup event
        this.logAuditEvent('plugin_cleanup', {
            pluginName: this.name
        });
    }

    /**
     * Hook called before a tool is executed
     * @param {ToolCallHookContext} context - Tool call context
     * @returns {Promise<HookResult>}
     */
    async beforeToolCall(context) {
        const auditData = {
            timestamp: new Date().toISOString(),
            sessionId: context.sessionId,
            toolName: context.toolName,
            args: context.args,
            event: 'tool_call_start'
        };

        this.logAuditEvent('tool_call_start', auditData);
        
        if (this.logLevel === 'debug') {
            context.logger.info(`[AuditLogger] Tool call started: ${context.toolName}`, {
                sessionId: context.sessionId,
                args: context.args
            });
        }

        // Continue with normal execution
        return {
            continue: true,
            message: `Audit logged tool call: ${context.toolName}`
        };
    }

    /**
     * Hook called after a tool is executed
     * @param {ToolResultHookContext} context - Tool result context
     * @returns {Promise<HookResult>}
     */
    async afterToolCall(context) {
        const auditData = {
            timestamp: new Date().toISOString(),
            sessionId: context.sessionId,
            toolName: context.toolName,
            args: context.args,
            result: context.result,
            success: context.success,
            event: 'tool_call_complete'
        };

        this.logAuditEvent('tool_call_complete', auditData);
        
        if (this.logLevel === 'debug') {
            context.logger.info(`[AuditLogger] Tool call completed: ${context.toolName}`, {
                sessionId: context.sessionId,
                success: context.success,
                resultSummary: typeof context.result === 'object' ? 
                    `Object with ${Object.keys(context.result).length} keys` : 
                    String(context.result).substring(0, 100)
            });
        }

        // Continue with normal execution
        return {
            continue: true,
            message: `Audit logged tool result: ${context.toolName}`
        };
    }

    /**
     * Hook called when a session starts
     * @param {SessionHookContext} context - Session context
     * @returns {Promise<void>}
     */
    async onSessionStart(context) {
        const auditData = {
            timestamp: new Date().toISOString(),
            sessionId: context.sessionId,
            event: 'session_start',
            metadata: context.sessionMetadata
        };

        this.logAuditEvent('session_start', auditData);
        
        context.logger.info(`[AuditLogger] Session started: ${context.sessionId}`);
    }

    /**
     * Hook called when a session ends
     * @param {SessionHookContext} context - Session context
     * @returns {Promise<void>}
     */
    async onSessionEnd(context) {
        const auditData = {
            timestamp: new Date().toISOString(),
            sessionId: context.sessionId,
            event: 'session_end',
            metadata: context.sessionMetadata
        };

        this.logAuditEvent('session_end', auditData);
        
        context.logger.info(`[AuditLogger] Session ended: ${context.sessionId}`);
    }

    /**
     * Log an audit event
     * @private
     * @param {string} eventType - Type of audit event
     * @param {Object} data - Event data
     */
    logAuditEvent(eventType, data) {
        const auditEntry = {
            timestamp: new Date().toISOString(),
            eventType,
            plugin: {
                name: this.name,
                version: this.version
            },
            data
        };

        // In production, this would be sent to an external logging service
        // For now, we'll log to a mock implementation to avoid console usage
        this.logToExternalService(auditEntry);
    }

    /**
     * Mock implementation of external logging service
     * In production, this would send to a real logging service
     * @private
     * @param {Object} entry - Audit entry to log
     */
    logToExternalService(entry) {
        // Mock external logging - in production would be HTTP call, file write, etc.
        this.context.logger.info(`[AUDIT] ${JSON.stringify(entry)}`);
    }
}