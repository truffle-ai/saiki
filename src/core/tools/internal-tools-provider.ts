import { ToolExecutionContext, ToolSet, InternalTool } from './types.js';
import { ToolConfirmationProvider } from './confirmation/types.js';
import { SearchService } from '../ai/search/search-service.js';
import { createSearchHistoryTool } from './internal-tools/search-history-tool.js';
import { ToolExecutionDeniedError } from './confirmation/errors.js';
import { logger } from '../logger/index.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

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
 * Internal tool factory function type
 */
type InternalToolFactory = (services: InternalToolsServices) => InternalTool;

/**
 * Internal tool registry - Single source of truth
 * Define registry ONCE with proper typing, all types derived from here
 */
const INTERNAL_TOOL_REGISTRY = {
    search_history: {
        factory: (services: InternalToolsServices) =>
            createSearchHistoryTool(services.searchService!),
        requiredServices: ['searchService'] as const,
    },
    // Add new tools here...
} as const;

// Derive ALL types from registry - impossible to get out of sync
export type KnownInternalTool = keyof typeof INTERNAL_TOOL_REGISTRY;
export type InternalToolsConfig = KnownInternalTool[];
export const KNOWN_INTERNAL_TOOLS = Object.keys(INTERNAL_TOOL_REGISTRY) as KnownInternalTool[];

/**
 * Type-safe registry access
 */
export function getInternalToolInfo(toolName: KnownInternalTool) {
    return INTERNAL_TOOL_REGISTRY[toolName];
}

/**
 * Internal tool after processing by the provider (includes converted parameters)
 */
interface ProcessedInternalTool {
    name: string;
    description: string;
    parameters?: any;
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
    private tools: Map<string, ProcessedInternalTool> = new Map();
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
            const toolInfo = getInternalToolInfo(toolName);

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
                const internalTool: ProcessedInternalTool = {
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
    private convertZodSchemaToJsonSchema(zodSchema: any): any {
        try {
            // Use proper library for Zod to JSON Schema conversion
            return zodToJsonSchema(zodSchema);
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
     * Get all tools in ToolSet format - NO normalization needed
     */
    getAllTools(): ToolSet {
        const toolSet: ToolSet = {};

        for (const [name, tool] of this.tools) {
            toolSet[name] = {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters, // ← Already final JSON Schema format
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
