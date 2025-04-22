import { ClientManager } from '../client/manager.js';
import { ILLMService } from '../ai/llm/services/types.js';
import { AgentConfig } from '../config/types.js';
import { createLLMService } from '../ai/llm/services/factory.js';
import { logger } from './logger.js';
import { EventEmitter } from 'events';
import { LLMRouter } from '../ai/llm/types.js';

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
    connectionMode?: 'strict' | 'lenient'; // Connection mode override
    clientManager?: ClientManager;     // Inject a custom or mock ClientManager
    llmService?: ILLMService;         // Inject a custom or mock LLMService
    agentEventBus?: EventEmitter;     // Inject a custom or mock EventEmitter
    llmRouter?: LLMRouter; // Route LLM calls via Vercel (default) or use in-built
    // Add more overrides as needed
    // configOverride?: Partial<AgentConfig>; // (optional) for field-level config overrides
};

/**
 * Initialize services and clients based on the provided configuration and optional overrides.
 * This is the central point for creating all services and dependencies.
 * @param config Agent configuration including MCP servers and LLM settings
 * @param options Optional overrides for testability, context, or advanced configuration
 * @returns All the initialized services/dependencies necessary to run saiki
 */
export async function initializeServices(
    config: AgentConfig,
    options?: InitializeServicesOptions
): Promise<AgentServices> {
    /**
     * 1. Create or use the shared event bus (allows override for tests/mocks)
     */
    const agentEventBus = options?.agentEventBus ?? new EventEmitter();
    logger.debug('Agent event bus initialized');

    /**
     * 2. Initialize or use the client manager (allows override for tests/mocks)
     */
    const connectionMode = options?.connectionMode ?? 'lenient';
    const clientManager = options?.clientManager ?? new ClientManager();
    await clientManager.initializeFromConfig(config.mcpServers, connectionMode);
    if (!options?.clientManager) {
        logger.debug('Client manager and MCP servers initialized');
    } else {
        logger.debug('Client manager and MCP servers initialized via options override');
    }

    /**
     * 3. Initialize or use the LLMService (allows override for tests/mocks)
     *    - Use llmRouter from options to select LLM routing backend
     *    - 'vercel' = route via Vercel LLM service (default), 'default' = use in-built LLM services
     */
    const router: LLMRouter = options?.llmRouter ?? 'vercel';
    const llmService = options?.llmService ?? createLLMService(config.llm, router, clientManager, agentEventBus);
    if (!options?.llmService) {
        logger.debug(`LLM service initialized using router: ${router}`);
    } else {
        logger.debug('LLM service provided via options override');
    }

    return { clientManager, llmService, agentEventBus };
}
