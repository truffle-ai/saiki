import { promises as fs } from 'fs';
import { resolve, join, extname } from 'path';
import { logger } from '../logger/index.js';
import {
    Tool,
    ToolDiscoveryResult,
    ToolExecutionContext,
    ToolExecutionError,
    ToolRegistrationError,
    ToolSet,
} from './types.js';
import { ValidatedCustomToolsConfig } from '../config/schemas.js';
import { getRegisteredTools, validateToolResult } from './decorators.js';
import { ToolConfirmationProvider } from '../client/tool-confirmation/types.js';

/**
 * No-op confirmation provider for testing
 */
class NoOpConfirmationProvider implements ToolConfirmationProvider {
    allowedToolsProvider: any = null;

    async requestConfirmation(): Promise<boolean> {
        return true; // Auto-approve all tools
    }
}

/**
 * Simplified custom tool manager using the new clean API
 */
export class CustomToolManager {
    private tools: Map<string, Tool> = new Map();
    private config: ValidatedCustomToolsConfig;
    private confirmationProvider: ToolConfirmationProvider;

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
        this.confirmationProvider = confirmationProvider || new NoOpConfirmationProvider();

        logger.debug(`CustomToolManager initialized with config: ${JSON.stringify(this.config)}`);
    }

    /**
     * Initialize the tool manager
     */
    async initialize(): Promise<void> {
        logger.info('Initializing CustomToolManager...');

        try {
            // Discover tools from directory
            if (this.config.autoDiscover && this.config.toolsDirectory) {
                await this.discoverTools(this.config.toolsDirectory);
            }

            // Load decorator-registered tools
            await this.loadRegisteredTools();

            logger.info(`CustomToolManager initialized with ${this.tools.size} tools`);
        } catch (error) {
            logger.error(
                `Failed to initialize CustomToolManager: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    }

    /**
     * Discover tools from directory
     */
    async discoverTools(toolsDirectory: string): Promise<ToolDiscoveryResult> {
        const result: ToolDiscoveryResult = {
            tools: [],
            errors: [],
            warnings: [],
        };

        try {
            const resolvedPath = resolve(toolsDirectory);
            logger.debug(`Discovering tools in: ${resolvedPath}`);

            // Check if directory exists
            try {
                await fs.access(resolvedPath);
            } catch {
                logger.debug(`Tools directory '${resolvedPath}' does not exist, skipping`);
                return result;
            }

            const files = await this.getToolFiles(resolvedPath);

            for (const filePath of files) {
                try {
                    await this.loadToolFile(filePath);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    logger.warn(`Failed to load tool file '${filePath}': ${errorMessage}`);
                    result.errors.push({ filePath, error: errorMessage });
                }
            }

            result.tools = Array.from(this.tools.values());
            logger.info(
                `Tool discovery completed: ${result.tools.length} tools loaded, ${result.errors.length} errors`
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Tool discovery failed: ${errorMessage}`);
            result.errors.push({ filePath: toolsDirectory, error: errorMessage });
        }

        return result;
    }

    /**
     * Get tool files from directory
     */
    private async getToolFiles(directory: string): Promise<string[]> {
        const files: string[] = [];
        const entries = await fs.readdir(directory, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = join(directory, entry.name);

            if (entry.isDirectory()) {
                const subFiles = await this.getToolFiles(fullPath);
                files.push(...subFiles);
            } else if (entry.isFile()) {
                const ext = extname(entry.name);
                if (['.ts', '.js', '.mts', '.mjs'].includes(ext)) {
                    files.push(fullPath);
                }
            }
        }

        return files;
    }

    /**
     * Load a tool file
     */
    private async loadToolFile(filePath: string): Promise<void> {
        try {
            logger.debug(`Loading tool file: ${filePath}`);

            const module = await import(`file://${filePath}`);
            let exportedToolsCount = 0;

            for (const [_exportName, exportValue] of Object.entries(module)) {
                // Handle single tool exports
                if (
                    exportValue &&
                    typeof exportValue === 'object' &&
                    'id' in exportValue &&
                    'execute' in exportValue
                ) {
                    const tool = exportValue as Tool;
                    this.registerTool(tool);
                    exportedToolsCount++;
                    logger.debug(`Registered exported tool: ${tool.id}`);
                }

                // Handle array exports
                if (Array.isArray(exportValue)) {
                    for (const item of exportValue) {
                        if (item && typeof item === 'object' && 'id' in item && 'execute' in item) {
                            const tool = item as Tool;
                            this.registerTool(tool);
                            exportedToolsCount++;
                            logger.debug(`Registered exported tool from array: ${tool.id}`);
                        }
                    }
                }
            }

            if (exportedToolsCount > 0) {
                logger.debug(`Loaded ${exportedToolsCount} tools from ${filePath}`);
            }
        } catch (error) {
            throw new ToolRegistrationError(
                filePath,
                `Failed to import tool file: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Load decorator-registered tools
     */
    private async loadRegisteredTools(): Promise<void> {
        const registeredTools = getRegisteredTools();

        for (const tool of registeredTools) {
            this.registerTool(tool);
        }

        logger.debug(`Loaded ${registeredTools.length} registered tools`);
    }

    /**
     * Register a tool
     */
    registerTool(tool: Tool): void {
        if (this.tools.has(tool.id)) {
            logger.warn(`Tool '${tool.id}' is already registered, overwriting`);
        }

        this.tools.set(tool.id, tool);
        logger.debug(`Registered tool: ${tool.id}`);
    }

    /**
     * Check if a tool exists
     */
    hasTool(toolId: string): boolean {
        return this.tools.has(toolId);
    }

    /**
     * Execute a tool
     */
    async executeTool(
        toolId: string,
        args: Record<string, any>,
        context?: ToolExecutionContext
    ): Promise<any> {
        const tool = this.tools.get(toolId);
        if (!tool) {
            throw new ToolExecutionError(toolId, 'Tool not found');
        }

        logger.debug(`🔧 Tool execution requested: '${toolId}'`);
        logger.debug(`Tool args: ${JSON.stringify(args, null, 2)}`);

        // Validate input against schema
        try {
            const validatedArgs = tool.inputSchema.parse(args);
            args = validatedArgs;
        } catch (error) {
            throw new ToolExecutionError(
                toolId,
                `Input validation failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }

        // Check for confirmation requirement
        const requiresConfirmation =
            tool.settings?.requiresConfirmation ??
            this.config.globalSettings?.requiresConfirmation ??
            false;

        if (requiresConfirmation) {
            const approved = await this.confirmationProvider.requestConfirmation({
                toolName: toolId,
                args,
            });

            if (!approved) {
                logger.warn(`🚫 Custom tool execution denied: ${toolId}`);
                throw new ToolExecutionError(toolId, 'Tool execution denied by user');
            }
        }

        const startTime = Date.now();

        try {
            logger.debug(`▶️  Executing custom tool '${toolId}'...`);

            const result = await Promise.resolve(tool.execute(args, context));
            const validatedResult = validateToolResult(result);

            const duration = Date.now() - startTime;
            logger.debug(`✅ Custom tool execution completed in ${duration}ms: '${toolId}'`);

            return validatedResult.data;
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(
                `❌ Custom tool execution failed after ${duration}ms: '${toolId}' - ${errorMessage}`
            );
            throw new ToolExecutionError(toolId, errorMessage, error as Error);
        }
    }

    /**
     * Get all tools in ToolSet format (for compatibility)
     */
    getAllTools(): ToolSet {
        const toolSet: ToolSet = {};

        for (const [toolId, tool] of this.tools) {
            toolSet[toolId] = {
                description: tool.description,
                parameters: this.convertSchemaToParameters(tool.inputSchema),
            };
        }

        return toolSet;
    }

    /**
     * Convert Zod schema to MCP-style parameters
     */
    private convertSchemaToParameters(schema: any): any {
        try {
            // For now, return a simple object structure
            // This could be enhanced to properly convert Zod schemas
            return {
                type: 'object',
                properties: {},
                required: [],
            };
        } catch {
            return {
                type: 'object',
                properties: {},
                required: [],
            };
        }
    }

    /**
     * Get tool names
     */
    getToolNames(): string[] {
        return Array.from(this.tools.keys());
    }

    /**
     * Clear all tools
     */
    clear(): void {
        this.tools.clear();
        logger.debug('Cleared all tools');
    }
}
