// src/ai/agent/SaikiAgent.ts
import { MCPClientManager } from '../../client/manager.js';
import { ILLMService } from '../llm/services/types.js';
import { PromptManager } from '../systemPrompt/manager.js';
import { MessageManager } from '../llm/messages/manager.js';
import { ConfigManager } from '../../config/manager.js';
import { EventEmitter } from 'events';
import { AgentServices } from '../../utils/service-initializer.js';
import { logger } from '../../logger/index.js';
import { McpServerConfig, LLMConfig } from '../../config/schemas.js';
import { createAgentServices } from '../../utils/service-initializer.js';
import { createLLMService } from '../llm/services/factory.js';
import { LLMRouter } from '../llm/types.js';
import type { AgentConfig } from '../../config/schemas.js';
import type { CLIConfigOverrides } from '../../config/types.js';
import type { InitializeServicesOptions } from '../../utils/service-initializer.js';

const requiredServices: (keyof AgentServices)[] = [
    'clientManager',
    'promptManager',
    'llmService',
    'agentEventBus',
    'messageManager',
    'configManager',
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
    public readonly llmService: ILLMService;
    public readonly agentEventBus: EventEmitter;
    public readonly messageManager: MessageManager;
    public readonly configManager: ConfigManager;

    constructor(services: AgentServices) {
        // Validate all required services are provided
        for (const service of requiredServices) {
            if (!services[service]) {
                throw new Error(`Required service ${service} is missing in SaikiAgent constructor`);
            }
        }

        this.clientManager = services.clientManager;
        this.promptManager = services.promptManager;
        this.llmService = services.llmService;
        this.agentEventBus = services.agentEventBus;
        this.messageManager = services.messageManager;
        this.configManager = services.configManager;

        logger.info('SaikiAgent initialized.');
    }

    /**
     * Processes a single turn of interaction with the user.
     * The core logic for this resides within the llmService.
     * @param userInput The input from the user.
     * @param imageDataInput Optional image data with MIME type for multimodal processing.
     * @returns The agent's response.
     */
    public async run(
        userInput: string,
        imageDataInput?: { image: string; mimeType: string }
    ): Promise<string | null> {
        try {
            const llmResponse = await this.llmService.completeTask(userInput, imageDataInput);

            // If llmResponse is an empty string, treat it as no significant response.
            if (llmResponse && llmResponse.trim() !== '') {
                return llmResponse;
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
     * Resets the conversation history.
     */
    public resetConversation(): void {
        try {
            this.llmService.resetConversation();
            logger.info('SaikiAgent conversation reset.');
            this.agentEventBus.emit('saiki:conversationReset');
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
            this.agentEventBus.emit('saiki:mcpServerConnected', { name, success: true });
            this.agentEventBus.emit('saiki:availableToolsUpdated');
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
     * Gets the current LLM configuration and status.
     * @returns Current LLM service configuration.
     */
    public getCurrentLLMConfig() {
        return {
            config: this.configManager.getConfig().llm,
            serviceInfo: this.llmService.getConfig(),
        };
    }

    /**
     * Switches the LLM service while preserving conversation history.
     * @param newLLMConfig The new LLM configuration.
     * @param router The LLM router to use ('vercel' or 'in-built').
     */
    public switchLLM(newLLMConfig: LLMConfig, router: LLMRouter = 'in-built'): void {
        try {
            // Create new LLM service with the same dependencies but new config
            const newLLMService = createLLMService(
                newLLMConfig,
                router,
                this.clientManager,
                this.agentEventBus,
                this.messageManager // This preserves the conversation history
            );

            // Replace the LLM service
            (this as any).llmService = newLLMService;

            // Update the agent's config
            this.configManager.getConfig().llm = newLLMConfig;

            logger.info(
                `SaikiAgent LLM switched to ${newLLMConfig.provider}/${newLLMConfig.model}`
            );
            this.agentEventBus.emit('saiki:llmSwitched', {
                newConfig: newLLMConfig,
                historyRetained: true,
            });
        } catch (error) {
            logger.error('Error during SaikiAgent.switchLLM:', error);
            throw error;
        }
    }

    /**
     * Loads a new configuration, preserving conversation history.
     * This is useful for switching between different agent configurations.
     * @param newConfig The new agent configuration to load.
     */
    public loadConfig(newConfig: AgentConfig): void {
        try {
            // Store current conversation state
            const currentMessages = this.messageManager.getHistory();

            // Load new config
            this.configManager.initFromConfig(newConfig);

            // Create new LLM service with the new config but preserve message history
            const newLLMService = createLLMService(
                newConfig.llm,
                newConfig.llm.router || 'in-built',
                this.clientManager,
                this.agentEventBus,
                this.messageManager // This preserves conversation history
            );

            // Replace the LLM service
            (this as any).llmService = newLLMService;

            logger.info('SaikiAgent configuration reloaded successfully');
            this.agentEventBus.emit('saiki:configReloaded', {
                newConfig,
                messagesRetained: currentMessages.length,
            });
        } catch (error) {
            logger.error('Error during SaikiAgent.loadConfig:', error);
            throw error;
        }
    }

    /**
     * Exports the current configuration with optional sanitization.
     * @param sanitize Whether to remove sensitive data like API keys.
     * @returns The current configuration object.
     */
    public exportConfig(sanitize: boolean = true): AgentConfig {
        try {
            const config = this.configManager.getConfig();

            if (!sanitize) {
                return config;
            }

            // Deep clone and sanitize
            const sanitizedConfig = JSON.parse(JSON.stringify(config));
            if (sanitizedConfig.llm && 'apiKey' in sanitizedConfig.llm) {
                sanitizedConfig.llm.apiKey = 'SET_YOUR_API_KEY_HERE';
            }

            // Remove any other sensitive fields from MCP servers
            if (sanitizedConfig.mcpServers) {
                for (const serverName in sanitizedConfig.mcpServers) {
                    const server = sanitizedConfig.mcpServers[serverName];
                    if (server.env) {
                        for (const envKey in server.env) {
                            if (
                                envKey.toLowerCase().includes('key') ||
                                envKey.toLowerCase().includes('token') ||
                                envKey.toLowerCase().includes('secret')
                            ) {
                                server.env[envKey] = 'SET_YOUR_' + envKey + '_HERE';
                            }
                        }
                    }
                }
            }

            return sanitizedConfig;
        } catch (error) {
            logger.error('Error during SaikiAgent.exportConfig:', error);
            throw error;
        }
    }

    /**
     * Gets configuration metadata including provenance and statistics.
     * @returns Configuration metadata and statistics.
     */
    public getConfigMetadata() {
        try {
            const config = this.configManager.getConfig();
            const provenance = this.configManager.getProvenance();
            const connectedServers = this.clientManager.getClients();
            const failedConnections = this.clientManager.getFailedConnections();

            return {
                provenance,
                statistics: {
                    mcpServersConfigured: Object.keys(config.mcpServers || {}).length,
                    mcpServersConnected: connectedServers.size,
                    mcpServersFailed: Object.keys(failedConnections).length,
                    llmProvider: config.llm?.provider,
                    llmModel: config.llm?.model,
                    conversationLength: this.messageManager.getHistory().length,
                },
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            logger.error('Error during SaikiAgent.getConfigMetadata:', error);
            throw error;
        }
    }

    // Future methods could encapsulate more complex agent behaviors:
    // - public async startInteractiveCliSession() { /* ... */ }
    // - public async executeHeadlessCommand(command: string) { /* ... */ }
    // - public async specializedTask(params: any) { /* ... */ }
}

/**
 * Method to create a SaikiAgent from agent config object
 * @param agentConfig The agent configuration object
 * @param cliArgs Optional CLI config overrides
 * @param overrides Optional service overrides
 * @returns Promise<SaikiAgent>
 */
export async function createSaikiAgent(
    agentConfig: AgentConfig,
    cliArgs?: CLIConfigOverrides,
    overrides?: InitializeServicesOptions
): Promise<SaikiAgent> {
    const services = await createAgentServices(agentConfig, cliArgs, overrides);

    // log model info for observability
    logger.info(
        `Agent using model config: ${JSON.stringify(services.llmService.getConfig(), null, 2)}`,
        null,
        'yellow'
    );
    return new SaikiAgent(services);
}
