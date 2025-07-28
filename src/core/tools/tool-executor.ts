import { ToolExecutionContext, ToolExecutionError, ToolSet, Tool } from './types.js';
import { ToolRegistry } from './tool-registry.js';
import { ValidatedCustomToolsConfig } from '../config/schemas.js';
import { ToolConfirmationProvider } from '../client/tool-confirmation/types.js';
import { IAllowedToolsProvider } from '../client/tool-confirmation/allowed-tools-provider/types.js';
import { InMemoryAllowedToolsProvider } from '../client/tool-confirmation/allowed-tools-provider/in-memory.js';
import { validateToolResult } from './tool-factory.js';
import { SchemaConverter } from './schema-converter.js';
import { logger } from '../logger/index.js';

/**
 * Tool execution arguments interface
 */
export interface ToolExecutionArgs {
    [key: string]: any;
}

/**
 * Tool execution result interface
 */
export interface ToolExecutionResult {
    data?: any;
    metadata?: Record<string, any>;
    error?: string;
}

/**
 * Tool execution request interface
 */
export interface ToolExecutionRequest {
    toolId: string;
    args: ToolExecutionArgs;
    context?: ToolExecutionContext;
}

/**
 * Tool execution response interface
 */
export interface ToolExecutionResponse {
    success: boolean;
    data?: any;
    error?: string;
    metadata?: Record<string, any> | undefined;
}

/**
 * No-op confirmation provider for testing
 */
class NoOpConfirmationProvider implements ToolConfirmationProvider {
    allowedToolsProvider: IAllowedToolsProvider = new InMemoryAllowedToolsProvider();

    async requestConfirmation(): Promise<boolean> {
        return true; // Auto-approve all tools
    }
}

/**
 * Dedicated tool execution engine
 *
 * Handles all custom tool execution logic with proper separation of concerns
 */
export class ToolExecutor {
    private registry: ToolRegistry;
    private config: ValidatedCustomToolsConfig;
    private confirmationProvider: ToolConfirmationProvider;

    constructor(
        registry: ToolRegistry,
        config: ValidatedCustomToolsConfig = {} as ValidatedCustomToolsConfig,
        confirmationProvider?: ToolConfirmationProvider
    ) {
        this.registry = registry;

        // Use defaults if config is incomplete
        this.config = {
            enabledTools: config.enabledTools ?? 'all',
            toolConfigs: config.toolConfigs || {},
            globalSettings: config.globalSettings || {
                requiresConfirmation: false,
                timeout: 30000,
                enableCaching: false,
            },
        };

        this.confirmationProvider = confirmationProvider || new NoOpConfirmationProvider();

        logger.debug(`ToolExecutor initialized with ${this.registry.getToolIds().length} tools`);
    }

    /**
     * Check if a tool exists
     */
    hasTool(toolId: string): boolean {
        return this.registry.has(toolId);
    }

    /**
     * Execute a tool by ID
     */
    async executeTool(
        toolId: string,
        args: ToolExecutionArgs,
        context?: ToolExecutionContext
    ): Promise<ToolExecutionResponse> {
        const tool = this.registry.get(toolId);
        if (!tool) {
            throw new ToolExecutionError(toolId, 'Tool not found');
        }

        logger.debug(`🔧 Custom tool execution requested: '${toolId}'`);
        logger.debug(`Tool args: ${JSON.stringify(args, null, 2)}`);

        const startTime = Date.now();

        try {
            // Validate input against schema
            const validatedArgs = tool.inputSchema.parse(args);
            args = validatedArgs;

            // Check for confirmation requirement with proper precedence
            const toolSpecificConfig = this.config.toolConfigs?.[toolId];
            const requiresConfirmation =
                toolSpecificConfig?.requiresConfirmation ??
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
                    throw new Error('Tool execution denied by user');
                }
            }

            // Apply timeout with proper precedence
            const timeout =
                toolSpecificConfig?.timeout ??
                tool.settings?.timeout ??
                this.config.globalSettings?.timeout ??
                30000;

            logger.debug(`▶️  Executing custom tool '${toolId}'...`);

            let result: ToolExecutionResult;

            if (timeout > 0) {
                // Execute with timeout
                result = await Promise.race([
                    Promise.resolve(tool.execute(args, context)),
                    new Promise<never>((_, reject) =>
                        setTimeout(
                            () => reject(new Error(`Tool execution timeout after ${timeout}ms`)),
                            timeout
                        )
                    ),
                ]);
            } else {
                // Execute without timeout
                result = await Promise.resolve(tool.execute(args, context));
            }

            const validatedResult = validateToolResult(result);
            const duration = Date.now() - startTime;

            logger.debug(`✅ Custom tool execution completed in ${duration}ms: '${toolId}'`);

            return {
                success: true,
                data: validatedResult.data,
                metadata: validatedResult.metadata,
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            logger.error(
                `❌ Custom tool execution failed after ${duration}ms: '${toolId}' - ${errorMessage}`
            );

            return {
                success: false,
                error: errorMessage,
                metadata: { duration },
            };
        }
    }

    /**
     * Convert tools array to ToolSet format
     */
    private convertToolsToToolSet(tools: Tool[]): ToolSet {
        const toolSet: ToolSet = {};

        for (const tool of tools) {
            const jsonSchema = SchemaConverter.zodToJsonSchema(tool.inputSchema);
            toolSet[tool.id] = {
                description: tool.description,
                parameters:
                    jsonSchema.type === 'object'
                        ? {
                              type: 'object',
                              properties: jsonSchema.properties || {},
                              ...(jsonSchema.required && { required: jsonSchema.required }),
                          }
                        : {
                              type: 'object',
                              properties: {},
                          },
            };
        }

        return toolSet;
    }

    /**
     * Get all tools in ToolSet format (for compatibility with MCP)
     */
    getAllTools(): ToolSet {
        return this.convertToolsToToolSet(this.registry.getAll());
    }

    /**
     * Get tool names
     */
    getToolNames(): string[] {
        return this.registry.getToolIds();
    }

    /**
     * Get tools by category
     */
    getToolsByCategory(category: string): ToolSet {
        return this.convertToolsToToolSet(this.registry.getByCategory(category));
    }

    /**
     * Get tools by tags
     */
    getToolsByTags(tags: string[]): ToolSet {
        return this.convertToolsToToolSet(this.registry.getByTags(tags));
    }

    /**
     * Get execution statistics
     */
    getStats(): {
        totalTools: number;
        categories: Record<string, number>;
        tags: Record<string, number>;
    } {
        return this.registry.getStats();
    }
}
