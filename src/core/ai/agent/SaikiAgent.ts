// src/ai/agent/SaikiAgent.ts
import { MCPManager } from '../../client/manager.js';
import { PromptManager } from '../systemPrompt/manager.js';
import { AgentStateManager } from '../../config/agent-state-manager.js';
import { SessionManager, SessionMetadata, ChatSession } from '../session/index.js';
import { AgentServices } from '../../utils/service-initializer.js';
import { logger } from '../../logger/index.js';
import { McpServerConfig, LLMConfig } from '../../config/schemas.js';
import { createAgentServices } from '../../utils/service-initializer.js';
import type { AgentConfig } from '../../config/schemas.js';
import type { InitializeServicesOptions } from '../../utils/service-initializer.js';
import { AgentEventBus } from '../../events/index.js';
import { buildLLMConfig } from '../../config/validation-utils.js';
import type { IMCPClient } from '../../client/types.js';

const requiredServices: (keyof AgentServices)[] = [
    'clientManager',
    'promptManager',
    'agentEventBus',
    'stateManager',
    'sessionManager',
];

/**
 * The main entry point into Saiki's core functionality.
 *
 * SaikiAgent is a high-level abstraction layer that provides a clean, user-facing API
 * for building AI agents. It coordinates multiple internal services to deliver core
 * capabilities including conversation management, LLM switching, MCP server integration,
 * and multi-session support.
 *
 * Key Features:
 * - **Conversation Management**: Process user messages and maintain conversation state
 * - **Multi-Session Support**: Create and manage multiple independent chat sessions
 * - **Dynamic LLM Switching**: Change language models while preserving conversation history
 * - **MCP Server Integration**: Connect to and manage Model Context Protocol servers
 * - **Tool Execution**: Execute tools from connected MCP servers
 * - **Event System**: Emit events for integration with external systems
 *
 * Design Principles:
 * - Thin wrapper around internal services with high-level methods
 * - Primary API for applications building on Saiki
 * - Internal services exposed as public readonly properties for advanced usage
 * - Backward compatibility through default session management
 *
 * @example
 * ```typescript
 * // Create and start agent
 * const agent = new SaikiAgent(config);
 * await agent.start();
 *
 * // Process user messages
 * const response = await agent.run("Hello, how are you?");
 *
 * // Switch LLM models
 * await agent.switchLLM({ model: 'gpt-4o', provider: 'openai' });
 *
 * // Manage sessions
 * const session = agent.createSession('user-123');
 * const response = await agent.run("Hello", undefined, 'user-123');
 *
 * // Connect MCP servers
 * await agent.connectMcpServer('filesystem', { command: 'mcp-filesystem' });
 *
 * // Gracefully stop the agent when done
 * await agent.stop();
 * ```
 */
export class SaikiAgent {
    /**
     * These services are public for use by the outside world
     * This gives users the option to use methods of the services directly if they know what they are doing
     * But the main recommended entry points/functions would still be the wrapper methods we define below
     */
    public readonly clientManager!: MCPManager;
    public readonly promptManager!: PromptManager;
    public readonly agentEventBus!: AgentEventBus;
    public readonly stateManager!: AgentStateManager;
    public readonly sessionManager!: SessionManager;
    public readonly services!: AgentServices;

    // Default session for backward compatibility
    private defaultSession: ChatSession | null = null;

    // Current default session ID for loadSession functionality
    private currentDefaultSessionId: string = 'default';

    // Track initialization state
    private isStarted: boolean = false;
    private isStopped: boolean = false;

    // Store config for async initialization
    private config: AgentConfig;
    private options?: InitializeServicesOptions;

    constructor(config: AgentConfig, options?: InitializeServicesOptions) {
        this.config = config;
        this.options = options;

        logger.info('SaikiAgent created (call start() to initialize async services).');
    }

    /**
     * Starts the agent by initializing all async services.
     * This method handles storage backends, MCP connections, session manager initialization, and other async operations.
     * Must be called before using any agent functionality.
     *
     * @throws Error if agent is already started or initialization fails
     */
    public async start(): Promise<void> {
        if (this.isStarted) {
            throw new Error('Agent is already started');
        }

        try {
            logger.info('Starting SaikiAgent...');

            // Initialize all services asynchronously
            const services = await createAgentServices(this.config, this.options);

            // Validate all required services are provided
            for (const service of requiredServices) {
                if (!services[service]) {
                    throw new Error(`Required service ${service} is missing during agent start`);
                }
            }

            // Use Object.assign to set readonly properties
            Object.assign(this, {
                clientManager: services.clientManager,
                promptManager: services.promptManager,
                agentEventBus: services.agentEventBus,
                stateManager: services.stateManager,
                sessionManager: services.sessionManager,
                services: services,
            });

            this.isStarted = true;
            logger.info('SaikiAgent started successfully.');
        } catch (error) {
            logger.error('Failed to start SaikiAgent', error);
            throw error;
        }
    }

    /**
     * Stops the agent and gracefully shuts down all services.
     * This method handles disconnecting MCP clients, cleaning up sessions, closing storage connections,
     * and releasing all resources. The agent cannot be restarted after being stopped.
     *
     * @throws Error if agent has not been started or shutdown fails
     */
    public async stop(): Promise<void> {
        if (this.isStopped) {
            logger.warn('Agent is already stopped');
            return;
        }

        if (!this.isStarted) {
            throw new Error('Agent must be started before it can be stopped');
        }

        try {
            logger.info('Stopping SaikiAgent...');

            const shutdownErrors: Error[] = [];

            // 1. Clean up session manager (stop accepting new sessions, clean existing ones)
            try {
                if (this.sessionManager) {
                    await this.sessionManager.cleanup();
                    logger.debug('SessionManager cleaned up successfully');
                }
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                shutdownErrors.push(new Error(`SessionManager cleanup failed: ${err.message}`));
            }

            // 2. Disconnect all MCP clients
            try {
                if (this.clientManager) {
                    await this.clientManager.disconnectAll();
                    logger.debug('MCPManager disconnected all clients successfully');
                }
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                shutdownErrors.push(new Error(`MCPManager disconnect failed: ${err.message}`));
            }

            // 3. Close storage backends
            try {
                if (this.services?.storageManager) {
                    await this.services.storageManager.disconnect();
                    logger.debug('Storage manager disconnected successfully');
                }
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                shutdownErrors.push(new Error(`Storage disconnect failed: ${err.message}`));
            }

            this.isStopped = true;
            this.isStarted = false;

            if (shutdownErrors.length > 0) {
                const errorMessages = shutdownErrors.map((e) => e.message).join('; ');
                logger.warn(`SaikiAgent stopped with some errors: ${errorMessages}`);
                // Still consider it stopped, but log the errors
            } else {
                logger.info('SaikiAgent stopped successfully.');
            }
        } catch (error) {
            logger.error('Failed to stop SaikiAgent', error);
            throw error;
        }
    }

    /**
     * Checks if the agent has been started.
     * @returns true if agent is started, false otherwise
     */
    public getIsStarted(): boolean {
        return this.isStarted;
    }

    /**
     * Checks if the agent has been stopped.
     * @returns true if agent is stopped, false otherwise
     */
    public getIsStopped(): boolean {
        return this.isStopped;
    }

    /**
     * Ensures the agent is started before executing operations.
     * @throws Error if agent is not started or has been stopped
     */
    private ensureStarted(): void {
        if (this.isStopped) {
            throw new Error('Agent has been stopped and cannot be used');
        }
        if (!this.isStarted) {
            throw new Error('Agent must be started before use. Call agent.start() first.');
        }
    }

    // ============= CORE AGENT FUNCTIONALITY =============

    /**
     * Main method for processing user input.
     * Processes user input through the agent's LLM service and returns the response.
     *
     * @param userInput - The user's message or query to process
     * @param imageDataInput - Optional image data and MIME type for multimodal input
     * @param sessionId - Optional session ID for multi-session scenarios
     * @returns Promise that resolves to the AI's response text, or null if no significant response
     * @throws Error if processing fails
     */
    public async run(
        userInput: string,
        imageDataInput?: { image: string; mimeType: string },
        sessionId?: string,
        stream: boolean = false
    ): Promise<string | null> {
        this.ensureStarted();
        try {
            let session: ChatSession;

            if (sessionId) {
                // Use specific session or create it if it doesn't exist
                session =
                    (await this.sessionManager.getSession(sessionId)) ??
                    (await this.sessionManager.createSession(sessionId));
            } else {
                // Use loaded default session for backward compatibility
                if (
                    !this.defaultSession ||
                    this.defaultSession.id !== this.currentDefaultSessionId
                ) {
                    this.defaultSession = await this.sessionManager.createSession(
                        this.currentDefaultSessionId
                    );
                    logger.debug(
                        `SaikiAgent.run: created/loaded default session ${this.defaultSession.id}`
                    );
                }
                session = this.defaultSession;
            }

            logger.debug(
                `SaikiAgent.run: userInput: ${userInput}, imageDataInput: ${imageDataInput}, sessionId: ${sessionId || this.currentDefaultSessionId}`
            );
            const response = await session.run(userInput, imageDataInput, stream);

            // Increment message count for this session (counts each)
            await this.sessionManager.incrementMessageCount(session.id);

            // If response is an empty string, treat it as no significant response.
            if (response && response.trim() !== '') {
                return response;
            }
            // Return null if the response is empty or just whitespace.
            return null;
        } catch (error) {
            logger.error(
                `Error during SaikiAgent.run: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    }

    // ============= SESSION MANAGEMENT =============

    /**
     * Creates a new chat session or returns an existing one.
     * @param sessionId Optional session ID. If not provided, a UUID will be generated.
     * @returns The created or existing ChatSession
     */
    public async createSession(sessionId?: string): Promise<ChatSession> {
        this.ensureStarted();
        return await this.sessionManager.createSession(sessionId);
    }

    /**
     * Retrieves an existing session by ID.
     * @param sessionId The session ID to retrieve
     * @returns The ChatSession if found, undefined otherwise
     */
    public async getSession(sessionId: string): Promise<ChatSession | undefined> {
        this.ensureStarted();
        return await this.sessionManager.getSession(sessionId);
    }

    /**
     * Lists all active session IDs.
     * @returns Array of session IDs
     */
    public async listSessions(): Promise<string[]> {
        this.ensureStarted();
        return await this.sessionManager.listSessions();
    }

    /**
     * Deletes a session and cleans up its resources.
     * @param sessionId The session ID to delete
     */
    public async deleteSession(sessionId: string): Promise<void> {
        this.ensureStarted();
        // If deleting the currently loaded default session, clear our reference
        if (sessionId === this.currentDefaultSessionId) {
            this.defaultSession = null;
        }
        return this.sessionManager.deleteSession(sessionId);
    }

    /**
     * @deprecated Use deleteSession instead. This method will be removed in a future version.
     */
    public async endSession(sessionId: string): Promise<void> {
        logger.warn('endSession is deprecated, use deleteSession instead');
        return this.deleteSession(sessionId);
    }

    /**
     * Gets metadata for a specific session.
     * @param sessionId The session ID
     * @returns The session metadata or undefined if session doesn't exist
     */
    public async getSessionMetadata(sessionId: string): Promise<SessionMetadata | undefined> {
        this.ensureStarted();
        return await this.sessionManager.getSessionMetadata(sessionId);
    }

    /**
     * Gets the conversation history for a specific session.
     * @param sessionId The session ID
     * @returns Promise that resolves to the session's conversation history
     * @throws Error if session doesn't exist
     */
    public async getSessionHistory(sessionId: string) {
        this.ensureStarted();
        const session = await this.sessionManager.getSession(sessionId);
        if (!session) {
            throw new Error(`Session '${sessionId}' not found`);
        }
        return await session.getHistory();
    }

    /**
     * Loads a session as the new "default" session for this agent.
     * All subsequent operations that don't specify a session ID will use this session.
     * This provides a clean "current working session" pattern for API users.
     *
     * @param sessionId The session ID to load as default, or null to reset to original default
     * @throws Error if session doesn't exist
     *
     * @example
     * ```typescript
     * // Load a specific session as default
     * await agent.loadSession('project-alpha');
     * await agent.run("What's the status?"); // Uses project-alpha session
     *
     * // Reset to original default
     * await agent.loadSession(null);
     * await agent.run("Hello"); // Uses 'default' session
     * ```
     */
    public async loadSession(sessionId: string | null = null): Promise<void> {
        this.ensureStarted();
        if (sessionId === null) {
            this.currentDefaultSessionId = 'default';
            this.defaultSession = null; // Clear cached session to force reload
            logger.debug('Agent default session reset to original default');
            return;
        }

        // Verify session exists before loading it
        const session = await this.sessionManager.getSession(sessionId);
        if (!session) {
            throw new Error(`Session '${sessionId}' not found`);
        }

        this.currentDefaultSessionId = sessionId;
        this.defaultSession = null; // Clear cached session to force reload
        logger.debug(`Agent default session changed to: ${sessionId}`);
    }

    /**
     * Gets the currently loaded default session ID.
     * This reflects the session loaded via loadSession().
     *
     * @returns The current default session ID
     */
    public getCurrentSessionId(): string {
        return this.currentDefaultSessionId;
    }

    /**
     * Gets the currently loaded default session.
     * This respects the session loaded via loadSession().
     *
     * @returns The current default ChatSession
     */
    public async getDefaultSession(): Promise<ChatSession> {
        this.ensureStarted();
        if (!this.defaultSession || this.defaultSession.id !== this.currentDefaultSessionId) {
            this.defaultSession = await this.sessionManager.createSession(
                this.currentDefaultSessionId
            );
        }
        return this.defaultSession;
    }

    /**
     * Resets the conversation history for a specific session or the default session.
     * Keeps the session alive but the conversation history is cleared.
     * @param sessionId Optional session ID. If not provided, resets the currently loaded default session.
     */
    public async resetConversation(sessionId?: string): Promise<void> {
        this.ensureStarted();
        try {
            const targetSessionId = sessionId || this.currentDefaultSessionId;

            // Ensure session exists or create loaded default session
            if (!sessionId) {
                // Use loaded default session for backward compatibility
                if (
                    !this.defaultSession ||
                    this.defaultSession.id !== this.currentDefaultSessionId
                ) {
                    this.defaultSession = await this.sessionManager.createSession(
                        this.currentDefaultSessionId
                    );
                }
            }

            // Use SessionManager's resetSession method for better consistency
            await this.sessionManager.resetSession(targetSessionId);

            logger.info(`SaikiAgent conversation reset for session: ${targetSessionId}`);
            this.agentEventBus.emit('saiki:conversationReset', {
                sessionId: targetSessionId,
            });
        } catch (error) {
            logger.error(
                `Error during SaikiAgent.resetConversation: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    }

    // ============= LLM MANAGEMENT =============

    /**
     * Gets the current LLM configuration.
     * @returns Current LLM configuration
     */
    public getCurrentLLMConfig(): LLMConfig {
        this.ensureStarted();
        return structuredClone(this.stateManager.getRuntimeState().llm);
    }

    /**
     * Switches the LLM service while preserving conversation history.
     * This is a comprehensive method that handles ALL validation, configuration building, and switching internally.
     *
     * Key features:
     * - Accepts partial LLM configuration object
     * - Extracts and validates parameters internally
     * - Infers provider from model if not provided
     * - Automatically resolves API keys from environment variables
     * - Uses LLMConfigSchema for comprehensive validation
     * - Prevents inconsistent partial updates
     * - Smart defaults for missing configuration values
     *
     * @param llmUpdates Partial LLM configuration object containing the updates to apply
     * @param sessionId Session ID to switch LLM for. If not provided, switches for default session. Use '*' for all sessions
     * @returns Promise that resolves with the new configuration and validation results
     * @throws Error if validation fails or switching fails
     *
     * @example
     * ```typescript
     * // Switch to a different model (provider will be inferred, API key auto-resolved)
     * await agent.switchLLM({ model: 'gpt-4o' });
     *
     * // Switch to a different provider with explicit API key
     * await agent.switchLLM({ provider: 'anthropic', model: 'claude-4-sonnet-20250514', apiKey: 'sk-ant-...' });
     *
     * // Switch with router and session options
     * await agent.switchLLM({ provider: 'anthropic', model: 'claude-4-sonnet-20250514', router: 'in-built' }, 'user-123');
     *
     * // Switch for all sessions
     * await agent.switchLLM({ model: 'gpt-4o' }, '*');
     * ```
     */
    public async switchLLM(
        llmUpdates: Partial<LLMConfig>,
        sessionId?: string
    ): Promise<{
        success: boolean;
        config?: LLMConfig;
        message?: string;
        warnings?: string[];
        errors?: Array<{
            type: string;
            message: string;
            provider?: string;
            model?: string;
            router?: string;
            suggestedAction?: string;
        }>;
    }> {
        this.ensureStarted();
        // Basic validation
        if (!llmUpdates.model && !llmUpdates.provider) {
            return {
                success: false,
                errors: [
                    {
                        type: 'general',
                        message: 'At least model or provider must be specified',
                    },
                ],
            };
        }

        try {
            // Get current config for the session
            const currentLLMConfig = sessionId
                ? this.stateManager.getEffectiveState(sessionId).llm
                : this.stateManager.getEffectiveState().llm;

            // Build and validate the new configuration
            const result = await buildLLMConfig(llmUpdates, currentLLMConfig);

            if (!result.isValid) {
                // Return structured errors for UI consumption
                return {
                    success: false,
                    errors: result.errors.map((err) => ({
                        type: err.type,
                        message: err.message,
                        provider: err.provider,
                        model: err.model,
                        router: err.router,
                        suggestedAction:
                            err.type === 'missing_api_key'
                                ? `Please set the ${err.provider?.toUpperCase()}_API_KEY environment variable or provide the API key directly.`
                                : err.suggestedAction,
                    })),
                    warnings: result.warnings,
                };
            }

            // Perform the actual LLM switch with validated config
            return await this.performLLMSwitch(result.config, sessionId, result.warnings);
        } catch (error) {
            logger.error('Error switching LLM', {
                error: error.message,
                config: llmUpdates,
                sessionScope: sessionId,
            });
            return {
                success: false,
                errors: [
                    {
                        type: 'general',
                        message: error.message,
                    },
                ],
            };
        }
    }

    /**
     * Performs the actual LLM switch with a validated configuration.
     * This is a helper method that handles state management and session switching.
     *
     * @param validatedConfig - The validated LLM configuration to apply
     * @param sessionScope - Session ID, '*' for all sessions, or undefined for default session
     * @param configWarnings - Warnings from the validation process
     * @returns Promise resolving to switch result
     */
    private async performLLMSwitch(
        validatedConfig: LLMConfig,
        sessionScope?: string,
        configWarnings: string[] = []
    ): Promise<{
        success: boolean;
        config?: LLMConfig;
        message?: string;
        warnings?: string[];
        errors?: Array<{
            type: string;
            message: string;
            provider?: string;
            model?: string;
            router?: string;
            suggestedAction?: string;
        }>;
    }> {
        // Update state manager
        const stateValidation = this.stateManager.updateLLM(validatedConfig, sessionScope);
        if (!stateValidation.isValid) {
            return {
                success: false,
                errors: stateValidation.errors.map((err) => ({
                    type: err.type,
                    message: err.message,
                    provider: err.provider,
                    model: err.model,
                    router: err.router,
                    suggestedAction: err.suggestedAction,
                })),
            };
        }

        // Switch LLM in session(s)
        let switchResult;
        if (sessionScope === '*') {
            switchResult = await this.sessionManager.switchLLMForAllSessions(validatedConfig);
        } else if (sessionScope) {
            // Verify session exists
            if (!(await this.sessionManager.getSession(sessionScope))) {
                return {
                    success: false,
                    errors: [
                        {
                            type: 'general',
                            message: `Session ${sessionScope} not found`,
                        },
                    ],
                };
            }
            switchResult = await this.sessionManager.switchLLMForSpecificSession(
                validatedConfig,
                sessionScope
            );
        } else {
            switchResult = await this.sessionManager.switchLLMForDefaultSession(validatedConfig);
        }

        // Collect warnings
        const allWarnings = [
            ...configWarnings,
            ...(stateValidation.warnings || []),
            ...(switchResult.warnings || []),
        ];

        return {
            success: true,
            config: validatedConfig,
            message: switchResult.message,
            warnings: allWarnings.length > 0 ? allWarnings : undefined,
        };
    }

    // ============= MCP SERVER MANAGEMENT =============

    /**
     * Connects a new MCP server and adds it to the runtime configuration.
     * This method handles both adding the server to runtime state and establishing the connection.
     * @param name The name of the server to connect.
     * @param config The configuration object for the server.
     */
    public async connectMcpServer(name: string, config: McpServerConfig): Promise<void> {
        this.ensureStarted();
        try {
            // Add to runtime state first with validation
            const validation = this.stateManager.addMcpServer(name, config);

            if (!validation.isValid) {
                const errorMessages = validation.errors.map((e) => e.message).join(', ');
                throw new Error(`Invalid MCP server configuration: ${errorMessages}`);
            }

            // Then connect the server
            await this.clientManager.connectServer(name, config);

            this.agentEventBus.emit('saiki:mcpServerConnected', {
                name,
                success: true,
            });
            this.agentEventBus.emit('saiki:availableToolsUpdated', {
                tools: Object.keys(await this.clientManager.getAllTools()),
                source: 'mcp',
            });
            logger.info(`SaikiAgent: Successfully added and connected to MCP server '${name}'.`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`SaikiAgent: Failed to add MCP server '${name}': ${errorMessage}`);

            // Clean up state if connection failed
            this.stateManager.removeMcpServer(name);

            this.agentEventBus.emit('saiki:mcpServerConnected', {
                name,
                success: false,
                error: errorMessage,
            });
            throw error;
        }
    }

    /**
     * Removes and disconnects an MCP server.
     * @param name The name of the server to remove.
     */
    public async removeMcpServer(name: string): Promise<void> {
        this.ensureStarted();
        // Disconnect the client first
        await this.clientManager.removeClient(name);

        // Then remove from runtime state
        this.stateManager.removeMcpServer(name);
    }

    /**
     * Executes a tool on a connected MCP server.
     * Useful for users to experiment with tools directly.
     * @param toolName The name of the tool to execute
     * @param args The arguments to pass to the tool
     * @returns The result of the tool execution
     */
    public async executeMcpTool(toolName: string, args: any): Promise<any> {
        this.ensureStarted();
        return await this.clientManager.executeTool(toolName, args);
    }

    /**
     * Gets all available tools from all connected MCP servers.
     * Useful for users to discover what tools are available.
     * @returns Promise resolving to a map of tool names to tool definitions
     */
    public async getAllMcpTools(): Promise<any> {
        this.ensureStarted();
        return await this.clientManager.getAllTools();
    }

    /**
     * Gets all connected MCP clients.
     * Used by the API layer to inspect client status.
     * @returns Map of client names to client instances
     */
    public getMcpClients(): Map<string, IMCPClient> {
        this.ensureStarted();
        return this.clientManager.getClients();
    }

    /**
     * Gets all failed MCP connections.
     * Used by the API layer to report connection errors.
     * @returns Record of failed connection names to error messages
     */
    public getMcpFailedConnections(): Record<string, string> {
        this.ensureStarted();
        return this.clientManager.getFailedConnections();
    }

    // ============= CONFIGURATION ACCESS =============

    /**
     * Gets the effective configuration for a session or the default configuration.
     * @param sessionId Optional session ID. If not provided, returns default config.
     * @returns The effective configuration object
     */
    public getEffectiveConfig(sessionId?: string): Readonly<AgentConfig> {
        this.ensureStarted();
        return sessionId
            ? this.stateManager.getEffectiveConfig(sessionId)
            : this.stateManager.getEffectiveConfig();
    }

    // Future methods could encapsulate more complex agent behaviors:
    // - Multi-step task execution with progress tracking
    // - Memory and context management across sessions
    // - Tool chaining and workflow automation
    // - Agent collaboration and delegation
}

/**
 * Helper function to create a new SaikiAgent instance following the new sync/async pattern.
 * This creates the agent with the sync constructor and returns it (not started).
 * Call agent.start() to initialize async services before using the agent.
 *
 * @param config Agent configuration object
 * @param options Optional service initialization options
 * @returns SaikiAgent instance (not yet started)
 *
 * @example
 * ```typescript
 * // New pattern: Create agent, then start async services
 * const agent = createSaikiAgent(config, options);
 * await agent.start();
 *
 * // Use the agent...
 * const response = await agent.run("Hello!");
 *
 * // Clean shutdown when done
 * await agent.stop();
 *
 * // Or use constructor directly
 * const agent = new SaikiAgent(config, options);
 * await agent.start();
 * // ... use agent ...
 * await agent.stop();
 * ```
 */
export function createSaikiAgent(
    config: AgentConfig,
    options?: InitializeServicesOptions
): SaikiAgent {
    return new SaikiAgent(config, options);
}
