import { ToolExecutionContext, ToolManagerToolSet, RawToolDefinition } from './types.js';
import { SearchService } from '../ai/search/search-service.js';
import { createSearchHistoryTool } from './internal-tools/search-history-tool.js';
import { ToolConfirmationProvider } from '../client/tool-confirmation/types.js';
import { ToolExecutionDeniedError } from '../client/tool-confirmation/errors.js';
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
 * Simple internal tool interface
 */
interface InternalTool {
    name: string;
    description: string;
    parameters?: RawToolDefinition['parameters'];
    execute: (args: Record<string, any>, context?: ToolExecutionContext) => Promise<any>;
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

    constructor(services: InternalToolsServices, confirmationProvider: ToolConfirmationProvider) {
        this.services = services;
        this.confirmationProvider = confirmationProvider;
        logger.debug('InternalToolsProvider initialized');
    }

    /**
     * Initialize the internal tools provider by registering all available internal tools
     */
    async initialize(): Promise<void> {
        logger.info('Initializing InternalToolsProvider...');

        try {
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
     * Register all available internal tools based on available services
     */
    private registerInternalTools(): void {
        // Register search history tool if search service is available
        if (this.services.searchService) {
            const searchHistoryTool = createSearchHistoryTool(this.services.searchService);
            this.tools.set('search_history', {
                name: 'search_history',
                description: "Get search history from the agent's search service",
                parameters: {
                    type: 'object',
                    properties: {
                        limit: {
                            type: 'number',
                            description: 'Maximum number of search results to return',
                            default: 10,
                        },
                    },
                },
                execute: async (args: Record<string, any>, context?: ToolExecutionContext) => {
                    return await searchHistoryTool.execute(args, context);
                },
            });

            logger.debug('Registered search_history internal tool');
        }

        // Future internal tools can be registered here based on available services
        // if (this.services.sessionManager) { ... }
        // if (this.services.storageManager) { ... }
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
        args: Record<string, any>,
        sessionId?: string
    ): Promise<any> {
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
