import { ToolRegistry } from './tool-registry.js';
import { ToolExecutor } from './tool-executor.js';
import { ToolDiscovery } from './tool-discovery.js';
import { ToolDiscoveryResult, ToolExecutionContext, ToolSet } from './types.js';
import { ValidatedCustomToolsConfig } from '../config/schemas.js';
import { ToolConfirmationProvider } from '../client/tool-confirmation/types.js';
import { logger } from '../logger/index.js';

/**
 * Provides custom tool functionality using dedicated service classes
 *
 * This provider follows the codebase pattern of being a thin orchestrator
 * that delegates to specialized service classes
 */
export class CustomToolProvider {
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
            toolsDirectory: config.toolsDirectory || './tools',
            autoDiscover: config.autoDiscover !== false,
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
        this.discovery = new ToolDiscovery(this.registry);

        logger.debug(`CustomToolProvider initialized with config: ${JSON.stringify(this.config)}`);
    }

    /**
     * Initialize the tool provider
     */
    async initialize(): Promise<void> {
        logger.info('Initializing CustomToolProvider...');

        try {
            // Load decorator-registered tools first
            await this.discovery.loadRegisteredTools();

            // Discover tools from directory
            if (this.config.autoDiscover && this.config.toolsDirectory) {
                await this.discovery.discoverTools(this.config.toolsDirectory);
            }

            const toolCount = this.registry.getToolIds().length;
            logger.info(`CustomToolProvider initialized with ${toolCount} tools`);
        } catch (error) {
            logger.error(
                `Failed to initialize CustomToolProvider: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    }

    /**
     * Discover tools from directory (delegates to ToolDiscovery)
     */
    async discoverTools(toolsDirectory: string): Promise<ToolDiscoveryResult> {
        return await this.discovery.discoverTools(toolsDirectory);
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
     * Validate tools directory (delegates to ToolDiscovery)
     */
    async validateToolsDirectory(directory: string): Promise<{
        validFiles: string[];
        invalidFiles: Array<{ filePath: string; error: string }>;
    }> {
        return await this.discovery.validateToolsDirectory(directory);
    }

    /**
     * Clear all tools (delegates to ToolRegistry)
     */
    clear(): void {
        this.registry.clear();
    }
}
