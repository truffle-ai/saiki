import { createHistoryProvider } from '../llm/messages/history/factory.js';
import { createMessageManager } from '../llm/messages/factory.js';
import { createLLMService } from '../llm/services/factory.js';
import type { AgentServices } from '../../utils/service-initializer.js';
import type { MessageManager } from '../llm/messages/manager.js';
import type { ILLMService } from '../llm/services/types.js';
import type { SaikiAgent } from './SaikiAgent.js';
import { TypedEventEmitter, EventMap } from '../../events/index.js';

export class ChatSession {
    public readonly eventBus: TypedEventEmitter;
    private messageManager: MessageManager;
    private llmService: ILLMService;

    constructor(
        private agent: SaikiAgent,
        public readonly id: string
    ) {
        const services = agent.services;
        const config = services.configManager.getConfig();

        // Session-level event bus: use global for default session, or a new emitter with forwarding
        let sessionBus: TypedEventEmitter;
        if (id === 'default') {
            sessionBus = services.agentEventBus;
        } else {
            // Create a new session-local bus
            sessionBus = new TypedEventEmitter();
            // No forwarding: use local TypedEventEmitter only
            // TODO: Wrap emit to forward namespaced session events and also application code
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
        this.messageManager.resetConversation();
        // Notify listeners of conversation reset
        this.eventBus.emit('messageManager:conversationReset');
    }
}
