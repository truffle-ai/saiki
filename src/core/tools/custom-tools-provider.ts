import { ToolRegistry } from './tool-registry.js';
import { ToolExecutor } from './tool-executor.js';
import { ToolDiscovery } from './tool-discovery.js';
import { ToolExecutionContext, ToolManagerToolSet, Tool } from './types.js';
import { ValidatedCustomToolsConfig } from '../config/schemas.js';
import { ToolConfirmationProvider } from '../client/tool-confirmation/types.js';
import { logger } from '../logger/index.js';
import { join } from 'path';

/**
 * Manages custom tools with discovery, registration, and execution capabilities
 *
 * This provider handles the complete lifecycle of custom tools:
 * - Discovers tools from the file system (tools/ directory)
 * - Loads tools registered via the global registry (createTool decorator)
 * - Filters tools based on configuration (enabledTools, toolConfigs)
 * - Provides execution interface with confirmation and timeout handling
 * - Manages tool metadata, categories, and statistics
 *
 * Architecture: CustomToolsProvider → [ToolRegistry, ToolExecutor, ToolDiscovery]
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
            toolConfigs: config.toolConfigs ?? {},
            globalSettings: config.globalSettings ?? {
                requiresConfirmation: false,
                timeout: 30000,
            },
        };

        // Initialize service classes
        this.registry = new ToolRegistry();
        this.executor = new ToolExecutor(this.registry, this.config, confirmationProvider);
        this.discovery = new ToolDiscovery(this.registry);

        logger.debug(`CustomToolsProvider initialized with config: ${JSON.stringify(this.config)}`);
    }

    /**
     * Initialize the custom tools provider
     *
     * This method:
     * 1. Loads tools from the global registry (tools registered via createTool decorator)
     * 2. Discovers tools from the tools/ directory (file system scanning)
     * 3. Applies configuration-based filtering (enabledTools, toolConfigs)
     * 4. Registers all valid tools in the local registry
     */
    async initialize(): Promise<void> {
        logger.info('Initializing CustomToolsProvider...');

        try {
            // Load tools from the global registry (tools register themselves via createTool)
            await this.loadRegisteredTools();

            // Discover tools from the tools/ directory (always enabled)
            await this.discoverToolsFromDirectory();

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
     * Load tools from the global registry
     *
     * Tools register themselves via the createTool decorator and are stored in the global registry.
     * This method loads them and applies configuration-based filtering.
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
     *
     * Scans the tools/ directory for .ts/.js files and attempts to load tools from them.
     * This enables dynamic tool discovery without requiring code changes.
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
     *
     * Applies filtering logic based on:
     * - enabledTools: 'all' or specific tool IDs array
     * - Validates that all specified tool IDs exist
     * - Returns filtered list of tools that match the configuration
     */
    private filterTools(tools: Tool[]): Tool[] {
        let filteredTools = [...tools];

        // Filter by enabled tools
        if (this.config.enabledTools !== 'all') {
            const enabledSet = new Set(this.config.enabledTools);
            const availableToolIds = new Set(tools.map((tool) => tool.id));

            // Validate that all enabled tool IDs exist
            const invalidToolIds = this.config.enabledTools.filter(
                (toolId) => !availableToolIds.has(toolId)
            );
            if (invalidToolIds.length > 0) {
                throw new Error(
                    `Invalid tool IDs specified in enabledTools: ${invalidToolIds.join(', ')}. Available tools: ${Array.from(availableToolIds).join(', ')}`
                );
            }

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
