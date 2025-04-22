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
 * Initialize services and clients based on the provided configuration
 * This is the central point for creating all services and dependencies
 * @param config Agent configuration including MCP servers and LLM settings
 * @param connectionMode Whether to enforce all connections must succeed ("strict") or allow partial success ("lenient")
 * @returns All the initialized services/dependencies necessary to run saiki
 */
export async function initializeServices(
    config: AgentConfig,
    connectionMode: 'strict' | 'lenient' = 'lenient'
): Promise<AgentServices> {
    /*
     * 1. Create the shared event bus.
     * This is a common resource used to communicate events between services.
     * It is used to notify subscribers when certain events occur.
     */
    const agentEventBus = new EventEmitter();
    logger.debug('Agent event bus initialized');

    /**
     * 2. Initialize client manager with the mcp server configs and connection mode
     * This is used to manage all the connections to MCP servers.
     */
    const clientManager = new ClientManager();
    await clientManager.initializeFromConfig(config.mcpServers, connectionMode);
    logger.debug('Client manager and MCP servers initialized');

    /**
     * 3. Initialize the LLMService
     * This is used to orchestrate the LLM to generate messages and handle looping logic
     */
    // Change vercel to false to use in-built LLM services. TODO: Make this configurable
    const vercel = true;
    const llmService = createLLMService(config.llm, vercel, clientManager, agentEventBus);
    logger.debug('LLM service initialized');

    return { clientManager, llmService, agentEventBus };
}
