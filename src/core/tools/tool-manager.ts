import { MCPManager } from '../client/manager.js';
import { InternalToolsProvider } from './internal-tools-provider.js';
import { ToolManagerToolSet, ToolParameters, RawToolDefinition } from './types.js';
import { ToolConfirmationProvider } from '../client/tool-confirmation/types.js';
import { logger } from '../logger/index.js';

/**
 * Unified Tool Manager - Single interface for all tool operations
 *
 * This class acts as the single point of contact between the LLM and all tool sources.
 * It aggregates tools from MCP servers and internal tools, providing a unified interface
 * for tool discovery, aggregation, and execution.
 *
 * Responsibilities:
 * - Aggregate tools from MCP servers and internal tools with conflict resolution
 * - Route tool execution to appropriate source (MCP vs Internal)
 * - Provide unified tool interface to LLM
 * - Manage tool confirmation and security
 * - Handle cross-source naming conflicts (internal tools have precedence)
 *
 * Architecture:
 * LLMService → ToolManager → [MCPManager, InternalToolsProvider]
 */
export class ToolManager {
    private mcpManager: MCPManager;
    private internalToolsProvider?: InternalToolsProvider;
    private confirmationProvider: ToolConfirmationProvider;

    // Tool conflict resolution - only internal vs MCP conflicts now
    private static readonly MCP_PREFIX = 'mcp';
    private static readonly INTERNAL_PREFIX = 'internal';
    private static readonly SOURCE_DELIMITER = '--';

    // Tool caching for performance
    private toolsCache: ToolManagerToolSet = {};
    private cacheValid: boolean = false;

    constructor(mcpManager: MCPManager, confirmationProvider: ToolConfirmationProvider) {
        this.mcpManager = mcpManager;
        this.confirmationProvider = confirmationProvider;

        logger.debug('ToolManager initialized');
    }

    /**
     * Invalidate the tools cache when tool sources change
     */
    private invalidateCache(): void {
        this.cacheValid = false;
        this.toolsCache = {};
    }

    /**
     * Get the MCPManager for system prompt contributors
     */
    getMcpManager(): MCPManager {
        return this.mcpManager;
    }

    /**
     * Get all MCP tools (delegates to mcpManager.getAllTools())
     * This provides access to MCP tools while maintaining separation of concerns
     */
    async getMcpTools(): Promise<ToolManagerToolSet> {
        const mcpTools = await this.mcpManager.getAllTools();

        // Convert ToolSet to ToolManagerToolSet format
        const convertedTools: ToolManagerToolSet = {};
        for (const [toolName, toolDef] of Object.entries(mcpTools)) {
            // Convert parameters if they exist and are object type
            let convertedParameters: ToolParameters | undefined;
            if (toolDef.parameters && toolDef.parameters.type === 'object') {
                convertedParameters = {
                    type: 'object',
                    properties: toolDef.parameters.properties || {},
                    ...(toolDef.parameters.required && {
                        required: toolDef.parameters.required,
                    }),
                };
            }

            convertedTools[toolName] = {
                name: toolName,
                description: toolDef.description || 'No description provided',
                ...(convertedParameters && { parameters: convertedParameters }),
            };
        }

        return convertedTools;
    }

    /**
     * Initialize internal tools if configured
     */
    async initializeInternalTools(internalToolsProvider: InternalToolsProvider): Promise<void> {
        if (!this.internalToolsProvider) {
            this.internalToolsProvider = internalToolsProvider;
            await this.internalToolsProvider.initialize();

            // Invalidate cache since tools have changed
            this.invalidateCache();

            logger.info(
                `Internal tools initialized: ${this.internalToolsProvider.getToolNames().length} tools available`
            );
        }
    }

    /**
     * Normalize tool parameters to ensure consistent structure
     */
    private normalizeToolParameters(toolDef: RawToolDefinition): ToolParameters | undefined {
        if (!toolDef.parameters) {
            return undefined;
        }

        // Handle object type parameters (both MCP and custom tools)
        if (toolDef.parameters.type === 'object' || !toolDef.parameters.type) {
            return {
                type: 'object',
                properties: toolDef.parameters.properties || {},
                ...(toolDef.parameters.required && {
                    required: toolDef.parameters.required,
                }),
            };
        }

        return undefined;
    }

    /**
     * Build normalized tool definition
     */
    private buildNormalizedToolDefinition(
        toolName: string,
        toolDef: RawToolDefinition,
        description: string | undefined
    ): ToolManagerToolSet[string] {
        const normalizedParams = this.normalizeToolParameters(toolDef);

        return {
            name: toolName,
            description: description || 'No description provided',
            ...(normalizedParams && { parameters: normalizedParams }),
        };
    }

    /**
     * Build all tools from sources with conflict resolution
     */
    private async buildAllTools(): Promise<ToolManagerToolSet> {
        const allTools: ToolManagerToolSet = {};

        // Get tools from all sources
        const mcpTools = await this.mcpManager.getAllTools();
        let internalTools: ToolManagerToolSet = {};

        try {
            internalTools = this.internalToolsProvider?.getAllTools() || {};
        } catch (error) {
            logger.warn(
                `Failed to get internal tools: ${error instanceof Error ? error.message : String(error)}`
            );
            internalTools = {};
        }

        // Add internal tools first (they have highest precedence)
        for (const [toolName, toolDef] of Object.entries(internalTools)) {
            allTools[toolName] = this.buildNormalizedToolDefinition(
                toolName,
                toolDef,
                toolDef.description
            );
        }

        // Add MCP tools, but prefix them if they conflict with internal tools
        for (const [toolName, toolDef] of Object.entries(mcpTools)) {
            if (internalTools[toolName]) {
                // Internal tool takes precedence, add MCP version with prefix
                const qualifiedName = `${ToolManager.MCP_PREFIX}${ToolManager.SOURCE_DELIMITER}${toolName}`;
                allTools[qualifiedName] = this.buildNormalizedToolDefinition(
                    qualifiedName,
                    toolDef,
                    `${toolDef.description || 'No description provided'} (via MCP servers)`
                );
            } else {
                // No conflict, add directly
                allTools[toolName] = this.buildNormalizedToolDefinition(
                    toolName,
                    toolDef,
                    toolDef.description
                );
            }
        }

        const totalTools = Object.keys(allTools).length;
        const mcpCount = Object.keys(mcpTools).length;
        const internalCount = Object.keys(internalTools).length;
        const conflictCount = Object.keys(internalTools).filter((name) => mcpTools[name]).length;

        logger.debug(
            `🔧 Unified tool discovery: ${totalTools} total tools (${mcpCount} MCP, ${internalCount} internal, ${conflictCount} conflicts)`
        );

        return allTools;
    }

    /**
     * Get all available tools from all sources with conflict resolution
     * This is the single interface the LLM uses to discover tools
     * Uses caching to avoid rebuilding on every call
     */
    async getAllTools(): Promise<ToolManagerToolSet> {
        if (this.cacheValid) {
            return this.toolsCache;
        }

        this.toolsCache = await this.buildAllTools();
        this.cacheValid = true;
        return this.toolsCache;
    }

    /**
     * Execute a tool by routing to the appropriate source
     * This is the single interface the LLM uses to execute tools
     */
    async executeTool(
        toolName: string,
        args: Record<string, unknown>,
        sessionId?: string
    ): Promise<unknown> {
        logger.debug(`🔧 Unified tool execution requested: '${toolName}'`);
        logger.debug(`Tool args: ${JSON.stringify(args, null, 2)}`);

        // Parse tool name to determine source and actual tool name
        const { source, actualToolName } = this.parseToolName(toolName);

        logger.debug(
            `🎯 Tool routing: '${toolName}' -> source: '${source}', actual: '${actualToolName}'`
        );

        // Route to appropriate source
        switch (source) {
            case 'internal': {
                if (!this.internalToolsProvider) {
                    throw new Error(`Internal tools not initialized, cannot execute: ${toolName}`);
                }

                return await this.internalToolsProvider.executeTool(
                    actualToolName,
                    args,
                    sessionId
                );
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
            case 'internal':
                return this.internalToolsProvider?.hasTool(actualToolName) ?? false;
            case 'mcp':
                return this.mcpManager.getToolClient(actualToolName) !== undefined;
            case 'auto': {
                // Check all sources for non-qualified names (internal has precedence)
                const hasInternal = this.internalToolsProvider?.hasTool(actualToolName) ?? false;
                const hasMcp = this.mcpManager.getToolClient(actualToolName) !== undefined;
                return hasInternal || hasMcp;
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
        internal: number;
        conflicts: number;
    }> {
        const mcpTools = await this.mcpManager.getAllTools();
        const internalTools = this.internalToolsProvider?.getAllTools() || {};
        const conflicts = Object.keys(internalTools).filter((name) => mcpTools[name]).length;

        // Calculate total as unique tool keys to avoid double-counting
        const allToolKeys = new Set([...Object.keys(mcpTools), ...Object.keys(internalTools)]);

        return {
            total: allToolKeys.size,
            mcp: Object.keys(mcpTools).length,
            internal: Object.keys(internalTools).length,
            conflicts,
        };
    }

    /**
     * Get the source of a tool (mcp, internal, or auto)
     * @param toolName The name of the tool to check
     * @returns The source of the tool
     */
    getToolSource(toolName: string): 'mcp' | 'internal' | 'auto' {
        const { source } = this.parseToolName(toolName);
        return source;
    }

    /**
     * Parse tool name to determine source and actual tool name
     */
    private parseToolName(toolName: string): {
        source: 'mcp' | 'internal' | 'auto';
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

        if (toolName.startsWith(`${ToolManager.INTERNAL_PREFIX}${ToolManager.SOURCE_DELIMITER}`)) {
            return {
                source: 'internal',
                actualToolName: toolName.substring(
                    `${ToolManager.INTERNAL_PREFIX}${ToolManager.SOURCE_DELIMITER}`.length
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
        args: Record<string, unknown>,
        sessionId?: string
    ): Promise<unknown> {
        // Check internal tools first (they have highest precedence)
        if (this.internalToolsProvider?.hasTool(toolName)) {
            logger.debug(`🎯 Auto-routing to internal tool: '${toolName}'`);
            return await this.internalToolsProvider.executeTool(toolName, args, sessionId);
        }

        // Fall back to MCP tools
        if (this.mcpManager.getToolClient(toolName)) {
            logger.debug(`🎯 Auto-routing to MCP tool: '${toolName}'`);
            return await this.mcpManager.executeTool(toolName, args, sessionId);
        }

        // Tool not found in any source
        const stats = await this.getToolStats();
        logger.error(`❌ Tool not found in any source: ${toolName}`);
        logger.debug(`Available sources: ${stats.mcp} MCP tools, ${stats.internal} internal tools`);

        throw new Error(`Tool not found: ${toolName}`);
    }

    /**
     * Refresh tool discovery (call when MCP servers change)
     */
    async refresh(): Promise<void> {
        // Invalidate cache since MCP servers may have changed
        this.invalidateCache();

        logger.debug('ToolManager refreshed');
    }
}
