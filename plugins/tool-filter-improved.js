/**
 * Tool Filter Plugin
 * 
 * This plugin filters tool calls based on configuration.
 * It demonstrates how to modify tool execution behavior and implement
 * the IPlugin interface for security/access control.
 * 
 * @implements {IPlugin}
 */
export default class ToolFilterPlugin {
    /**
     * Plugin name - must match the name in agent.yml configuration
     * @type {string}
     */
    name = 'tool-filter';
    
    /**
     * Plugin version
     * @type {string}
     */
    version = '1.0.0';
    
    /**
     * Plugin description
     * @type {string}
     */
    description = 'Filters tool calls based on allow/deny lists';
    
    /**
     * Hook implementations
     * @type {PluginHooks}
     */
    hooks = {
        beforeToolCall: this.beforeToolCall.bind(this)
    };

    /**
     * Initialize the plugin with context and configuration
     * @param {PluginContext} context - Plugin context with access to core services
     * @param {Object} config - Plugin-specific configuration
     * @param {string[]} config.allowedTools - List of allowed tools (for allow mode)
     * @param {string[]} config.deniedTools - List of denied tools (for deny mode)
     * @param {string} config.mode - Filter mode: 'allow' or 'deny'
     * @returns {Promise<void>}
     */
    async initialize(context, config) {
        this.context = context;
        this.config = config || {};
        this.allowedTools = this.config.allowedTools || [];
        this.deniedTools = this.config.deniedTools || [];
        this.mode = this.config.mode || 'allow'; // 'allow' or 'deny'
        
        // Validate configuration
        if (!['allow', 'deny'].includes(this.mode)) {
            throw new Error(`Invalid filter mode: ${this.mode}. Must be 'allow' or 'deny'`);
        }
        
        if (this.mode === 'allow' && this.allowedTools.length === 0) {
            context.logger.warn('[ToolFilter] Allow mode with empty allowedTools list - all tools will be blocked');
        }
        
        context.logger.info(`ToolFilter plugin initialized with mode: ${this.mode}`, {
            allowedTools: this.allowedTools,
            deniedTools: this.deniedTools
        });
    }

    /**
     * Cleanup plugin resources
     * @returns {Promise<void>}
     */
    async cleanup() {
        this.context.logger.info('ToolFilter plugin cleaned up');
    }

    /**
     * Hook called before a tool is executed
     * @param {ToolCallHookContext} context - Tool call context
     * @returns {Promise<HookResult>}
     */
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
            } else {
                // Empty allow list means nothing is allowed
                isAllowed = false;
                reason = `Tool '${toolName}' blocked - allow list is empty`;
            }
        } else if (this.mode === 'deny') {
            // Deny mode: deny tools in the deniedTools list
            isAllowed = !this.deniedTools.includes(toolName);
            reason = isAllowed ? 
                `Tool '${toolName}' is not in deny list` : 
                `Tool '${toolName}' is in deny list`;
        }

        if (!isAllowed) {
            this.context.logger.warn(`[ToolFilter] Blocking tool call: ${toolName}`, {
                reason,
                sessionId: context.sessionId,
                mode: this.mode,
                allowedTools: this.allowedTools,
                deniedTools: this.deniedTools
            });
            
            return {
                continue: false,
                error: new Error(`Tool '${toolName}' is not allowed by plugin policy: ${reason}`),
                message: `Tool blocked by filter: ${toolName}`
            };
        }

        // Tool is allowed, continue with normal execution
        this.context.logger.debug(`[ToolFilter] Allowing tool call: ${toolName}`, {
            reason,
            sessionId: context.sessionId
        });
        
        return {
            continue: true,
            message: `Tool allowed: ${toolName}`
        };
    }

    /**
     * Get current filter statistics
     * @returns {Object} Filter statistics
     */
    getFilterStats() {
        return {
            mode: this.mode,
            allowedToolsCount: this.allowedTools.length,
            deniedToolsCount: this.deniedTools.length,
            allowedTools: [...this.allowedTools],
            deniedTools: [...this.deniedTools]
        };
    }

    /**
     * Check if a tool would be allowed (without executing)
     * @param {string} toolName - Name of the tool to check
     * @returns {boolean} Whether the tool would be allowed
     */
    isToolAllowed(toolName) {
        if (this.mode === 'allow') {
            return this.allowedTools.length === 0 ? false : this.allowedTools.includes(toolName);
        } else if (this.mode === 'deny') {
            return !this.deniedTools.includes(toolName);
        }
        return true;
    }
}