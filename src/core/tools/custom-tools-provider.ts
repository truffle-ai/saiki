import { ToolRegistry } from './tool-registry.js';
import { ToolExecutor } from './tool-executor.js';
import { ToolDiscovery } from './tool-discovery.js';
import { ToolExecutionContext, ToolSet, Tool } from './types.js';
import { ValidatedCustomToolsConfig } from '../config/schemas.js';
import { ToolConfirmationProvider } from '../client/tool-confirmation/types.js';
import { logger } from '../logger/index.js';
import { join } from 'path';

/**
 * Provides custom tool functionality using dedicated service classes
 *
 * This provider follows the codebase pattern of being a thin orchestrator
 * that delegates to specialized service classes for custom tools
 */
export class CustomToolsProvider {
    private registry: ToolRegistry;
    private executor: ToolExecutor;
    private discovery: ToolDiscovery;
    private config: ValidatedCustomToolsConfig;

    constructor(
        config: ValidatedCustomToolsConfig = {} as ValidatedCustomToolsConfig,
        confirmationProvider?: ToolConfirmationProvider
    ) {
        // Use defaults if config is incomplete
        this.config = {
            enabledTools: config.enabledTools ?? 'all',
            enableToolDiscovery: config.enableToolDiscovery ?? true,
            toolConfigs: config.toolConfigs ?? {},
            globalSettings: config.globalSettings ?? {
                requiresConfirmation: false,
                timeout: 30000,
                enableCaching: false,
            },
        };

        // Initialize service classes
        this.registry = new ToolRegistry();
        this.executor = new ToolExecutor(this.registry, this.config, confirmationProvider);
        this.discovery = new ToolDiscovery(this.registry);

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

            // Discover tools from the tools/ directory (only if not disabled)
            if (this.config.enableToolDiscovery !== false) {
                await this.discoverToolsFromDirectory();
            }

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
     * Discover tools from the tools/ directory
     */
    private async discoverToolsFromDirectory(): Promise<void> {
        try {
            // Look for tools in the tools/ directory relative to the current working directory
            const toolsDirectory = join(process.cwd(), 'tools');
            logger.debug(`Discovering tools from directory: ${toolsDirectory}`);

            const discoveryResult = await this.discovery.discoverTools(toolsDirectory);

            if (discoveryResult.tools.length > 0) {
                logger.info(
                    `Discovered ${discoveryResult.tools.length} tools from tools/ directory`
                );
            }

            if (discoveryResult.errors.length > 0) {
                logger.warn(`Tool discovery had ${discoveryResult.errors.length} errors`);
                for (const error of discoveryResult.errors) {
                    logger.warn(`  - ${error.filePath}: ${error.error}`);
                }
            }
        } catch (error) {
            logger.warn(
                `Failed to discover tools from tools/ directory: ${error instanceof Error ? error.message : String(error)}`
            );
        }
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
