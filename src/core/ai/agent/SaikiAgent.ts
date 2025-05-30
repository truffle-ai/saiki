// src/ai/agent/SaikiAgent.ts
import { MCPClientManager } from '../../client/manager.js';
import { PromptManager } from '../systemPrompt/manager.js';
import { StaticConfigManager } from '../../config/static-config-manager.js';
import { AgentStateManager } from '../../config/agent-state-manager.js';
import { SessionManager, SessionMetadata, ChatSession } from '../session/index.js';
import { AgentServices } from '../../utils/service-initializer.js';
import { logger } from '../../logger/index.js';
import { McpServerConfig, LLMConfig } from '../../config/schemas.js';
import { createAgentServices } from '../../utils/service-initializer.js';
import type { AgentConfig } from '../../config/schemas.js';
import type { CLIConfigOverrides } from '../../config/types.js';
import type { InitializeServicesOptions } from '../../utils/service-initializer.js';
import { AgentEventBus } from '../../events/index.js';
import { LLMConfigSchema } from '../../config/schemas.js';
import { buildLLMConfig, type ValidationError } from '../../config/validation-utils.js';

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
 * // Create agent
 * const agent = await createSaikiAgent(config);
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
 * ```
 */
export class SaikiAgent {
    /**
     * These services are public for use by the outside world
     * This gives users the option to use methods of the services directly if they know what they are doing
     * But the main recommended entry points/functions would still be the wrapper methods we define below
     */
    public readonly clientManager: MCPClientManager;
    public readonly promptManager: PromptManager;
    public readonly agentEventBus: AgentEventBus;
    public readonly stateManager: AgentStateManager;
    public readonly sessionManager: SessionManager;
    public readonly services: AgentServices;

    // Default session for backward compatibility
    private defaultSession: ChatSession | null = null;

    constructor(services: AgentServices) {
        // Validate all required services are provided
        for (const service of requiredServices) {
            if (!services[service]) {
                throw new Error(`Required service ${service} is missing in SaikiAgent constructor`);
            }
        }

        this.clientManager = services.clientManager;
        this.promptManager = services.promptManager;
        this.agentEventBus = services.agentEventBus;
        this.stateManager = services.stateManager;
        this.sessionManager = services.sessionManager;
        this.services = services;

        logger.info('SaikiAgent initialized.');
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
        sessionId?: string
    ): Promise<string | null> {
        try {
            let session: ChatSession;

            if (sessionId) {
                // Use specific session or create it if it doesn't exist
                session =
                    (await this.sessionManager.getSession(sessionId)) ||
                    (await this.sessionManager.createSession(sessionId));
            } else {
                // Use default session for backward compatibility
                if (!this.defaultSession) {
                    this.defaultSession = await this.sessionManager.createSession('default');
                    logger.debug(
                        `SaikiAgent.run: created default session ${this.defaultSession.id}`
                    );
                }
                session = this.defaultSession;
            }

            logger.debug(
                `SaikiAgent.run: userInput: ${userInput}, imageDataInput: ${imageDataInput}, sessionId: ${sessionId || 'default'}`
            );
            const response = await session.run(userInput, imageDataInput);

            // Increment message count for this session (counts each)
            await this.sessionManager.incrementMessageCount(session.id);

            // If response is an empty string, treat it as no significant response.
            if (response && response.trim() !== '') {
                return response;
            }
            // Return null if the response is empty or just whitespace.
            return null;
        } catch (error) {
            logger.error('Error during SaikiAgent.run:', error);
            // Re-throw the error to allow the caller to handle it.
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
        return await this.sessionManager.createSession(sessionId);
    }

    /**
     * Retrieves an existing session by ID.
     * @param sessionId The session ID to retrieve
     * @returns The ChatSession if found, undefined otherwise
     */
    public async getSession(sessionId: string): Promise<ChatSession | undefined> {
        return await this.sessionManager.getSession(sessionId);
    }

    /**
     * Lists all active session IDs.
     * @returns Array of session IDs
     */
    public async listSessions(): Promise<string[]> {
        return await this.sessionManager.listSessions();
    }

    /**
     * Ends a session and cleans up its resources.
     * @param sessionId The session ID to end
     */
    public async endSession(sessionId: string): Promise<void> {
        // If ending the default session, clear our reference
        if (sessionId === 'default') {
            this.defaultSession = null;
        }
        return this.sessionManager.endSession(sessionId);
    }

    /**
     * Gets metadata for a specific session.
     * @param sessionId The session ID
     * @returns The session metadata or undefined if session doesn't exist
     */
    public async getSessionMetadata(sessionId: string): Promise<SessionMetadata | undefined> {
        return await this.sessionManager.getSessionMetadata(sessionId);
    }

    /**
     * Gets the conversation history for a specific session.
     * @param sessionId The session ID
     * @returns Promise that resolves to the session's conversation history
     * @throws Error if session doesn't exist
     */
    public async getSessionHistory(sessionId: string) {
        const session = await this.sessionManager.getSession(sessionId);
        if (!session) {
            throw new Error(`Session '${sessionId}' not found`);
        }
        return await session.getHistory();
    }

    /**
     * Deletes the conversation history for a specific session or the default session.
     * Keeps the session alive but the conversation history is deleted
     * @param sessionId Optional session ID. If not provided, resets the default session.
     */
    public async resetConversation(sessionId?: string): Promise<void> {
        try {
            let session: ChatSession;

            if (sessionId) {
                session = await this.sessionManager.getSession(sessionId);
                if (!session) {
                    throw new Error(`Session '${sessionId}' not found`);
                }
            } else {
                // Use default session for backward compatibility
                if (!this.defaultSession) {
                    this.defaultSession = await this.sessionManager.createSession('default');
                }
                session = this.defaultSession;
            }

            await session.reset();
            logger.info(`SaikiAgent conversation reset for session: ${sessionId || 'default'}`);
            this.agentEventBus.emit('saiki:conversationReset', {
                sessionId: session.id,
            });
        } catch (error) {
            logger.error('Error during SaikiAgent.resetConversation:', error);
            // Re-throw the error to allow the caller to handle it.
            throw error;
        }
    }

    // ============= LLM MANAGEMENT =============

    /**
     * Gets the current LLM configuration.
     * @returns Current LLM configuration
     */
    public getCurrentLLMConfig(): LLMConfig {
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
        return await this.clientManager.executeTool(toolName, args);
    }

    /**
     * Gets all available tools from all connected MCP servers.
     * Useful for users to discover what tools are available.
     * @returns Promise resolving to a map of tool names to tool definitions
     */
    public async getAllMcpTools(): Promise<any> {
        return await this.clientManager.getAllTools();
    }

    /**
     * Gets all connected MCP clients.
     * Used by the API layer to inspect client status.
     * @returns Map of client names to client instances
     */
    public getMcpClients(): Map<string, any> {
        return this.clientManager.getClients();
    }

    /**
     * Gets all failed MCP connections.
     * Used by the API layer to report connection errors.
     * @returns Record of failed connection names to error messages
     */
    public getMcpFailedConnections(): Record<string, string> {
        return this.clientManager.getFailedConnections();
    }

    // ============= CONFIGURATION ACCESS =============

    /**
     * Gets the effective configuration for a session or the default configuration.
     * @param sessionId Optional session ID. If not provided, returns default config.
     * @returns The effective configuration object
     */
    public getEffectiveConfig(sessionId?: string): Readonly<AgentConfig> {
        return sessionId
            ? this.stateManager.getEffectiveConfig(sessionId)
            : this.stateManager.getEffectiveConfig();
    }

    // Future methods could encapsulate more complex agent behaviors:
    // - public async startInteractiveCliSession() { /* ... */ }
    // - public async executeHeadlessCommand(command: string) { /* ... */ }
    // - public async specializedTask(params: any) { /* ... */ }
}

/**
 * Factory function to create a SaikiAgent with all necessary services initialized.
 * This is the recommended way to create a SaikiAgent instance.
 * @param agentConfig The agent configuration
 * @param cliArgs Optional CLI argument overrides
 * @param overrides Optional service overrides for testing
 * @returns A fully initialized SaikiAgent
 */
export async function createSaikiAgent(
    agentConfig: AgentConfig,
    cliArgs?: CLIConfigOverrides,
    overrides?: InitializeServicesOptions
): Promise<SaikiAgent> {
    const services = await createAgentServices(agentConfig, cliArgs, overrides);

    // log model info for observability
    logger.info(
        `Agent using model config: ${JSON.stringify(services.stateManager.getRuntimeState().llm, null, 2)}`,
        null,
        'yellow'
    );

    return new SaikiAgent(services);
}
