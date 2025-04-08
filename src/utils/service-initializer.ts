import { ClientManager } from '../client/manager.js';
import { ILLMService } from '../ai/llm/types.js';
import { AgentConfig } from '../config/types.js';
import { createLLMService } from '../ai/llm/factory.js';
import { logger } from './logger.js';

/**
 * Initialize services and clients based on the provided configuration
 * @param config Agent configuration including MCP servers and LLM settings
 * @param connectionMode Whether to enforce all connections must succeed ("strict") or allow partial success ("lenient")
 * @returns Initialized client manager and LLM service
 */
export async function initializeServices(
    config: AgentConfig,
    connectionMode: 'strict' | 'lenient' = 'lenient'
): Promise<{ clientManager: ClientManager; llmService: ILLMService }> {
    // Initialize client manager with server configs from unified config
    const clientManager = new ClientManager();
    await clientManager.initializeFromConfig(config.mcpServers, connectionMode);
    logger.debug('MCP servers initialized');

    // Change vercel to false to use other LLM services
    const vercel = true;
    const llmService = createLLMService(config.llm, clientManager, vercel);

    logger.debug('LLM service created');

    return { clientManager, llmService };
}
