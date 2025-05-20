import { createHistoryProvider } from '../llm/messages/history/factory.js';
import { createMessageManager } from '../llm/messages/factory.js';
import { createLLMService } from '../llm/services/factory.js';
import type { AgentServices } from '../../utils/service-initializer.js';
import type { MessageManager } from '../llm/messages/manager.js';
import type { ILLMService } from '../llm/services/types.js';
import type { SaikiAgent } from './SaikiAgent.js';
import { EventEmitter } from 'events';

export class ChatSession {
    public readonly eventBus: EventEmitter;
    private messageManager: MessageManager;
    private llmService: ILLMService;

    constructor(
        private agent: SaikiAgent,
        public readonly id: string
    ) {
        const services = agent.services;
        const config = services.configManager.getConfig();

        // Session-level event bus: use global for default session, or a new emitter with forwarding
        let sessionBus: EventEmitter;
        if (id === 'default') {
            sessionBus = services.agentEventBus;
        } else {
            sessionBus = new EventEmitter();
            const originalEmit: typeof sessionBus.emit = sessionBus.emit.bind(sessionBus);
            sessionBus.emit = ((eventName: string | symbol, ...args: any[]): boolean => {
                const result = originalEmit(eventName, ...args);
                if (typeof eventName === 'string') {
                    services.agentEventBus.emit(`session:${id}:${eventName}`, ...args);
                }
                return result;
            }) as typeof sessionBus.emit;
        }
        this.eventBus = sessionBus;

        if (id === 'default') {
            this.messageManager = services.messageManager;
            this.llmService = services.llmService;
        } else {
            const historyProvider = createHistoryProvider(config.storage.history);
            this.messageManager = createMessageManager(
                config.llm,
                config.llm.router,
                services.promptManager,
                services.agentEventBus,
                historyProvider,
                id
            );
            this.llmService = createLLMService(
                config.llm,
                config.llm.router,
                services.clientManager,
                sessionBus,
                this.messageManager
            );
        }
    }

    public async run(input: string): Promise<string> {
        const response = await this.llmService.completeTask(input);
        return response;
    }

    public getHistory() {
        return this.messageManager.getHistory();
    }

    public async reset(): Promise<void> {
        // Reset history via MessageManager
        this.messageManager.reset();
        // Notify listeners of conversation reset
        this.eventBus.emit('llmservice:conversationReset');
    }
}
