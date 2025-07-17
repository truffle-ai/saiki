/**
 * Audit Logger Plugin
 * 
 * This plugin logs all tool calls and responses for audit purposes.
 * It demonstrates how to create a plugin with beforeToolCall and afterToolCall hooks.
 */

export default class AuditLoggerPlugin {
    constructor() {
        this.name = 'audit-logger';
        this.version = '1.0.0';
        this.description = 'Logs all tool calls and responses for audit purposes';
        
        this.hooks = {
            beforeToolCall: this.beforeToolCall.bind(this),
            afterToolCall: this.afterToolCall.bind(this),
            onSessionStart: this.onSessionStart.bind(this),
            onSessionEnd: this.onSessionEnd.bind(this)
        };
    }

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

    async cleanup() {
        this.context.logger.info('AuditLogger plugin cleaned up');
        
        // Log cleanup event
        this.logAuditEvent('plugin_cleanup', {
            pluginName: this.name
        });
    }

    async beforeToolCall(context) {
        const auditData = {
            timestamp: new Date().toISOString(),
            sessionId: context.sessionId,
            toolName: context.toolName,
            args: context.args,
            event: 'tool_call_start'
        };

        this.logAuditEvent('tool_call_start', auditData);
        
        // Log to console based on log level
        if (this.logLevel === 'debug' || this.logLevel === 'info') {
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

    async afterToolCall(context) {
        const auditData = {
            timestamp: new Date().toISOString(),
            sessionId: context.sessionId,
            toolName: context.toolName,
            args: context.args,
            result: context.result,
            success: context.success,
            event: 'tool_call_end'
        };

        this.logAuditEvent('tool_call_end', auditData);
        
        // Log to console based on log level
        if (this.logLevel === 'debug' || this.logLevel === 'info') {
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

    logAuditEvent(eventType, data) {
        const auditEntry = {
            timestamp: new Date().toISOString(),
            eventType,
            pluginName: this.name,
            data
        };

        // In a real implementation, this would write to a file or database
        // For now, we'll just log to console with a special prefix
        // In production, this would be sent to an external logging service
        // For now, we'll log to a mock implementation to avoid console usage
        this.logToExternalService(auditEntry);
    }

    /**
     * Mock implementation of external logging service
     * In production, this would send to a real logging service
     */
    logToExternalService(entry) {
        // Mock external logging - in production would be HTTP call, file write, etc.
        this.context.logger.info(`[AUDIT] ${JSON.stringify(entry)}`);
    }
}