import { ClientManager } from '../client/manager.js';
import { ILLMService } from '../ai/llm/services/types.js';
import { AgentConfig } from '../config/types.js';
import { createLLMService } from '../ai/llm/services/factory.js';
import { logger } from './logger.js';
import { EventEmitter } from 'events';

/**
 * Type for the core agent services returned by initializeServices
 */
export type AgentServices = {
    clientManager: ClientManager;
    llmService: ILLMService;
    agentEventBus: EventEmitter;
};

/**
 * Options for overriding or injecting services/config at runtime.
 * This enables testability, context-specific tweaks, and advanced configuration.
 * - Use to override config fields, inject mocks, or pass runMode/context.
 * - All fields are optional; defaults to config file/env if not provided.
 */
export type InitializeServicesOptions = {
    runMode?: 'cli' | 'web' | 'test'; // Context/mode override
    clientManager?: ClientManager;     // Inject a custom or mock ClientManager
    llmService?: ILLMService;         // Inject a custom or mock LLMService
    agentEventBus?: EventEmitter;     // Inject a custom or mock EventEmitter
    // Add more overrides as needed
    // configOverride?: Partial<AgentConfig>; // (optional) for field-level config overrides
};

/**
 * Initialize services and clients based on the provided configuration and optional overrides.
 * This is the central point for creating all services and dependencies.
 * @param config Agent configuration including MCP servers and LLM settings
 * @param connectionMode Whether to enforce all connections must succeed ("strict") or allow partial success ("lenient")
 * @param options Optional overrides for testability, context, or advanced configuration
 * @returns All the initialized services/dependencies necessary to run saiki
 */
export async function initializeServices(
    config: AgentConfig,
    connectionMode: 'strict' | 'lenient' = 'lenient',
    options?: InitializeServicesOptions // <-- New parameter for overrides
): Promise<AgentServices> {
    // TODO: Use options to override or inject services/config as needed
    // Example: if (options?.clientManager) use it, else create a new one
    // Example: if (options?.runMode) branch logic as needed

    /*
     * 1. Create or use the shared event bus (allows override for tests/mocks)
     * This is a common resource used to communicate events between services.
     * It is used to notify subscribers when certain events occur.
     */
    const agentEventBus = options?.agentEventBus ?? new EventEmitter();
    logger.debug('Agent event bus initialized');

    /**
     * 2. Create the client manager and initialize it mcp server configs and connection mode (allows override for tests/mocks)
     * This is used to manage all the connections to MCP servers.
     */
    const clientManager = options?.clientManager ?? new ClientManager();
    await clientManager.initializeFromConfig(config.mcpServers, connectionMode);
    logger.debug('Client manager and MCP servers initialized');

    /**
     * 3. Initialize or use the LLMService (allows override for tests/mocks)
     * This is used to orchestrate the LLM to generate messages and handle looping logic
     */
    // Change vercel to false to use in-built LLM services. TODO: Make this configurable
    const vercel = true;
    const llmService = options?.llmService ?? createLLMService(config.llm, vercel, clientManager, agentEventBus);
    if (!options?.llmService) {
        logger.debug('LLM service initialized');
    } else {
        logger.debug('LLM service provided via options override');
    }

    return { clientManager, llmService, agentEventBus };
}
