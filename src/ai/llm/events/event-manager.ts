import { ILLMService, AgentSubscriber } from '../types.js';
import { logger } from '../../../utils/logger.js';
/**
 * Manages event subscriptions and distribution for the LLM service
 */
export class AgentEventManager {
    private subscribers: AgentSubscriber[] = [];
    private llmService: ILLMService;

    constructor(llmService: ILLMService) {
        this.llmService = llmService;
        this.setupEventListeners();
    }

    /**
     * Register a new subscriber to receive agent events
     */
    registerSubscriber(subscriber: AgentSubscriber): void {
        this.subscribers.push(subscriber);
    }

    /**
     * Remove a subscriber from receiving agent events
     */
    removeSubscriber(subscriber: AgentSubscriber): void {
        const index = this.subscribers.indexOf(subscriber);
        if (index !== -1) {
            this.subscribers.splice(index, 1);
        }
    }

    /**
     * Set up event listeners on the LLM service's event emitter
     */
    private setupEventListeners(): void {
        logger.debug('Setting up event listeners...');
        const emitter = this.llmService.getEventEmitter();

        emitter.on('thinking', () => {
            this.subscribers.forEach((sub) => sub.onThinking?.());
        });

        emitter.on('chunk', (text: string) => {
            this.subscribers.forEach((sub) => sub.onChunk?.(text));
        });

        emitter.on('toolCall', (toolName: string, args: any) => {
            this.subscribers.forEach((sub) => sub.onToolCall?.(toolName, args));
        });

        emitter.on('toolResult', (toolName: string, result: any) => {
            this.subscribers.forEach((sub) => sub.onToolResult?.(toolName, result));
        });

        emitter.on('response', (text: string) => {
            this.subscribers.forEach((sub) => sub.onResponse?.(text));
        });

        emitter.on('error', (error: Error) => {
            this.subscribers.forEach((sub) => sub.onError?.(error));
        });

        emitter.on('conversationReset', () => {
            this.subscribers.forEach((sub) => sub.onConversationReset?.());
        });
    }
}
