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
import { createLLMService } from '../llm/services/factory.js';
import { LLMRouter } from '../llm/types.js';
import type { AgentConfig } from '../../config/schemas.js';
import type { CLIConfigOverrides } from '../../config/types.js';
import type { InitializeServicesOptions } from '../../utils/service-initializer.js';
import { AgentEventBus } from '../../events/index.js';
import type { ILLMService } from '../llm/services/types.js';
import type { MessageManager } from '../llm/messages/manager.js';
import { LLMConfigSchema } from '../../config/schemas.js';
import { buildValidatedLLMConfig } from '../../config/validation-utils.js';

const requiredServices: (keyof AgentServices)[] = [
    'clientManager',
    'promptManager',
    'agentEventBus',
    'configManager',
    'sessionManager',
];

/**
 * The main entry point into Saiki's core.
 * SaikiAgent is an abstraction layer on top of the internal services that saiki has.
 * You can use the SaikiAgent class in applications to build AI Agents.
 * By design, most of the methods in this class are thin wrappers around the internal services, exposing functionality that we might want to use in applications.
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
    public readonly configManager: StaticConfigManager;
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
        this.configManager = services.configManager;
        this.stateManager = services.stateManager;
        this.sessionManager = services.sessionManager;
        this.services = services;

        logger.info('SaikiAgent initialized.');
    }

    /**
     * Gets the LLM service instance from the default session.
     * For backward compatibility with the LLM switching feature.
     * @returns The current LLM service from the default session.
     */
    public getLLMService(): ILLMService {
        if (!this.defaultSession) {
            this.defaultSession = this.sessionManager.createSession('default');
        }
        return this.defaultSession.getLLMService();
    }

    /**
     * Gets the MessageManager instance from the default session.
     * For backward compatibility with the LLM switching feature.
     * @returns The MessageManager from the default session.
     */
    public getMessageManager(): MessageManager {
        if (!this.defaultSession) {
            this.defaultSession = this.sessionManager.createSession('default');
        }
        return this.defaultSession.getMessageManager();
    }

    /**
     * Processes a single turn of interaction with the user.
     * For backward compatibility, this creates/uses a default session.
     * @param userInput The input from the user.
     * @param imageDataInput Optional image data with MIME type for multimodal processing.
     * @returns The agent's response.
     */
    public async run(
        userInput: string,
        imageDataInput?: { image: string; mimeType: string }
    ): Promise<string | null> {
        try {
            // Ensure we have a default session for backward compatibility
            if (!this.defaultSession) {
                this.defaultSession = this.sessionManager.createSession('default');
                logger.debug(`SaikiAgent.run: created default session ${this.defaultSession.id}`);
            }

            logger.debug(
                `SaikiAgent.run: userInput: ${userInput} and imageDataInput: ${imageDataInput}`
            );
            const response = await this.defaultSession.run(userInput, imageDataInput);

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

    /**
     * Resets the conversation history for the default session.
     * For backward compatibility.
     */
    public async resetConversation(): Promise<void> {
        try {
            if (!this.defaultSession) {
                this.defaultSession = this.sessionManager.createSession('default');
            }

            await this.defaultSession.reset();
            logger.info('SaikiAgent conversation reset.');
            this.agentEventBus.emit('saiki:conversationReset', {
                sessionId: this.defaultSession.id,
            });
        } catch (error) {
            logger.error('Error during SaikiAgent.resetConversation:', error);
            // Re-throw the error to allow the caller to handle it.
            throw error;
        }
    }

    /**
     * Connects a new MCP server dynamically.
     * @param name The name of the server to connect.
     * @param config The configuration object for the server.
     */
    public async connectMcpServer(name: string, config: McpServerConfig): Promise<void> {
        try {
            await this.clientManager.connectServer(name, config);
            this.agentEventBus.emit('saiki:mcpServerConnected', {
                name,
                success: true,
            });
            this.agentEventBus.emit('saiki:availableToolsUpdated', {
                tools: Object.keys(await this.clientManager.getAllTools()),
                source: 'mcp',
            });
            logger.info(`SaikiAgent: Successfully connected to MCP server '${name}'.`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`SaikiAgent: Failed to connect to MCP server '${name}': ${errorMessage}`);
            this.agentEventBus.emit('saiki:mcpServerConnected', {
                name,
                success: false,
                error: errorMessage,
            });
            throw error;
        }
    }

    /**
     * Creates a new chat session or returns an existing one.
     * @param sessionId Optional session ID. If not provided, a UUID will be generated.
     * @returns The created or existing ChatSession
     */
    public createSession(sessionId?: string): ChatSession {
        return this.sessionManager.createSession(sessionId);
    }

    /**
     * Retrieves an existing session by ID.
     * @param sessionId The session ID to retrieve
     * @returns The ChatSession if found, undefined otherwise
     */
    public getSession(sessionId: string): ChatSession | undefined {
        return this.sessionManager.getSession(sessionId);
    }

    /**
     * Lists all active session IDs.
     * @returns Array of session IDs
     */
    public listSessions(): string[] {
        return this.sessionManager.listSessions();
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
     * @returns Session metadata if found, undefined otherwise
     */
    public getSessionMetadata(sessionId: string): SessionMetadata | undefined {
        return this.sessionManager.getSessionMetadata(sessionId);
    }

    /**
     * Gets the current LLM configuration.
     *
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
        success: true;
        config: LLMConfig;
        message: string;
        warnings?: string[];
    }> {
        try {
            if (!llmUpdates.model && !llmUpdates.provider) {
                throw new Error('At least model or provider must be specified');
            }

            // Get current config for merging
            const currentConfig = sessionId
                ? this.stateManager.getEffectiveState(sessionId).llm
                : this.stateManager.getRuntimeState().llm;

            // Build and validate LLM configuration using utility function
            const { config: newLLMConfig, configWarnings } = await buildValidatedLLMConfig(
                llmUpdates,
                currentConfig,
                this.stateManager,
                sessionId
            );

            // Perform the actual switch based on session scope
            const { message, warnings: sessionWarnings } = await this.performLLMSwitch(
                newLLMConfig,
                sessionId
            );

            // Collect all warnings
            const allWarnings = this.collectWarnings(configWarnings, sessionWarnings);

            return {
                success: true,
                config: newLLMConfig,
                message,
                warnings: allWarnings.length > 0 ? allWarnings : undefined,
            };
        } catch (error: any) {
            logger.error('Failed to switch LLM:', error.message);
            throw error;
        }
    }

    /**
     * Perform the actual LLM switch based on session scope
     */
    private async performLLMSwitch(
        newLLMConfig: LLMConfig,
        sessionId?: string
    ): Promise<{ message: string; warnings: string[] }> {
        if (sessionId === '*') {
            return this.sessionManager.switchLLMForAllSessions(newLLMConfig);
        } else if (sessionId) {
            return this.sessionManager.switchLLMForSpecificSession(newLLMConfig, sessionId);
        } else {
            return this.sessionManager.switchLLMForDefaultSession(newLLMConfig);
        }
    }

    /**
     * Collect and deduplicate warnings from different sources
     */
    private collectWarnings(...warningArrays: string[][]): string[] {
        const allWarnings = warningArrays.flat().filter(Boolean);
        return Array.from(new Set(allWarnings)); // Deduplicate
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
    return new SaikiAgent(services);
}
