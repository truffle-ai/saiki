/*
 * Service Initializer: Centralized Wiring for Saiki Core Services
 *
 * This module is responsible for initializing and wiring together all core agent services (LLM, client manager, message manager, event bus, etc.)
 * for the Saiki application. It provides a single entry point for constructing the service graph, ensuring consistent dependency injection
 * and configuration across CLI, web, and test environments.
 *
 * **Configuration Pattern:**
 * - The primary source of configuration is the config file (e.g., `saiki.yml`), which allows users to declaratively specify both high-level
 *   and low-level service options (such as compression strategies for MessageManager, LLM provider/model, etc.).
 * - For most use cases, the config file is sufficient and preferred, as it enables environment-specific, auditable, and user-friendly customization.
 *
 * **Override Pattern:**
 * - For advanced, programmatic, or test scenarios, this initializer supports code-level overrides via the `InitializeServicesOptions` type.
 * - These overrides are intended for swapping out top-level services (e.g., injecting a mock MessageManager or LLMService in tests), not for
 *   overriding every internal dependency. This keeps the override API surface small, maintainable, and focused on real-world needs.
 * - If deeper customization is required (e.g., a custom compression strategy for MessageManager in a test), construct the desired service
 *   yourself and inject it via the appropriate top-level override (e.g., `messageManager`).
 *
 * **Best Practice:**
 * - Use the config file for all user-facing and environment-specific configuration, including low-level service details.
 * - Use code-level overrides only for top-level services and only when necessary (e.g., for testing, mocking, or advanced integration).
 * - Do not expose every internal dependency as an override unless there is a strong, recurring need.
 *
 * This pattern ensures a clean, scalable, and maintainable architecture, balancing flexibility with simplicity.
 */

import { ClientManager } from '../client/manager.js';
import { ILLMService } from '../ai/llm/services/types.js';
import { AgentConfig } from '../config/types.js';
import { createLLMService } from '../ai/llm/services/factory.js';
import { logger } from './logger.js';
import { EventEmitter } from 'events';
import { LLMRouter } from '../ai/llm/types.js';
import { MessageManager } from '../ai/llm/messages/manager.js';
import { createMessageManager } from '../ai/llm/messages/factory.js';
import { createToolConfirmationProvider } from '../client/tool-confirmation/factory.js';

/**
 * Type for the core agent services returned by initializeServices
 */
export type AgentServices = {
    clientManager: ClientManager;
    llmService: ILLMService;
    agentEventBus: EventEmitter;
    messageManager: MessageManager;
};

/**
 * Options for overriding or injecting services/config at runtime.
 *
 * **Design Rationale:**
 * - The config file (e.g., `saiki.yml`) is the main source of truth for configuring both high-level and low-level service options.
 *   This allows users and operators to declaratively tune the system without code changes.
 * - The `InitializeServicesOptions` type is intended for advanced/test scenarios where you need to override top-level services
 *   (such as injecting a mock MessageManager or LLMService). This keeps the override API surface small and focused.
 * - For most use cases, do not expose every internal dependency here. If you need to customize internals (e.g., a custom compression strategy),
 *   construct the service yourself and inject it as a top-level override.
 *
 * **Summary:**
 * - Use config for normal operation and low-level tuning.
 * - Use top-level service overrides for code/test/advanced scenarios.
 * - This pattern is robust, scalable, and easy to maintain.
 */
export type InitializeServicesOptions = {
    runMode?: 'cli' | 'web'; // Context/mode override
    connectionMode?: 'strict' | 'lenient'; // Connection mode override
    clientManager?: ClientManager;     // Inject a custom or mock ClientManager
    llmService?: ILLMService;         // Inject a custom or mock LLMService
    agentEventBus?: EventEmitter;     // Inject a custom or mock EventEmitter
    llmRouter?: LLMRouter; // Route LLM calls via Vercel (default) or use in-built
    messageManager?: MessageManager;  // Inject a custom or mock MessageManager
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
     *    - Selects the appropriate ToolConfirmationProvider based on runMode (cli/web/etc) using the factory.
     */
    const connectionMode = options?.connectionMode ?? 'lenient';
    const runMode = options?.runMode ?? 'cli';
    const confirmationProvider = createToolConfirmationProvider(runMode);
    const clientManager = options?.clientManager ?? new ClientManager(confirmationProvider);
    await clientManager.initializeFromConfig(config.mcpServers, connectionMode);
    if (!options?.clientManager) {
        logger.debug('Client manager and MCP servers initialized');
    } else {
        logger.debug('Client manager and MCP servers initialized via options override');
    }

    /**
     * 3. Initialize or use the MessageManager (allows override for tests/mocks)
     *    - Uses llmRouter from options to select the correct message formatting/tokenization backend
     *    - 'vercel' = Vercel-style message formatting (default), 'default' = in-built provider-specific formatting
     */
    const router: LLMRouter = options?.llmRouter ?? 'vercel';
    const messageManager = options?.messageManager ?? createMessageManager(config.llm, router);

    /**
     * 4. Initialize or use the LLMService (allows override for tests/mocks)
     *    - Use llmRouter from options to select LLM routing backend
     *    - 'vercel' = route via Vercel LLM service (default), 'default' = use in-built LLM services
     */
    const llmService = options?.llmService ?? createLLMService(config.llm, router, clientManager, agentEventBus, messageManager);
    if (!options?.llmService) {
        logger.debug(`LLM service initialized using router: ${router}`);
    } else {
        logger.debug('LLM service provided via options override');
    }

    return { clientManager, llmService, agentEventBus, messageManager };
}
