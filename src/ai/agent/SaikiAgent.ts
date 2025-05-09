// src/ai/agent/SaikiAgent.ts
import { MCPClientManager } from '../../client/manager.js';
import { ILLMService } from '../llm/services/types.js';
import { PromptManager } from '../systemPrompt/manager.js';
import { MessageManager } from '../llm/messages/manager.js';
import { ConfigManager } from '../../config/manager.js';
import { EventEmitter } from 'events';
import { AgentServices } from '../../utils/service-initializer.js';
import { logger } from '../../utils/logger.js';

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
     * This is a simplified example; the actual implementation would be more complex,
     * handling tool calls, streaming, and more elaborate state.
     * The core logic for this typically resides within the llmService.
     * @param userInput The input from the user.
     * @returns The agent's response.
     */
    public async processUserTurn(
        userInput: string,
        imageDataInput?: { image: string; mimeType: string }
    ): Promise<string | null> {
        try {
            // The llmService.completeTask (or a similar method) is expected to:
            // 1. Manage message history (possibly via MessageManager).
            // 2. Interact with the LLM.
            // 3. Handle tool calls (via ClientManager).
            // 4. Utilize system prompts (via PromptManager).
            // According to ILLMService, completeTask returns Promise<string>
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
            logger.error('Error during SaikiAgent.processUserTurn:', error);
            // Re-throw the error to allow the caller to handle it.
            throw error;
        }
    }

    /**
     * Resets the conversation history.
     * This typically involves calling a method on the llmService or messageManager.
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
