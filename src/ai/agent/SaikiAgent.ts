// src/ai/agent/SaikiAgent.ts
import { MCPClientManager } from '../../client/manager.js';
import { ILLMService } from '../llm/services/types.js';
import { PromptManager } from '../systemPrompt/manager.js';
import { MessageManager } from '../llm/messages/manager.js';
import { ConfigManager } from '../../config/manager.js';
import { EventEmitter } from 'events';
import { AgentServices } from '../../utils/service-initializer.js';
import { logger } from '../../utils/logger.js';

/**
 * The main entry point into Saiki's core.
 * It provides an abstraction layer on top of the internal services that saiki has.
 * You can use the SaikiAgent class in applications to build AI Agents.
 * By design, most of the methods in this class are thin wrappers around the internal services.
 */
export class SaikiAgent {
    public readonly clientManager: MCPClientManager;
    public readonly promptManager: PromptManager;
    public readonly llmService: ILLMService;
    public readonly agentEventBus: EventEmitter;
    public readonly messageManager: MessageManager;
    public readonly configManager: ConfigManager;

    constructor(services: AgentServices) {
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
     * @returns The agent's response.
     */
    public async run(
        userInput: string,
        imageDataInput?: { image: string; mimeType: string }
    ): Promise<string | null> {
        try {
            const llmResponse: string = await this.llmService.completeTask(
                userInput,
                imageDataInput
            );

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
            this.llmService.resetConversation(); // Assuming llmService has this method
            logger.info('SaikiAgent conversation reset.');
        } catch (error) {
            logger.error('Error during SaikiAgent.resetConversation:', error);
            // Re-throw the error to allow the caller to handle it.
            throw error;
        }
    }

    // Future methods could encapsulate more complex agent behaviors:
    // - public async startInteractiveCliSession() { /* ... */ }
    // - public async executeHeadlessCommand(command: string) { /* ... */ }
    // - public async specializedTask(params: any) { /* ... */ }
}
