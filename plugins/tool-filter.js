/**
 * Tool Filter Plugin
 * 
 * This plugin filters tool calls based on configuration.
 * It demonstrates how to modify tool execution behavior.
 */

export default class ToolFilterPlugin {
    constructor() {
        this.name = 'tool-filter';
        this.version = '1.0.0';
        this.description = 'Filters tool calls based on allow/deny lists';
        
        this.hooks = {
            beforeToolCall: this.beforeToolCall.bind(this)
        };
    }

    async initialize(context, config) {
        this.context = context;
        this.config = config || {};
        this.allowedTools = this.config.allowedTools || [];
        this.deniedTools = this.config.deniedTools || [];
        this.mode = this.config.mode || 'allow'; // 'allow' or 'deny'
        
        context.logger.info(`ToolFilter plugin initialized with mode: ${this.mode}`, {
            allowedTools: this.allowedTools,
            deniedTools: this.deniedTools
        });
    }

    async cleanup() {
        this.context.logger.info('ToolFilter plugin cleaned up');
    }

    async beforeToolCall(context) {
        const { toolName } = context;
        
        let isAllowed = true;
        let reason = '';

        if (this.mode === 'allow') {
            // Allow mode: only allow tools in the allowedTools list
            if (this.allowedTools.length > 0) {
                isAllowed = this.allowedTools.includes(toolName);
                reason = isAllowed ? 
                    `Tool '${toolName}' is in allow list` : 
                    `Tool '${toolName}' is not in allow list`;
            }
        } else if (this.mode === 'deny') {
            // Deny mode: deny tools in the deniedTools list
            isAllowed = !this.deniedTools.includes(toolName);
            reason = isAllowed ? 
                `Tool '${toolName}' is not in deny list` : 
                `Tool '${toolName}' is in deny list`;
        }

        if (!isAllowed) {
            context.logger.warn(`[ToolFilter] Blocking tool call: ${toolName}`, {
                reason,
                sessionId: context.sessionId
            });
            
            return {
                continue: false,
                error: new Error(`Tool '${toolName}' is not allowed by plugin policy: ${reason}`),
                message: `Tool blocked by filter: ${toolName}`
            };
        }

        // Tool is allowed, continue with normal execution
        context.logger.debug(`[ToolFilter] Allowing tool call: ${toolName}`, {
            reason,
            sessionId: context.sessionId
        });
        
        return {
            continue: true,
            message: `Tool allowed: ${toolName}`
        };
    }
}