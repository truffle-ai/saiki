// src/ai/agent/SaikiAgent.ts
import { MCPClientManager } from '../../client/manager.js';
import { ILLMService } from '../llm/services/types.js';
import { PromptManager } from '../systemPrompt/manager.js';
import { MessageManager } from '../llm/messages/manager.js';
import { ConfigManager } from '../../config/manager.js';
import { AgentServices } from '../../utils/service-initializer.js';
import { logger } from '../../logger/index.js';
import { McpServerConfig } from '../../config/schemas.js';
import { createAgentServices } from '../../utils/service-initializer.js';
import type { AgentConfig } from '../../config/schemas.js';
import type { CLIConfigOverrides } from '../../config/types.js';
import type { InitializeServicesOptions } from '../../utils/service-initializer.js';
import { randomUUID } from 'crypto';
import { ChatSession } from './ChatSession.js';
import { TypedEventEmitter } from '../../events/TypedEventEmitter.js';
import type { EventMap } from '../../events/EventMap.js';

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
    public readonly agentEventBus: TypedEventEmitter;
    public readonly messageManager: MessageManager;
    public readonly configManager: ConfigManager;
    public readonly services: AgentServices;
    private sessions: Record<string, ChatSession> = {};

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
        this.services = services;

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
            this.messageManager.reset();
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

    public startSession(sessionId?: string): ChatSession {
        const id = sessionId ?? randomUUID();
        if (this.sessions[id]) {
            return this.sessions[id];
        }
        const session = new ChatSession(this, id);
        this.sessions[id] = session;
        return session;
    }

    public listSessions(): string[] {
        return Object.keys(this.sessions);
    }

    public async endSession(sessionId: string): Promise<void> {
        const session = this.sessions[sessionId];
        if (session) {
            await session.reset();
            delete this.sessions[sessionId];
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
