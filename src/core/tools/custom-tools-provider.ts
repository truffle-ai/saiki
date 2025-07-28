import { ToolRegistry } from './tool-registry.js';
import { ToolExecutor } from './tool-executor.js';
import { ToolExecutionContext, ToolSet, Tool } from './types.js';
import { ValidatedCustomToolsConfig } from '../config/schemas.js';
import { ToolConfirmationProvider } from '../client/tool-confirmation/types.js';
import { logger } from '../logger/index.js';

/**
 * Provides custom tool functionality using dedicated service classes
 *
 * This provider follows the codebase pattern of being a thin orchestrator
 * that delegates to specialized service classes for custom tools
 */
export class CustomToolsProvider {
    private registry: ToolRegistry;
    private executor: ToolExecutor;
    private config: ValidatedCustomToolsConfig;

    constructor(
        config: ValidatedCustomToolsConfig = {} as ValidatedCustomToolsConfig,
        confirmationProvider?: ToolConfirmationProvider
    ) {
        // Use defaults if config is incomplete
        this.config = {
            enabledTools: config.enabledTools ?? 'all',
            disabledTools: config.disabledTools ?? [],
            toolConfigs: config.toolConfigs || {},
            globalSettings: config.globalSettings || {
                requiresConfirmation: false,
                timeout: 30000,
                enableCaching: false,
            },
        };

        // Initialize service classes
        this.registry = new ToolRegistry();
        this.executor = new ToolExecutor(this.registry, this.config, confirmationProvider);

        logger.debug(`CustomToolsProvider initialized with config: ${JSON.stringify(this.config)}`);
    }

    /**
     * Initialize the tool provider
     * Tools are automatically registered when createTool() is called, so this just loads them
     */
    async initialize(): Promise<void> {
        logger.info('Initializing CustomToolsProvider...');

        try {
            // Load tools from the global registry (tools register themselves via createTool)
            await this.loadRegisteredTools();

            const toolCount = this.registry.getToolIds().length;
            logger.info(`CustomToolsProvider initialized with ${toolCount} tools`);
        } catch (error) {
            logger.error(
                `Failed to initialize CustomToolsProvider: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    }

    /**
     * Load tools from the global registry (tools register themselves via createTool)
     */
    private async loadRegisteredTools(): Promise<void> {
        // Import the global registry to ensure all tools are loaded
        const { globalToolRegistry } = await import('./tool-registry.js');
        const registeredTools = globalToolRegistry.getAll();

        // Apply filtering logic
        const filteredTools = this.filterTools(registeredTools);

        for (const tool of filteredTools) {
            this.registry.register(tool);
        }

        logger.debug(
            `Loaded ${filteredTools.length} tools (filtered from ${registeredTools.length} total)`
        );
    }

    /**
     * Filter tools based on configuration settings
     */
    private filterTools(tools: Tool[]): Tool[] {
        let filteredTools = [...tools];

        // Filter by enabled tools
        if (this.config.enabledTools !== 'all') {
            const enabledSet = new Set(this.config.enabledTools);
            const beforeCount = filteredTools.length;
            filteredTools = filteredTools.filter((tool) => enabledSet.has(tool.id));
            logger.debug(
                `Filtered to ${filteredTools.length} explicitly enabled tools (from ${beforeCount})`
            );
        }

        // Remove disabled tools (always excluded regardless of enabledTools)
        if (this.config.disabledTools && this.config.disabledTools.length > 0) {
            const disabledSet = new Set(this.config.disabledTools);
            const beforeCount = filteredTools.length;
            filteredTools = filteredTools.filter((tool) => !disabledSet.has(tool.id));
            logger.debug(`Filtered out ${beforeCount - filteredTools.length} disabled tools`);
        }

        return filteredTools;
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
    getAllTools(): ToolSet {
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
    getToolsByCategory(category: string): ToolSet {
        return this.executor.getToolsByCategory(category);
    }

    /**
     * Get tools by tags (delegates to ToolExecutor)
     */
    getToolsByTags(tags: string[]): ToolSet {
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
