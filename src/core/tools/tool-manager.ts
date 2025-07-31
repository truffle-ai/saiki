import { MCPManager } from '../client/manager.js';
import { InternalToolsProvider } from './internal-tools/provider.js';
import { InternalToolsServices } from './internal-tools/registry.js';
import type { InternalToolsConfig } from '../config/schemas.js';
import { ToolSet } from './types.js';
import { ToolConfirmationProvider } from './confirmation/types.js';
import { logger } from '../logger/index.js';

/**
 * Options for internal tools configuration in ToolManager
 */
export interface InternalToolsOptions {
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

    // Tool source prefixing - ALL tools get prefixed by source
    private static readonly MCP_TOOL_PREFIX = 'mcp--';
    private static readonly INTERNAL_TOOL_PREFIX = 'internal--';

    // Tool caching for performance
    private toolsCache: ToolSet = {};
    private cacheValid: boolean = false;

    constructor(
        mcpManager: MCPManager,
        confirmationProvider: ToolConfirmationProvider,
        options?: InternalToolsOptions
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
     * Build all tools from sources with universal prefixing
     * ALL tools get prefixed by their source - no exceptions
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

        // Add ALL internal tools with prefix
        for (const [toolName, toolDef] of Object.entries(internalTools)) {
            const qualifiedName = `${ToolManager.INTERNAL_TOOL_PREFIX}${toolName}`;
            allTools[qualifiedName] = {
                ...toolDef,
                name: qualifiedName,
                description: `${toolDef.description || 'No description provided'} (internal tool)`,
            };
        }

        // Add ALL MCP tools with prefix
        for (const [toolName, toolDef] of Object.entries(mcpTools)) {
            const qualifiedName = `${ToolManager.MCP_TOOL_PREFIX}${toolName}`;
            allTools[qualifiedName] = {
                ...toolDef,
                name: qualifiedName,
                description: `${toolDef.description || 'No description provided'} (via MCP servers)`,
            };
        }

        const totalTools = Object.keys(allTools).length;
        const mcpCount = Object.keys(mcpTools).length;
        const internalCount = Object.keys(internalTools).length;

        logger.debug(
            `🔧 Unified tool discovery: ${totalTools} total tools (${mcpCount} MCP → ${ToolManager.MCP_TOOL_PREFIX}*, ${internalCount} internal → ${ToolManager.INTERNAL_TOOL_PREFIX}*)`
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
     * Execute a tool by routing based on universal prefix
     * ALL tools must have source prefix - no exceptions
     */
    async executeTool(
        toolName: string,
        args: Record<string, unknown>,
        sessionId?: string
    ): Promise<unknown> {
        logger.debug(`🔧 Tool execution: '${toolName}'`);
        logger.debug(`Tool args: ${JSON.stringify(args, null, 2)}`);

        // Route to MCP tools
        if (toolName.startsWith(ToolManager.MCP_TOOL_PREFIX)) {
            const actualToolName = toolName.substring(ToolManager.MCP_TOOL_PREFIX.length);
            logger.debug(`🎯 MCP routing: '${toolName}' -> '${actualToolName}'`);
            return await this.mcpManager.executeTool(actualToolName, args, sessionId);
        }

        // Route to internal tools
        if (toolName.startsWith(ToolManager.INTERNAL_TOOL_PREFIX)) {
            const actualToolName = toolName.substring(ToolManager.INTERNAL_TOOL_PREFIX.length);
            if (!this.internalToolsProvider) {
                throw new Error(`Internal tools not initialized, cannot execute: ${toolName}`);
            }
            logger.debug(`🎯 Internal routing: '${toolName}' -> '${actualToolName}'`);
            return await this.internalToolsProvider.executeTool(actualToolName, args, sessionId);
        }

        // Tool doesn't have proper prefix
        const stats = await this.getToolStats();
        logger.error(
            `❌ Tool missing source prefix: '${toolName}' (expected '${ToolManager.MCP_TOOL_PREFIX}*' or '${ToolManager.INTERNAL_TOOL_PREFIX}*')`
        );
        logger.debug(`Available: ${stats.mcp} MCP tools, ${stats.internal} internal tools`);

        throw new Error(`Tool not found or missing source prefix: ${toolName}`);
    }

    /**
     * Check if a tool exists (must have proper source prefix)
     */
    async hasTool(toolName: string): Promise<boolean> {
        // Check MCP tools
        if (toolName.startsWith(ToolManager.MCP_TOOL_PREFIX)) {
            const actualToolName = toolName.substring(ToolManager.MCP_TOOL_PREFIX.length);
            return this.mcpManager.getToolClient(actualToolName) !== undefined;
        }

        // Check internal tools
        if (toolName.startsWith(ToolManager.INTERNAL_TOOL_PREFIX)) {
            const actualToolName = toolName.substring(ToolManager.INTERNAL_TOOL_PREFIX.length);
            return this.internalToolsProvider?.hasTool(actualToolName) ?? false;
        }

        // Tool without proper prefix doesn't exist
        return false;
    }

    /**
     * Get tool statistics across all sources
     */
    async getToolStats(): Promise<{
        total: number;
        mcp: number;
        internal: number;
    }> {
        const mcpTools = await this.mcpManager.getAllTools();
        const internalTools = this.internalToolsProvider?.getAllTools() || {};

        const mcpCount = Object.keys(mcpTools).length;
        const internalCount = Object.keys(internalTools).length;

        return {
            total: mcpCount + internalCount, // No conflicts with universal prefixing
            mcp: mcpCount,
            internal: internalCount,
        };
    }

    /**
     * Get the source of a tool (mcp, internal, or unknown)
     * @param toolName The name of the tool to check
     * @returns The source of the tool
     */
    getToolSource(toolName: string): 'mcp' | 'internal' | 'unknown' {
        if (toolName.startsWith(ToolManager.MCP_TOOL_PREFIX)) {
            return 'mcp';
        }
        if (toolName.startsWith(ToolManager.INTERNAL_TOOL_PREFIX)) {
            return 'internal';
        }
        return 'unknown';
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
