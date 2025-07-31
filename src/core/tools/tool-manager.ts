import { MCPManager } from '../client/manager.js';
import {
    InternalToolsProvider,
    InternalToolsServices,
    InternalToolsConfig,
} from './internal-tools-provider.js';
import { ToolSet } from './types.js';
import { ToolConfirmationProvider } from './confirmation/types.js';
import { logger } from '../logger/index.js';

/**
 * Options for ToolManager configuration
 */
export interface ToolManagerOptions {
    internalToolsServices?: InternalToolsServices;
    internalToolsConfig?: InternalToolsConfig;
}

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
    private toolsCache: ToolSet = {};
    private cacheValid: boolean = false;

    constructor(
        mcpManager: MCPManager,
        confirmationProvider: ToolConfirmationProvider,
        options?: ToolManagerOptions
    ) {
        this.mcpManager = mcpManager;
        this.confirmationProvider = confirmationProvider;

        // Initialize internal tools if configured
        if (options?.internalToolsConfig && options.internalToolsConfig.length > 0) {
            this.internalToolsProvider = new InternalToolsProvider(
                options.internalToolsServices || {},
                confirmationProvider,
                options.internalToolsConfig
            );
        }

        logger.debug('ToolManager initialized');
    }

    /**
     * Initialize the ToolManager and its components
     */
    async initialize(): Promise<void> {
        if (this.internalToolsProvider) {
            await this.internalToolsProvider.initialize();
        }
        logger.debug('ToolManager initialization complete');
    }

    /**
     * Invalidate the tools cache when tool sources change
     */
    private invalidateCache(): void {
        this.cacheValid = false;
        this.toolsCache = {};
    }

    getMcpManager(): MCPManager {
        return this.mcpManager;
    }

    /**
     * Get all MCP tools (delegates to mcpManager.getAllTools())
     * This provides access to MCP tools while maintaining separation of concerns
     */
    async getMcpTools(): Promise<ToolSet> {
        return await this.mcpManager.getAllTools();
    }

    /**
     * Build all tools from sources with conflict resolution - NO normalization
     */
    private async buildAllTools(): Promise<ToolSet> {
        const allTools: ToolSet = {};

        // Get tools from both sources (already in final JSON Schema format)
        const mcpTools = await this.mcpManager.getAllTools();
        let internalTools: ToolSet = {};

        try {
            internalTools = this.internalToolsProvider?.getAllTools() || {};
        } catch (error) {
            logger.warn(
                `Failed to get internal tools: ${error instanceof Error ? error.message : String(error)}`
            );
            internalTools = {};
        }

        // Add internal tools first (highest precedence)
        Object.assign(allTools, internalTools);

        // Add MCP tools with conflict resolution
        for (const [toolName, toolDef] of Object.entries(mcpTools)) {
            if (internalTools[toolName]) {
                // Conflict: prefix MCP tool
                const qualifiedName = `${ToolManager.MCP_PREFIX}${ToolManager.SOURCE_DELIMITER}${toolName}`;
                allTools[qualifiedName] = {
                    ...toolDef,
                    name: qualifiedName,
                    description: `${toolDef.description || 'No description provided'} (via MCP servers)`,
                };
            } else {
                // No conflict: add directly
                allTools[toolName] = toolDef;
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
    async getAllTools(): Promise<ToolSet> {
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
        logger.debug(`🔧 Tool execution: '${toolName}'`);
        logger.debug(`Tool args: ${JSON.stringify(args, null, 2)}`);

        // Handle explicit MCP prefix (for conflicts)
        if (toolName.startsWith('mcp--')) {
            const actualToolName = toolName.substring(5); // Remove 'mcp--'
            logger.debug(`🎯 Explicit MCP routing: '${toolName}' -> '${actualToolName}'`);
            return await this.mcpManager.executeTool(actualToolName, args, sessionId);
        }

        // Handle explicit internal prefix (for completeness)
        if (toolName.startsWith('internal--')) {
            const actualToolName = toolName.substring(10); // Remove 'internal--'
            if (!this.internalToolsProvider) {
                throw new Error(`Internal tools not initialized, cannot execute: ${toolName}`);
            }
            logger.debug(`🎯 Explicit internal routing: '${toolName}' -> '${actualToolName}'`);
            return await this.internalToolsProvider.executeTool(actualToolName, args, sessionId);
        }

        // Auto-detection priority: Internal → MCP
        if (this.internalToolsProvider?.hasTool(toolName)) {
            logger.debug(`🎯 Auto-routing to internal: '${toolName}'`);
            return await this.internalToolsProvider.executeTool(toolName, args, sessionId);
        }

        if (this.mcpManager.getToolClient(toolName)) {
            logger.debug(`🎯 Auto-routing to MCP: '${toolName}'`);
            return await this.mcpManager.executeTool(toolName, args, sessionId);
        }

        // Tool not found in any source
        const stats = await this.getToolStats();
        logger.error(`❌ Tool not found in any source: ${toolName}`);
        logger.debug(`Available sources: ${stats.mcp} MCP tools, ${stats.internal} internal tools`);

        throw new Error(`Tool not found: ${toolName}`);
    }

    /**
     * Check if a tool exists across all sources
     */
    async hasTool(toolName: string): Promise<boolean> {
        // Handle explicit MCP prefix
        if (toolName.startsWith('mcp--')) {
            const actualToolName = toolName.substring(5);
            return this.mcpManager.getToolClient(actualToolName) !== undefined;
        }

        // Handle explicit internal prefix
        if (toolName.startsWith('internal--')) {
            const actualToolName = toolName.substring(10);
            return this.internalToolsProvider?.hasTool(actualToolName) ?? false;
        }

        // Auto-detection: check both sources
        const hasInternal = this.internalToolsProvider?.hasTool(toolName) ?? false;
        const hasMcp = this.mcpManager.getToolClient(toolName) !== undefined;
        return hasInternal || hasMcp;
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
        if (toolName.startsWith('mcp--')) {
            return 'mcp';
        }
        if (toolName.startsWith('internal--')) {
            return 'internal';
        }
        return 'auto';
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
