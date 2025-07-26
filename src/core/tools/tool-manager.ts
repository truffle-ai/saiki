import { MCPManager } from '../client/manager.js';
import { CustomToolProvider } from './custom-tool-provider.js';
import { ToolSet, ToolExecutionContext } from './types.js';
import { ToolConfirmationProvider } from '../client/tool-confirmation/types.js';
import { ValidatedCustomToolsConfig } from '../config/schemas.js';
import { logger } from '../logger/index.js';

/**
 * Unified Tool Manager - Single interface for all tool operations
 *
 * This class acts as the single point of contact between the LLM and all tool sources.
 * It aggregates tools from multiple sources (MCP servers, custom tools, future plugins)
 * and provides a unified interface for tool discovery, aggregation, and execution.
 *
 * Responsibilities:
 * - Aggregate tools from multiple sources with conflict resolution
 * - Route tool execution to appropriate source (MCP vs Custom)
 * - Provide unified tool interface to LLM
 * - Manage tool confirmation and security
 * - Handle cross-source naming conflicts
 *
 * Architecture:
 * LLMService → ToolManager → [MCPManager, CustomToolProvider]
 */
export class ToolManager {
    private mcpManager: MCPManager;
    private customToolProvider?: CustomToolProvider;
    private confirmationProvider: ToolConfirmationProvider;

    // Tool conflict resolution
    private crossSourceConflicts: Set<string> = new Set();
    private static readonly MCP_PREFIX = 'mcp';
    private static readonly CUSTOM_PREFIX = 'custom';
    private static readonly SOURCE_DELIMITER = '--';

    constructor(mcpManager: MCPManager, confirmationProvider: ToolConfirmationProvider) {
        this.mcpManager = mcpManager;
        this.confirmationProvider = confirmationProvider;

        logger.debug('ToolManager initialized');
    }

    /**
     * Get the MCPManager for system prompt contributors
     */
    getMcpManager(): MCPManager {
        return this.mcpManager;
    }

    /**
     * Initialize custom tools if configured
     */
    async initializeCustomTools(customToolsConfig: ValidatedCustomToolsConfig): Promise<void> {
        if (!this.customToolProvider) {
            this.customToolProvider = new CustomToolProvider(
                customToolsConfig,
                this.confirmationProvider
            );
            await this.customToolProvider.initialize();

            // Rebuild conflicts after custom tools are loaded
            await this.rebuildCrossSourceConflicts();

            logger.info(
                `Custom tools initialized: ${this.customToolProvider.getToolNames().length} tools available`
            );
        }
    }

    /**
     * Get all available tools from all sources with conflict resolution
     * This is the single interface the LLM uses to discover tools
     */
    async getAllTools(): Promise<ToolSet> {
        const allTools: ToolSet = {};

        // Get tools from both sources
        const mcpTools = await this.mcpManager.getAllTools();
        let customTools = {};

        try {
            customTools = this.customToolProvider?.getAllTools() || {};
        } catch (error) {
            logger.warn(
                `Failed to get custom tools: ${error instanceof Error ? error.message : String(error)}`
            );
            customTools = {};
        }

        // Rebuild conflicts before processing
        await this.rebuildCrossSourceConflicts();

        // Add non-conflicted tools directly
        for (const [toolName, toolDef] of Object.entries(mcpTools)) {
            if (!this.crossSourceConflicts.has(toolName)) {
                allTools[toolName] = {
                    description: toolDef.description || 'No description provided',
                    ...(toolDef.parameters &&
                        (toolDef.parameters.type === 'object' || !toolDef.parameters.type) && {
                            parameters: {
                                type: 'object' as const,
                                properties: toolDef.parameters.properties || {},
                                ...(toolDef.parameters.required && {
                                    required: toolDef.parameters.required,
                                }),
                            },
                        }),
                };
            }
        }

        for (const [toolName, toolDef] of Object.entries(customTools)) {
            if (!this.crossSourceConflicts.has(toolName)) {
                const typedToolDef = toolDef as any;
                allTools[toolName] = {
                    description: typedToolDef.description || 'No description provided',
                    ...(typedToolDef.parameters &&
                        typedToolDef.parameters.type === 'object' && {
                            parameters: typedToolDef.parameters as {
                                type: 'object';
                                properties: Record<string, any>;
                                required?: string[];
                            },
                        }),
                };
            }
        }

        // Add conflicted tools with source prefixes
        for (const toolName of this.crossSourceConflicts) {
            // Add MCP version with prefix
            if (mcpTools[toolName]) {
                const qualifiedName = `${ToolManager.MCP_PREFIX}${ToolManager.SOURCE_DELIMITER}${toolName}`;
                allTools[qualifiedName] = {
                    description: `${mcpTools[toolName].description || 'No description provided'} (via MCP servers)`,
                    ...(mcpTools[toolName].parameters &&
                        (mcpTools[toolName].parameters.type === 'object' ||
                            !mcpTools[toolName].parameters.type) && {
                            parameters: {
                                type: 'object' as const,
                                properties: mcpTools[toolName].parameters.properties || {},
                                ...(mcpTools[toolName].parameters.required && {
                                    required: mcpTools[toolName].parameters.required,
                                }),
                            },
                        }),
                };
            }

            // Add custom version with prefix
            if ((customTools as Record<string, any>)[toolName]) {
                const typedCustomTool = (customTools as Record<string, any>)[toolName];
                const qualifiedName = `${ToolManager.CUSTOM_PREFIX}${ToolManager.SOURCE_DELIMITER}${toolName}`;
                allTools[qualifiedName] = {
                    description: `${typedCustomTool.description || 'Custom tool'} (custom tool)`,
                    ...(typedCustomTool.parameters &&
                        typedCustomTool.parameters.type === 'object' && {
                            parameters: typedCustomTool.parameters as {
                                type: 'object';
                                properties: Record<string, any>;
                                required?: string[];
                            },
                        }),
                };
            }
        }

        const totalTools = Object.keys(allTools).length;
        const mcpCount = Object.keys(mcpTools).length;
        const customCount = Object.keys(customTools).length;
        const conflictCount = this.crossSourceConflicts.size;

        logger.debug(
            `🔧 Unified tool discovery: ${totalTools} total tools (${mcpCount} MCP, ${customCount} custom, ${conflictCount} conflicts)`
        );

        return allTools;
    }

    /**
     * Execute a tool by routing to the appropriate source
     * This is the single interface the LLM uses to execute tools
     */
    async executeTool(toolName: string, args: any, sessionId?: string): Promise<any> {
        logger.debug(`🔧 Unified tool execution requested: '${toolName}'`);
        logger.debug(`Tool args: ${JSON.stringify(args, null, 2)}`);

        // Parse tool name to determine source and actual tool name
        const { source, actualToolName } = this.parseToolName(toolName);

        logger.debug(
            `🎯 Tool routing: '${toolName}' -> source: '${source}', actual: '${actualToolName}'`
        );

        // Route to appropriate source
        switch (source) {
            case 'custom': {
                if (!this.customToolProvider) {
                    throw new Error(`Custom tools not initialized, cannot execute: ${toolName}`);
                }

                const context: ToolExecutionContext = { sessionId };
                return await this.customToolProvider.executeTool(actualToolName, args, context);
            }

            case 'mcp':
                return await this.mcpManager.executeTool(actualToolName, args, sessionId);

            case 'auto':
                // Auto-detect source for non-qualified tool names
                return await this.executeAutoDetectedTool(actualToolName, args, sessionId);

            default:
                throw new Error(`Unknown tool source: ${source}`);
        }
    }

    /**
     * Check if a tool exists across all sources
     */
    async hasTool(toolName: string): Promise<boolean> {
        const { source, actualToolName } = this.parseToolName(toolName);

        switch (source) {
            case 'custom':
                return this.customToolProvider?.hasTool(actualToolName) ?? false;
            case 'mcp':
                return this.mcpManager.getToolClient(actualToolName) !== undefined;
            case 'auto': {
                // Check both sources for non-qualified names
                const hasCustom = this.customToolProvider?.hasTool(actualToolName) ?? false;
                const hasMcp = this.mcpManager.getToolClient(actualToolName) !== undefined;
                return hasCustom || hasMcp;
            }
            default:
                return false;
        }
    }

    /**
     * Get tool statistics across all sources
     */
    async getToolStats(): Promise<{
        total: number;
        mcp: number;
        custom: number;
        conflicts: number;
    }> {
        const mcpTools = await this.mcpManager.getAllTools();
        const customTools = this.customToolProvider?.getAllTools() || {};

        return {
            total: Object.keys(mcpTools).length + Object.keys(customTools).length,
            mcp: Object.keys(mcpTools).length,
            custom: Object.keys(customTools).length,
            conflicts: this.crossSourceConflicts.size,
        };
    }

    /**
     * Parse tool name to determine source and actual tool name
     */
    private parseToolName(toolName: string): {
        source: 'mcp' | 'custom' | 'auto';
        actualToolName: string;
    } {
        // Check for source prefix
        if (toolName.startsWith(`${ToolManager.MCP_PREFIX}${ToolManager.SOURCE_DELIMITER}`)) {
            return {
                source: 'mcp',
                actualToolName: toolName.substring(
                    `${ToolManager.MCP_PREFIX}${ToolManager.SOURCE_DELIMITER}`.length
                ),
            };
        }

        if (toolName.startsWith(`${ToolManager.CUSTOM_PREFIX}${ToolManager.SOURCE_DELIMITER}`)) {
            return {
                source: 'custom',
                actualToolName: toolName.substring(
                    `${ToolManager.CUSTOM_PREFIX}${ToolManager.SOURCE_DELIMITER}`.length
                ),
            };
        }

        // No prefix - auto-detect
        return {
            source: 'auto',
            actualToolName: toolName,
        };
    }

    /**
     * Execute tool with auto-detection of source
     */
    private async executeAutoDetectedTool(
        toolName: string,
        args: any,
        sessionId?: string
    ): Promise<any> {
        // Check custom tools first (they have precedence)
        if (this.customToolProvider?.hasTool(toolName)) {
            logger.debug(`🎯 Auto-routing to custom tool: '${toolName}'`);
            const context: ToolExecutionContext = { sessionId };
            return await this.customToolProvider.executeTool(toolName, args, context);
        }

        // Fall back to MCP tools
        if (this.mcpManager.getToolClient(toolName)) {
            logger.debug(`🎯 Auto-routing to MCP tool: '${toolName}'`);
            return await this.mcpManager.executeTool(toolName, args, sessionId);
        }

        // Tool not found in any source
        const stats = await this.getToolStats();
        logger.error(`❌ Tool not found in any source: ${toolName}`);
        logger.debug(`Available sources: ${stats.mcp} MCP tools, ${stats.custom} custom tools`);

        throw new Error(`Tool not found: ${toolName}`);
    }

    /**
     * Update cross-source conflict detection (for tests)
     */
    async updateCrossSourceConflicts(): Promise<void> {
        return this.rebuildCrossSourceConflicts();
    }

    /**
     * Rebuild cross-source conflict detection
     */
    private async rebuildCrossSourceConflicts(): Promise<void> {
        this.crossSourceConflicts.clear();

        if (!this.customToolProvider) {
            return; // No custom tools, no conflicts possible
        }

        const mcpTools = await this.mcpManager.getAllTools();
        let customTools = {};

        try {
            customTools = this.customToolProvider?.getAllTools() || {};
        } catch (error) {
            logger.warn(
                `Failed to get custom tools during conflict detection: ${error instanceof Error ? error.message : String(error)}`
            );
            customTools = {};
        }

        // Find tools that exist in both sources
        for (const toolName of Object.keys(customTools)) {
            if (mcpTools[toolName]) {
                this.crossSourceConflicts.add(toolName);
                logger.debug(`🔀 Cross-source conflict detected: '${toolName}'`);
            }
        }

        logger.debug(
            `Cross-source conflict resolution: ${this.crossSourceConflicts.size} conflicts`
        );
    }

    /**
     * Refresh tool discovery (call when MCP servers change)
     */
    async refresh(): Promise<void> {
        await this.rebuildCrossSourceConflicts();
        logger.debug('ToolManager refreshed');
    }
}
