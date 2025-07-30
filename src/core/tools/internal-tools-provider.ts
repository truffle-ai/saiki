import { ToolRegistry } from './tool-registry.js';
import { ToolExecutor } from './tool-executor.js';
import { ToolExecutionContext, ToolManagerToolSet } from './types.js';
import { ToolConfirmationProvider } from '../client/tool-confirmation/types.js';
import { SearchService } from '../ai/search/search-service.js';
import { createSearchHistoryTool } from './internal-tools/search-history-tool.js';
import { logger } from '../logger/index.js';

/**
 * Services available to internal tools
 * Add new services here as needed for internal tools
 */
export interface InternalToolsServices {
    searchService?: SearchService;
    // Future services can be added here:
    // sessionManager?: SessionManager;
    // storageManager?: StorageManager;
    // eventBus?: AgentEventBus;
}

/**
 * Provider for built-in internal tools that are part of the core system
 *
 * This provider follows the same pattern as CustomToolsProvider but is specifically
 * for internal tools that are shipped with the core system and need access to
 * core services like SearchService, SessionManager, etc.
 *
 * Benefits:
 * - Clean separation: ToolManager doesn't need to know about specific services
 * - Easy to extend: Just add new tools and services as needed
 * - Follows existing patterns: Same architecture as CustomToolsProvider
 * - Service injection at the right level: Services come here, not to ToolManager
 */
export class InternalToolsProvider {
    private registry: ToolRegistry;
    private executor: ToolExecutor;
    private services: InternalToolsServices;

    constructor(services: InternalToolsServices, confirmationProvider?: ToolConfirmationProvider) {
        this.services = services;

        // Initialize service classes with minimal config for internal tools
        this.registry = new ToolRegistry();
        this.executor = new ToolExecutor(
            this.registry,
            {
                enabledTools: 'all',
                toolConfigs: {},
                globalSettings: {
                    requiresConfirmation: false,
                    timeout: 30000,
                },
            },
            confirmationProvider
        );

        logger.debug('InternalToolsProvider initialized');
    }

    /**
     * Initialize the internal tools provider by registering all available internal tools
     */
    async initialize(): Promise<void> {
        logger.info('Initializing InternalToolsProvider...');

        try {
            this.registerInternalTools();

            const toolCount = this.registry.getToolIds().length;
            logger.info(`InternalToolsProvider initialized with ${toolCount} internal tools`);
        } catch (error) {
            logger.error(
                `Failed to initialize InternalToolsProvider: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    }

    /**
     * Register all available internal tools based on available services
     */
    private registerInternalTools(): void {
        // Register search_history tool if SearchService is available
        if (this.services.searchService) {
            const searchHistoryTool = createSearchHistoryTool(this.services.searchService);
            this.registry.register(searchHistoryTool);
            logger.debug('Registered internal search_history tool');
        }

        // Future internal tools can be registered here:
        // if (this.services.sessionManager) {
        //     const sessionTool = createSessionManagementTool(this.services.sessionManager);
        //     this.registry.register(sessionTool);
        // }
    }

    /**
     * Check if a tool exists (delegates to ToolExecutor)
     */
    hasTool(toolId: string): boolean {
        return this.executor.hasTool(toolId);
    }

    /**
     * Execute a tool (delegates to ToolExecutor)
     */
    async executeTool(
        toolId: string,
        args: Record<string, any>,
        context?: ToolExecutionContext
    ): Promise<any> {
        return await this.executor.executeTool(toolId, args, context);
    }

    /**
     * Get all tools in ToolSet format (delegates to ToolExecutor)
     */
    getAllTools(): ToolManagerToolSet {
        return this.executor.getAllTools();
    }

    /**
     * Get tool names (delegates to ToolExecutor)
     */
    getToolNames(): string[] {
        return this.executor.getToolNames();
    }

    /**
     * Get tools by category (delegates to ToolExecutor)
     */
    getToolsByCategory(category: string): ToolManagerToolSet {
        return this.executor.getToolsByCategory(category);
    }

    /**
     * Get tools by tags (delegates to ToolExecutor)
     */
    getToolsByTags(tags: string[]): ToolManagerToolSet {
        return this.executor.getToolsByTags(tags);
    }

    /**
     * Get execution statistics (delegates to ToolExecutor)
     */
    getStats(): {
        totalTools: number;
        categories: Record<string, number>;
        tags: Record<string, number>;
    } {
        return this.executor.getStats();
    }

    /**
     * Clear all tools (delegates to ToolRegistry)
     */
    clear(): void {
        this.registry.clear();
    }
}
