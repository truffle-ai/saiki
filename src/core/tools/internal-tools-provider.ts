import { ToolExecutionContext, ToolManagerToolSet, RawToolDefinition, Tool } from './types.js';
import { SearchService } from '../ai/search/search-service.js';
import { createSearchHistoryTool } from './internal-tools/search-history-tool.js';
import {
    createSchedulerTool,
    createSchedulerCreateTool,
    createSchedulerListTool,
    createSchedulerGetTool,
    createSchedulerUpdateTool,
    createSchedulerToggleTool,
    createSchedulerDeleteTool,
    createSchedulerStatsTool,
} from './internal-tools/scheduler-tool.js';
import { ToolConfirmationProvider } from '../client/tool-confirmation/types.js';
import { ToolExecutionDeniedError } from '../client/tool-confirmation/errors.js';
import { logger } from '../logger/index.js';
import type { SchedulerService } from '../utils/scheduler.js';

/**
 * Services available to internal tools
 * Add new services here as needed for internal tools
 */
export interface InternalToolsServices {
    searchService?: SearchService;
    scheduler?: SchedulerService;
    // Future services can be added here:
    // sessionManager?: SessionManager;
    // storageManager?: StorageManager;
    // eventBus?: AgentEventBus;
}

/**
 * Known internal tool names - update this when adding new internal tools
 */
export const KNOWN_INTERNAL_TOOLS = [
    'search_history',
    'schedule_task',
    'scheduler_create_task',
    'scheduler_list_tasks',
    'scheduler_get_task',
    'scheduler_update_task',
    'scheduler_toggle_task',
    'scheduler_delete_task',
    'scheduler_get_stats',
] as const;
export type KnownInternalTool = (typeof KNOWN_INTERNAL_TOOLS)[number];

/**
 * Configuration for internal tools - simplified to just an array
 * Empty array = no tools enabled, Non-empty array = specific tools enabled
 */
export type InternalToolsConfig = KnownInternalTool[];

/**
 * Internal tool factory function type
 */
type InternalToolFactory = (services: InternalToolsServices) => Tool;

/**
 * Internal tool registry with service dependency checking
 */
const INTERNAL_TOOL_REGISTRY = new Map<
    KnownInternalTool,
    {
        factory: InternalToolFactory;
        requiredServices: (keyof InternalToolsServices)[];
    }
>([
    [
        'search_history',
        {
            factory: (services) => createSearchHistoryTool(services.searchService!),
            requiredServices: ['searchService'],
        },
    ],
    [
        'schedule_task',
        {
            factory: (services) => createSchedulerTool(services.scheduler!),
            requiredServices: ['scheduler'],
        },
    ],
    [
        'scheduler_create_task',
        {
            factory: (services) => createSchedulerCreateTool(services.scheduler!),
            requiredServices: ['scheduler'],
        },
    ],
    [
        'scheduler_list_tasks',
        {
            factory: (services) => createSchedulerListTool(services.scheduler!),
            requiredServices: ['scheduler'],
        },
    ],
    [
        'scheduler_get_task',
        {
            factory: (services) => createSchedulerGetTool(services.scheduler!),
            requiredServices: ['scheduler'],
        },
    ],
    [
        'scheduler_update_task',
        {
            factory: (services) => createSchedulerUpdateTool(services.scheduler!),
            requiredServices: ['scheduler'],
        },
    ],
    [
        'scheduler_toggle_task',
        {
            factory: (services) => createSchedulerToggleTool(services.scheduler!),
            requiredServices: ['scheduler'],
        },
    ],
    [
        'scheduler_delete_task',
        {
            factory: (services) => createSchedulerDeleteTool(services.scheduler!),
            requiredServices: ['scheduler'],
        },
    ],
    [
        'scheduler_get_stats',
        {
            factory: (services) => createSchedulerStatsTool(services.scheduler!),
            requiredServices: ['scheduler'],
        },
    ],
]);

/**
 * Simple internal tool interface
 */
interface InternalTool {
    name: string;
    description: string;
    parameters?: RawToolDefinition['parameters'];
    execute: (args: Record<string, unknown>, context?: ToolExecutionContext) => Promise<unknown>;
}

/**
 * Provider for built-in internal tools that are part of the core system
 *
 * This provider manages internal tools that are shipped with the core system
 * and need access to core services like SearchService, SessionManager, etc.
 *
 * Benefits:
 * - Clean separation: ToolManager doesn't need to know about specific services
 * - Easy to extend: Just add new tools and services as needed
 * - Lightweight: Direct tool management without complex infrastructure
 */
export class InternalToolsProvider {
    private services: InternalToolsServices;
    private tools: Map<string, InternalTool> = new Map();
    private confirmationProvider: ToolConfirmationProvider;
    private config: InternalToolsConfig;

    constructor(
        services: InternalToolsServices,
        confirmationProvider: ToolConfirmationProvider,
        config: InternalToolsConfig = []
    ) {
        this.services = services;
        this.confirmationProvider = confirmationProvider;
        this.config = config;
        logger.debug('InternalToolsProvider initialized with config:', config);
    }

    /**
     * Initialize the internal tools provider by registering all available internal tools
     */
    async initialize(): Promise<void> {
        logger.info('Initializing InternalToolsProvider...');

        try {
            // Check if any internal tools are enabled
            if (this.config.length === 0) {
                logger.info('No internal tools enabled by configuration');
                return;
            }

            this.registerInternalTools();

            const toolCount = this.tools.size;
            logger.info(`InternalToolsProvider initialized with ${toolCount} internal tools`);
        } catch (error) {
            logger.error(
                `Failed to initialize InternalToolsProvider: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    }

    /**
     * Register all available internal tools based on available services and configuration
     */
    private registerInternalTools(): void {
        for (const toolName of this.config) {
            const toolInfo = INTERNAL_TOOL_REGISTRY.get(toolName);
            if (!toolInfo) {
                logger.warn(`No factory found for internal tool: ${toolName}`);
                continue;
            }

            // Check if all required services are available
            const missingServices = toolInfo.requiredServices.filter(
                (serviceKey) => !this.services[serviceKey]
            );

            if (missingServices.length > 0) {
                logger.debug(
                    `Skipping ${toolName} internal tool - missing services: ${missingServices.join(', ')}`
                );
                continue;
            }

            try {
                // Create the tool using its factory
                const tool = toolInfo.factory(this.services);

                // Convert the tool to our internal format
                const internalTool: InternalTool = {
                    name: tool.id,
                    description: tool.description,
                    // Convert Zod schema to JSON Schema format
                    parameters: this.convertZodSchemaToJsonSchema(tool.inputSchema),
                    execute: async (
                        args: Record<string, unknown>,
                        context?: ToolExecutionContext
                    ) => {
                        return await tool.execute(args, context);
                    },
                };

                this.tools.set(toolName, internalTool);
                logger.debug(`Registered ${toolName} internal tool`);
            } catch (error) {
                logger.error(
                    `Failed to register ${toolName} internal tool: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    }

    /**
     * Convert Zod schema to JSON Schema format for tool parameters
     */
    private convertZodSchemaToJsonSchema(zodSchema: any): RawToolDefinition['parameters'] {
        try {
            // Use Zod's built-in JSON Schema conversion
            const jsonSchema = zodSchema._def.openapi || zodSchema._def.jsonSchema;
            if (jsonSchema) {
                return jsonSchema;
            }

            // Fallback: try to extract basic schema information
            const shape = zodSchema._def.shape();
            if (shape) {
                const properties: Record<string, unknown> = {};
                const required: string[] = [];

                for (const [key, schema] of Object.entries(shape)) {
                    const fieldSchema = schema as any;

                    // Extract basic type information
                    if (fieldSchema._def.typeName === 'ZodString') {
                        properties[key] = { type: 'string' };
                    } else if (fieldSchema._def.typeName === 'ZodNumber') {
                        properties[key] = { type: 'number' };
                    } else if (fieldSchema._def.typeName === 'ZodBoolean') {
                        properties[key] = { type: 'boolean' };
                    } else if (fieldSchema._def.typeName === 'ZodEnum') {
                        properties[key] = {
                            type: 'string',
                            enum: fieldSchema._def.values,
                        };
                    } else if (fieldSchema._def.typeName === 'ZodOptional') {
                        // Optional fields don't go in required array
                        const innerSchema = fieldSchema._def.innerType;
                        if (innerSchema._def.typeName === 'ZodString') {
                            properties[key] = { type: 'string' };
                        } else if (innerSchema._def.typeName === 'ZodNumber') {
                            properties[key] = { type: 'number' };
                        } else if (innerSchema._def.typeName === 'ZodBoolean') {
                            properties[key] = { type: 'boolean' };
                        } else if (innerSchema._def.typeName === 'ZodEnum') {
                            properties[key] = {
                                type: 'string',
                                enum: innerSchema._def.values,
                            };
                        }
                    } else {
                        // Default to string for unknown types
                        properties[key] = { type: 'string' };
                    }

                    // Add to required array if not optional
                    if (fieldSchema._def.typeName !== 'ZodOptional') {
                        required.push(key);
                    }
                }

                return {
                    type: 'object',
                    properties,
                    ...(required.length > 0 && { required }),
                };
            }

            // Final fallback: return basic object schema
            return {
                type: 'object',
                properties: {},
            };
        } catch (error) {
            logger.warn(
                `Failed to convert Zod schema to JSON Schema: ${error instanceof Error ? error.message : String(error)}`
            );
            // Return basic object schema as fallback
            return {
                type: 'object',
                properties: {},
            };
        }
    }

    /**
     * Check if a specific tool is enabled by configuration
     */
    private isToolEnabled(toolName: KnownInternalTool): boolean {
        return this.config.includes(toolName);
    }

    /**
     * Check if a tool exists
     */
    hasTool(toolName: string): boolean {
        return this.tools.has(toolName);
    }

    /**
     * Execute a tool with confirmation support matching MCP tools behavior
     */
    async executeTool(
        toolName: string,
        args: Record<string, unknown>,
        sessionId?: string
    ): Promise<unknown> {
        logger.debug(`🔧 Internal tool execution requested: '${toolName}'`);
        logger.debug(`Tool args: ${JSON.stringify(args, null, 2)}`);

        const tool = this.tools.get(toolName);
        if (!tool) {
            logger.error(`❌ No internal tool found: ${toolName}`);
            logger.debug(`Available internal tools: ${Array.from(this.tools.keys()).join(', ')}`);
            throw new Error(`Internal tool not found: ${toolName}`);
        }

        // Request tool confirmation (same as MCP tools)
        const approved = await this.confirmationProvider.requestConfirmation({
            toolName,
            args,
        });

        if (!approved) {
            logger.debug(`🚫 Internal tool execution denied: ${toolName}`);
            throw new ToolExecutionDeniedError(toolName, sessionId);
        }

        logger.debug(`✅ Internal tool execution approved: ${toolName}`);

        try {
            const context: ToolExecutionContext = { sessionId };
            const result = await tool.execute(args, context);

            logger.debug(`🎯 Internal tool execution completed: ${toolName}`);
            return result;
        } catch (error) {
            logger.error(`❌ Internal tool execution failed: ${toolName}`, error);
            throw error;
        }
    }

    /**
     * Get all tools in ToolManagerToolSet format
     */
    getAllTools(): ToolManagerToolSet {
        const toolSet: ToolManagerToolSet = {};

        for (const [name, tool] of this.tools) {
            toolSet[name] = {
                name: tool.name,
                description: tool.description,
                ...(tool.parameters && {
                    parameters: {
                        type: 'object',
                        properties: tool.parameters.properties || {},
                        ...(tool.parameters.required && { required: tool.parameters.required }),
                    },
                }),
            };
        }

        return toolSet;
    }

    /**
     * Get tool names
     */
    getToolNames(): string[] {
        return Array.from(this.tools.keys());
    }

    /**
     * Get tool count
     */
    getToolCount(): number {
        return this.tools.size;
    }
}
