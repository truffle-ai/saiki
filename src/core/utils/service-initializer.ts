/*
 * Service Initializer: Centralized Wiring for Saiki Core Services
 *
 * This module is responsible for initializing and wiring together all core agent services (LLM, client manager, message manager, event bus, etc.)
 * for the Saiki application. It provides a single entry point for constructing the service graph, ensuring consistent dependency injection
 * and configuration across CLI, web, and test environments.
 *
 * **Configuration Pattern:**
 * - The primary source of configuration is the config file (e.g., `agent.yml`), which allows users to declaratively specify both high-level
 *   and low-level service options (such as compression strategies for ContextManager, LLM provider/model, etc.).
 * - For most use cases, the config file is sufficient and preferred, as it enables environment-specific, auditable, and user-friendly customization.
 *
 * **Service Architecture:**
 * - All services are initialized based on the provided configuration.
 * - For testing scenarios, mock the service dependencies directly using test frameworks rather than relying on service injection patterns.
 *
 * **Best Practice:**
 * - Use the config file for all user-facing and environment-specific configuration, including low-level service details.
 * - For testing, use proper mocking frameworks rather than service injection to ensure clean, maintainable tests.
 *
 * This pattern ensures a clean, scalable, and maintainable architecture, balancing flexibility with simplicity.
 */

import { MCPManager } from '../client/manager.js';
import { ToolManager } from '../tools/tool-manager.js';
import { InternalToolsProvider } from '../tools/internal-tools-provider.js';
import { createToolConfirmationProvider } from '../client/tool-confirmation/factory.js';
import { PromptManager } from '../ai/systemPrompt/manager.js';
import { ConfigManager } from '../config/config-manager.js';
import { AgentStateManager } from '../config/agent-state-manager.js';
import { SessionManager } from '../ai/session/session-manager.js';
import { SearchService } from '../ai/search/search-service.js';
import { dirname, resolve } from 'path';
import { createStorageBackends, type StorageBackends, StorageManager } from '../storage/index.js';
import { createAllowedToolsProvider } from '../client/tool-confirmation/allowed-tools-provider/factory.js';
import { logger } from '../logger/index.js';
import type { AgentConfig } from '../config/schemas.js';
import { AgentEventBus } from '../events/index.js';
import { SchedulerService } from './scheduler.js';

/**
 * Type for the core agent services returned by createAgentServices
 */
export type AgentServices = {
    mcpManager: MCPManager;
    toolManager: ToolManager;
    promptManager: PromptManager;
    agentEventBus: AgentEventBus;
    stateManager: AgentStateManager;
    sessionManager: SessionManager;
    searchService: SearchService;
    scheduler: SchedulerService;
    storage: StorageBackends;
    storageManager?: StorageManager;
};

// High-level factory to load, validate, and wire up all agent services in one call
/**
 * Loads and validates configuration and initializes all agent services as a single unit.
 * @param agentConfig The agent configuration object
 * @returns All the initialized services required for a Saiki agent
 */
export async function createAgentServices(
    agentConfig: AgentConfig,
    configPath?: string
): Promise<AgentServices> {
    // 1. Initialize config manager and validate
    const configManager = new ConfigManager(agentConfig);
    const config = configManager.getConfig();

    // 2. Initialize shared event bus
    const agentEventBus: AgentEventBus = new AgentEventBus();
    logger.debug('Agent event bus initialized');

    // 3. Initialize storage backends (instance-specific, not singleton)
    logger.debug('Initializing storage backends');
    const storageResult = await createStorageBackends(config.storage);
    const storage = storageResult.backends;
    const storageManager = storageResult.manager;

    logger.debug('Storage backends initialized', {
        cache: config.storage.cache.type,
        database: config.storage.database.type,
    });

    // 4. Initialize client manager with configurable tool confirmation
    // Create allowed tools provider based on configuration
    const allowedToolsProvider = createAllowedToolsProvider({
        type: config.toolConfirmation.allowedToolsStorage,
        storage,
    });

    // Create tool confirmation provider with configured mode and timeout
    const confirmationProvider = createToolConfirmationProvider({
        mode: config.toolConfirmation.mode,
        allowedToolsProvider,
        agentEventBus,
        confirmationTimeout: config.toolConfirmation.timeout,
    });

    const mcpManager = new MCPManager(confirmationProvider);
    await mcpManager.initializeFromConfig(config.mcpServers);

    // 5. Initialize search service
    const searchService = new SearchService(storage.database);

    // 6. Initialize scheduler service
    const scheduler = new SchedulerService(agentEventBus);
    logger.debug('Scheduler service initialized');

    // 7. Initialize internal tools provider with services and confirmation support
    const internalToolsProvider = new InternalToolsProvider(
        {
            searchService,
            scheduler,
            // Future services can be added here as needed
        },
        confirmationProvider,
        config.internalTools
    );

    // 8. Initialize unified tool manager
    const toolManager = new ToolManager(mcpManager, confirmationProvider);

    // Initialize internal tools if any are configured
    if (config.internalTools.length > 0) {
        await toolManager.initializeInternalTools(internalToolsProvider);
    } else {
        logger.info('No internal tools enabled by configuration - skipping initialization');
    }

    const mcpServerCount = Object.keys(config.mcpServers).length;
    if (mcpServerCount === 0) {
        logger.info('Agent initialized without MCP servers - only built-in capabilities available');
    } else {
        logger.debug(`MCPManager initialized with ${mcpServerCount} MCP server(s)`);
    }

    // 9. Initialize prompt manager
    const configDir = configPath ? dirname(resolve(configPath)) : process.cwd();
    logger.debug(
        `[ServiceInitializer] Creating PromptManager with configPath: ${configPath} → configDir: ${configDir}`
    );
    const promptManager = new PromptManager(config.systemPrompt, configDir);

    // 10. Initialize state manager for runtime state tracking
    const stateManager = new AgentStateManager(config, agentEventBus);
    logger.debug('Agent state manager initialized');

    // 11. Initialize session manager
    const sessionManager = new SessionManager(
        {
            stateManager,
            promptManager,
            toolManager,
            agentEventBus,
            storage, // Add storage backends to session services
        },
        {
            maxSessions: config.sessions?.maxSessions,
            sessionTTL: config.sessions?.sessionTTL,
        }
    );

    // Initialize the session manager with persistent storage
    await sessionManager.init();

    logger.debug('Session manager initialized with storage support');

    // 12. Return the core services
    return {
        mcpManager,
        toolManager,
        promptManager,
        agentEventBus,
        stateManager,
        sessionManager,
        searchService,
        scheduler,
        storage,
        storageManager,
    };
}
