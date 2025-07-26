// src/ai/agent/SaikiAgent.ts
import { MCPManager } from '../../client/manager.js';
import { PromptManager } from '../systemPrompt/manager.js';
import { AgentStateManager } from '../../config/agent-state-manager.js';
import { SessionManager, SessionMetadata, ChatSession } from '../session/index.js';
import { AgentServices } from '../../utils/service-initializer.js';
import { logger } from '../../logger/index.js';
import { ValidatedLLMConfig, LLMConfig, McpServerConfig } from '../../config/schemas.js';
import {
    getSupportedProviders,
    getDefaultModelForProvider,
    getProviderFromModel,
    LLMProvider,
    LLM_REGISTRY,
    ModelInfo,
} from '../llm/registry.js';
import { createAgentServices } from '../../utils/service-initializer.js';
import type { AgentConfig } from '../../config/schemas.js';
import { AgentEventBus } from '../../events/index.js';
import { buildLLMConfig } from '../../config/validation-utils.js';
import type { IMCPClient } from '../../client/types.js';
import type { ToolSet } from '../types.js';
import { SearchService } from '../search/index.js';
import type { SearchOptions, SearchResponse, SessionSearchResponse } from '../search/index.js';
import { getSaikiPath } from '../../utils/path.js';
import { cleanupManager } from '../../lifecycle/cleanup.js';
const requiredServices: (keyof AgentServices)[] = [
    'mcpManager',
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
 * - **Prompt Management**: Build and inspect dynamic system prompts with context
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
 * // Switch LLM models (provider inferred automatically)
 * await agent.switchLLM({ model: 'gpt-4o' });
 *
 * // Manage sessions
 * const session = agent.createSession('user-123');
 * const response = await agent.run("Hello", undefined, 'user-123');
 *
 * // Connect MCP servers
 * await agent.connectMcpServer('filesystem', { command: 'mcp-filesystem' });
 *
 * // Inspect available tools and system prompt
 * const tools = await agent.getAllMcpTools();
 * const prompt = await agent.getSystemPrompt();
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
    public readonly mcpManager!: MCPManager;
    public readonly promptManager!: PromptManager;
    public readonly agentEventBus!: AgentEventBus;
    public readonly stateManager!: AgentStateManager;
    public readonly sessionManager!: SessionManager;
    public readonly services!: AgentServices;

    // Search service for conversation search
    private searchService!: SearchService;

    // Default session for backward compatibility
    private defaultSession: ChatSession | null = null;

    // Current default session ID for loadSession functionality
    private currentDefaultSessionId: string = 'default';

    // Track initialization state
    private _isStarted: boolean = false;
    private _isStopped: boolean = false;

    // Store config for async initialization
    private config: AgentConfig;

    constructor(
        config: AgentConfig,
        private configPath?: string
    ) {
        this.config = config;

        // call start() to initialize services
        logger.info('SaikiAgent created.');
    }

    /**
     * Starts the agent by initializing all async services.
     * This method handles storage backends, MCP connections, session manager initialization, and other async operations.
     * Must be called before using any agent functionality.
     *
     * @throws Error if agent is already started or initialization fails
     */
    public async start(): Promise<void> {
        if (this._isStarted) {
            throw new Error('Agent is already started');
        }

        try {
            logger.info('Starting SaikiAgent...');

            // Initialize all services asynchronously
            const services = await createAgentServices(this.config, this.configPath);

            // Validate all required services are provided
            for (const service of requiredServices) {
                if (!services[service]) {
                    throw new Error(`Required service ${service} is missing during agent start`);
                }
            }

            // Use Object.assign to set readonly properties
            Object.assign(this, {
                mcpManager: services.mcpManager,
                promptManager: services.promptManager,
                agentEventBus: services.agentEventBus,
                stateManager: services.stateManager,
                sessionManager: services.sessionManager,
                services: services,
            });

            // Initialize search service
            this.searchService = new SearchService(services.storage.database);

            this._isStarted = true;
            logger.info('SaikiAgent started successfully.');

            // Show log location for SDK users
            const logPath = getSaikiPath('logs', 'saiki.log');
            console.log(`📋 Logs available at: ${logPath}`);

            cleanupManager.addCleanupTask(async () => {
                logger.info('Stopping SaikiAgent...');
                await this.stop();
            });

            cleanupManager.addCleanupTask(async () => {
                logger.info('Closing database connections...');
                await this.services.storageManager?.disconnect();
            });
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
        if (this._isStopped) {
            logger.warn('Agent is already stopped');
            return;
        }

        if (!this._isStarted) {
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
                if (this.mcpManager) {
                    await this.mcpManager.disconnectAll();
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

            this._isStopped = true;
            this._isStarted = false;

            if (shutdownErrors.length > 0) {
                const errorMessages = shutdownErrors.map((e) => e.message).join('; ');
                logger.warn(`SaikiAgent stopped with some errors: ${errorMessages}`);
                // Still consider it stopped, but log the errors
            } else {
                logger.info('SaikiAgent stopped successfully.');
            }

            cleanupManager.removeCleanupTask(this.stop);
        } catch (error) {
            logger.error('Failed to stop SaikiAgent', error);
            throw error;
        }
    }

    /**
     * Checks if the agent has been started.
     * @returns true if agent is started, false otherwise
     */
    public isStarted(): boolean {
        return this._isStarted;
    }

    /**
     * Checks if the agent has been stopped.
     * @returns true if agent is stopped, false otherwise
     */
    public isStopped(): boolean {
        return this._isStopped;
    }

    /**
     * Ensures the agent is started before executing operations.
     * @throws Error if agent is not started or has been stopped
     */
    private ensureStarted(): void {
        if (this._isStopped) {
            throw new Error('Agent has been stopped and cannot be used');
        }
        if (!this._isStarted) {
            throw new Error('Agent must be started before use. Call agent.start() first.');
        }
    }

    // ============= CORE AGENT FUNCTIONALITY =============

    /**
     * Main method for processing user input.
     * Processes user input through the agent's LLM service and returns the response.
     *
     * @param textInput - The user's text message or query to process
     * @param imageDataInput - Optional image data and MIME type for multimodal input
     * @param fileDataInput - Optional file data and MIME type for file input
     * @param sessionId - Optional session ID for multi-session scenarios
     * @returns Promise that resolves to the AI's response text, or null if no significant response
     * @throws Error if processing fails
     */
    public async run(
        textInput: string,
        imageDataInput?: { image: string; mimeType: string },
        fileDataInput?: { data: string; mimeType: string; filename?: string },
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
                `SaikiAgent.run: textInput: ${textInput}, imageDataInput: ${imageDataInput}, fileDataInput: ${fileDataInput}, sessionId: ${sessionId || this.currentDefaultSessionId}`
            );
            const response = await session.run(textInput, imageDataInput, fileDataInput, stream);

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
     * Ends a session by removing it from memory without deleting conversation history.
     * Used for cleanup, agent shutdown, and session expiry.
     * @param sessionId The session ID to end
     */
    public async endSession(sessionId: string): Promise<void> {
        this.ensureStarted();
        // If ending the currently loaded default session, clear our reference
        if (sessionId === this.currentDefaultSessionId) {
            this.defaultSession = null;
        }
        return this.sessionManager.endSession(sessionId);
    }

    /**
     * Deletes a session and its conversation history permanently.
     * Used for user-initiated permanent deletion.
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
     * Search for messages across all sessions or within a specific session
     *
     * @param query The search query string
     * @param options Search options including session filter, role filter, and pagination
     * @returns Promise that resolves to search results
     */
    public async searchMessages(
        query: string,
        options: SearchOptions = {}
    ): Promise<SearchResponse> {
        this.ensureStarted();
        return await this.searchService.searchMessages(query, options);
    }

    /**
     * Search for sessions that contain the specified query
     *
     * @param query The search query string
     * @returns Promise that resolves to session search results
     */
    public async searchSessions(query: string): Promise<SessionSearchResponse> {
        this.ensureStarted();
        return await this.searchService.searchSessions(query);
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
     * Gets the current LLM configuration with all defaults applied.
     * @returns Current LLM configuration
     */
    public getCurrentLLMConfig(): LLMConfig {
        this.ensureStarted();
        return structuredClone(this.stateManager.getLLMConfig()) as LLMConfig;
    }

    /**
     * Switches the LLM service while preserving conversation history.
     * This is a comprehensive method that handles ALL validation, configuration building, and switching internally.
     *
     * Design:
     * - Input: Partial<LLMConfig> (allows optional fields like maxIterations?, router?)
     * - Output: LLMConfig (user-friendly type with all defaults applied)
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
                ? this.stateManager.getRuntimeConfig(sessionId).llm
                : this.stateManager.getRuntimeConfig().llm;

            // Build and validate the new configuration
            const result = await buildLLMConfig(llmUpdates, currentLLMConfig);

            if (!result.isValid) {
                // Return structured errors for UI consumption
                return {
                    success: false,
                    errors: result.errors.map((err) => ({
                        type: err.type as string,
                        message: err.message,
                        ...(err.provider && { provider: err.provider }),
                        ...(err.model && { model: err.model }),
                        ...(err.router && { router: err.router }),
                        ...((err.type === 'missing_api_key'
                            ? `Please set the ${err.provider?.toUpperCase()}_API_KEY environment variable or provide the API key directly.`
                            : err.suggestedAction) && {
                            suggestedAction:
                                err.type === 'missing_api_key'
                                    ? `Please set the ${err.provider?.toUpperCase()}_API_KEY environment variable or provide the API key directly.`
                                    : err.suggestedAction,
                        }),
                    })),
                    warnings: result.warnings,
                };
            }

            // Perform the actual LLM switch with validated config
            return await this.performLLMSwitch(result.config, sessionId, result.warnings);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Error switching LLM', {
                error: errorMessage,
                config: llmUpdates,
                sessionScope: sessionId,
            });
            return {
                success: false,
                errors: [
                    {
                        type: 'general',
                        message: errorMessage,
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
        validatedConfig: ValidatedLLMConfig,
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
                    type: err.type as string,
                    message: err.message,
                    ...(err.provider && { provider: err.provider }),
                    ...(err.model && { model: err.model }),
                    ...(err.router && { router: err.router }),
                    ...(err.suggestedAction && { suggestedAction: err.suggestedAction }),
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
            config: validatedConfig as LLMConfig,
            message: switchResult.message,
            ...(allWarnings.length > 0 && { warnings: allWarnings }),
        };
    }

    /**
     * Gets all supported LLM providers.
     * Returns a strongly-typed array of valid provider names that can be used with the agent.
     *
     * @returns Array of supported provider names
     *
     * @example
     * ```typescript
     * const providers = agent.getSupportedProviders();
     * console.log(providers); // ['openai', 'anthropic', 'google', 'groq']
     * ```
     */
    public getSupportedProviders(): LLMProvider[] {
        return getSupportedProviders() as LLMProvider[];
    }

    /**
     * Gets all supported models grouped by provider with detailed information.
     * Returns a strongly-typed object mapping each provider to its available models,
     * including model metadata such as token limits and default status.
     *
     * @returns Object mapping provider names to their model information
     *
     * @example
     * ```typescript
     * const models = agent.getSupportedModels();
     * console.log(models.openai); // Array of OpenAI models with metadata
     * console.log(models.anthropic[0].maxInputTokens); // Token limit for first Anthropic model
     *
     * // Check if a model is the default for its provider
     * const hasDefault = models.google.some(model => model.isDefault);
     * ```
     */
    public getSupportedModels(): Record<LLMProvider, Array<ModelInfo & { isDefault: boolean }>> {
        const result = {} as Record<LLMProvider, Array<ModelInfo & { isDefault: boolean }>>;

        const providers = getSupportedProviders() as LLMProvider[];
        for (const provider of providers) {
            const defaultModel = getDefaultModelForProvider(provider);
            const providerInfo = LLM_REGISTRY[provider];

            result[provider] = providerInfo.models.map((model) => ({
                ...model,
                isDefault: model.name === defaultModel,
            }));
        }

        return result;
    }

    /**
     * Gets supported models for a specific provider.
     * Returns model information including metadata for the specified provider only.
     *
     * @param provider The provider to get models for
     * @returns Array of model information for the specified provider
     * @throws Error if provider is not supported
     *
     * @example
     * ```typescript
     * try {
     *   const openaiModels = agent.getSupportedModelsForProvider('openai');
     *   const defaultModel = openaiModels.find(model => model.isDefault);
     *   console.log(`Default OpenAI model: ${defaultModel?.name}`);
     * } catch (error) {
     *   console.error('Unsupported provider');
     * }
     * ```
     */
    public getSupportedModelsForProvider(
        provider: LLMProvider
    ): Array<ModelInfo & { isDefault: boolean }> {
        const supportedProviders = getSupportedProviders() as LLMProvider[];
        if (!supportedProviders.includes(provider)) {
            throw new Error(
                `Unsupported provider: ${provider}. Supported providers: ${supportedProviders.join(', ')}`
            );
        }

        const defaultModel = getDefaultModelForProvider(provider);
        const providerInfo = LLM_REGISTRY[provider];

        return providerInfo.models.map((model) => ({
            ...model,
            isDefault: model.name === defaultModel,
        }));
    }

    /**
     * Infers the provider from a model name.
     * Searches through all supported providers to find which one supports the given model.
     *
     * @param modelName The model name to search for
     * @returns The provider name if found, null if the model is not supported
     *
     * @example
     * ```typescript
     * const provider = agent.inferProviderFromModel('gpt-4o');
     * console.log(provider); // 'openai'
     *
     * const provider2 = agent.inferProviderFromModel('claude-4-sonnet-20250514');
     * console.log(provider2); // 'anthropic'
     *
     * const provider3 = agent.inferProviderFromModel('unknown-model');
     * console.log(provider3); // null
     * ```
     */
    public inferProviderFromModel(modelName: string): LLMProvider | null {
        try {
            return getProviderFromModel(modelName) as LLMProvider;
        } catch {
            return null;
        }
    }

    // ============= MCP SERVER MANAGEMENT =============

    /**
     * Connects a new MCP server and adds it to the runtime configuration.
     * This method handles both adding the server to runtime state and establishing the connection.
     *
     * TODO: USER-FACING API DECISION NEEDED
     * Currently accepts McpServerConfig (input type with optional fields like timeout?, env?)
     * This is appropriate for user-facing API as users expect to provide minimal config.
     * Internal validation will apply defaults and convert to ValidatedMcpServerConfig.
     *
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
            await this.mcpManager.connectServer(name, config);

            this.agentEventBus.emit('saiki:mcpServerConnected', {
                name,
                success: true,
            });
            this.agentEventBus.emit('saiki:availableToolsUpdated', {
                tools: Object.keys(await this.mcpManager.getAllTools()),
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
        await this.mcpManager.removeClient(name);

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
        return await this.mcpManager.executeTool(toolName, args);
    }

    /**
     * Gets all available tools from all connected MCP servers.
     * Useful for users to discover what tools are available.
     * @returns Promise resolving to a map of tool names to tool definitions
     */
    public async getAllMcpTools(): Promise<ToolSet> {
        this.ensureStarted();
        return await this.mcpManager.getAllTools();
    }

    /**
     * Gets all connected MCP clients.
     * Used by the API layer to inspect client status.
     * @returns Map of client names to client instances
     */
    public getMcpClients(): Map<string, IMCPClient> {
        this.ensureStarted();
        return this.mcpManager.getClients();
    }

    /**
     * Gets all failed MCP connections.
     * Used by the API layer to report connection errors.
     * @returns Record of failed connection names to error messages
     */
    public getMcpFailedConnections(): Record<string, string> {
        this.ensureStarted();
        return this.mcpManager.getFailedConnections();
    }

    // ============= PROMPT MANAGEMENT =============

    /**
     * Gets the current system prompt with all dynamic content resolved.
     * This method builds the complete prompt by invoking all configured prompt contributors
     * (static content, dynamic placeholders, MCP resources, etc.) and returns the final
     * prompt string that will be sent to the LLM.
     *
     * Useful for debugging prompt issues, inspecting what context the AI receives,
     * and understanding how dynamic content is being incorporated.
     *
     * @returns Promise resolving to the complete system prompt string
     *
     * @example
     * ```typescript
     * // Get the current system prompt for inspection
     * const prompt = await agent.getSystemPrompt();
     * console.log('Current system prompt:', prompt);
     *
     * // Useful for debugging prompt-related issues
     * if (response.quality === 'poor') {
     *   const prompt = await agent.getSystemPrompt();
     *   console.log('Check if prompt includes expected context:', prompt);
     * }
     * ```
     */
    public async getSystemPrompt(): Promise<string> {
        this.ensureStarted();
        const context = {
            mcpManager: this.mcpManager,
        };
        return await this.promptManager.build(context);
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
            ? this.stateManager.getRuntimeConfig(sessionId)
            : this.stateManager.getRuntimeConfig();
    }

    // Future methods could encapsulate more complex agent behaviors:
    // - Multi-step task execution with progress tracking
    // - Memory and context management across sessions
    // - Tool chaining and workflow automation
    // - Agent collaboration and delegation
}
