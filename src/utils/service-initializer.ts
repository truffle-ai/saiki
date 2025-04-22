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
    // 1. Create the shared event bus
    const agentEventBus = new EventEmitter();

    // 2. Initialize client manager with server configs from unified config
    const clientManager = new ClientManager();
    await clientManager.initializeFromConfig(config.mcpServers, connectionMode);
    logger.debug('MCP servers initialized');

    // 3. Initialize the LLMService
    // Change vercel to false to use other LLM services
    const vercel = true;
    const llmService = createLLMService(config.llm, vercel, clientManager, agentEventBus);

    logger.debug('LLM service created');

    return { clientManager, llmService, agentEventBus };
}
