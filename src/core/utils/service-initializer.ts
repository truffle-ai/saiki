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
 * - These overrides are intended for swapping out top-level services (e.g., injecting a mock SessionManager or ClientManager in tests), not for
 *   overriding every internal dependency. This keeps the override API surface small, maintainable, and focused on real-world needs.
 * - If deeper customization is required (e.g., a custom compression strategy for MessageManager in a test), construct the desired service
 *   yourself and inject it via the appropriate top-level override (e.g., `sessionManager`).
 *
 * **Best Practice:**
 * - Use the config file for all user-facing and environment-specific configuration, including low-level service details.
 * - Use code-level overrides only for top-level services and only when necessary (e.g., for testing, mocking, or advanced integration).
 * - Do not expose every internal dependency as an override unless there is a strong, recurring need.
 *
 * This pattern ensures a clean, scalable, and maintainable architecture, balancing flexibility with simplicity.
 */

import { MCPClientManager } from '../client/manager.js';
import { createToolConfirmationProvider } from '../client/tool-confirmation/factory.js';
import { PromptManager } from '../ai/systemPrompt/manager.js';
import { StaticConfigManager } from '../config/static-config-manager.js';
import { AgentStateManager } from '../config/agent-state-manager.js';
import { SessionManager } from '../ai/session/session-manager.js';
import { createStorageInstances } from '../storage/factory.js';
import type { StorageInstances } from '../storage/types.js';
import { createAllowedToolsProvider } from '../client/tool-confirmation/allowed-tools-provider/factory.js';
import { logger } from '../logger/index.js';
import type { CLIConfigOverrides } from '../config/types.js';
import type { AgentConfig } from '../config/schemas.js';
import { AgentEventBus } from '../events/index.js';
import { createLocalStorageContextWithAutoDetection } from '../storage/index.js';

/**
 * Type for the core agent services returned by createAgentServices
 */
export type AgentServices = {
    clientManager: MCPClientManager;
    promptManager: PromptManager;
    agentEventBus: AgentEventBus;
    stateManager: AgentStateManager;
    sessionManager: SessionManager;
    storageManager: StorageInstances;
};

/**
 * Options for overriding or injecting services/config at runtime.
 *
 * **Design Rationale:**
 * - The config file (e.g., `saiki.yml`) is the main source of truth for configuring both high-level and low-level service options.
 *   This allows users and operators to declaratively tune the system without code changes.
 * - The `InitializeServicesOptions` type is intended for advanced/test scenarios where you need to override top-level services
 *   (such as injecting a mock SessionManager or ClientManager). This keeps the override API surface small and focused.
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
    clientManager?: MCPClientManager; // Inject a custom or mock MCPClientManager
    agentEventBus?: AgentEventBus; // Inject a custom or mock AgentEventBus
    sessionManager?: SessionManager; // Inject a custom or mock SessionManager
    storageManager?: StorageInstances; // Inject a custom or mock StorageManager
    // Add more overrides as needed
    // configOverride?: Partial<AgentConfig>; // (optional) for field-level config overrides
};

// High-level factory to load, validate, and wire up all agent services in one call
/**
 * Loads and validates configuration and initializes all agent services as a single unit.
 * @param agentConfig The agent configuration object
 * @param cliArgs Optional overrides from the CLI
 * @param overrides Optional service overrides for testing or advanced scenarios
 * @returns All the initialized services required for a Saiki agent
 */
export async function createAgentServices(
    agentConfig: AgentConfig,
    cliArgs?: CLIConfigOverrides,
    overrides?: InitializeServicesOptions
): Promise<AgentServices> {
    // 1. Initialize config manager and apply CLI overrides (if provided), then validate
    const configManager = new StaticConfigManager(agentConfig, cliArgs);
    configManager.validate();
    const config = configManager.getConfig();

    // 2. Initialize shared event bus
    const agentEventBus: AgentEventBus = overrides?.agentEventBus ?? new AgentEventBus();
    logger.debug('Agent event bus initialized');

    // 3. Initialize storage manager
    const storageManager =
        overrides?.storageManager ??
        (await createStorageInstances(
            config.storage,
            await createLocalStorageContextWithAutoDetection({
                isDevelopment: process.env.NODE_ENV !== 'production',
            })
        ));
    logger.debug('Storage manager initialized');

    // 4. Initialize client manager with storage-backed allowed tools provider
    const connectionMode = overrides?.connectionMode ?? 'lenient';
    const runMode = overrides?.runMode ?? 'cli';

    // TODO: Implement allowedTools storage in the new system
    // For now, use the default tool confirmation provider without storage
    const confirmationProvider = createToolConfirmationProvider({
        runMode,
        // allowedToolsProvider will be added when we implement allowedTools storage
    });

    const clientManager = overrides?.clientManager ?? new MCPClientManager(confirmationProvider);
    await clientManager.initializeFromConfig(config.mcpServers, connectionMode);

    const mcpServerCount = Object.keys(config.mcpServers).length;
    if (mcpServerCount === 0) {
        logger.info('Agent initialized without MCP servers - only built-in capabilities available');
    } else {
        logger.debug(
            overrides?.clientManager
                ? 'Client manager and MCP servers initialized via override'
                : `Client manager initialized with ${mcpServerCount} MCP server(s) and storage-backed allowed tools`
        );
    }

    // 5. Initialize prompt manager
    const promptManager = new PromptManager(config.llm.systemPrompt);

    // 6. Initialize state manager for runtime state tracking
    const stateManager = new AgentStateManager(config, agentEventBus);
    logger.debug('Agent state manager initialized');

    // 7. Initialize session manager
    const sessionManager =
        overrides?.sessionManager ??
        new SessionManager(
            {
                stateManager,
                promptManager,
                clientManager,
                agentEventBus,
                storageManager, // Add storage manager to session services
            },
            {
                maxSessions: config.sessions?.maxSessions,
                sessionTTL: config.sessions?.sessionTTL,
            }
        );

    // Initialize the session manager with persistent storage
    if (!overrides?.sessionManager) {
        await sessionManager.init();
    }

    logger.debug(
        overrides?.sessionManager
            ? 'Session manager provided via override'
            : 'Session manager initialized with storage support'
    );

    // 8. Return the core services
    return {
        clientManager,
        promptManager,
        agentEventBus,
        stateManager,
        sessionManager,
        storageManager,
    };
}
