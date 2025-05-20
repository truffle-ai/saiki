import { MessageManager } from './manager.js';
import { createMessageFormatter } from './formatters/factory.js';
import { createTokenizer } from '../tokenizer/factory.js';
import { LLMConfig } from '../../../config/schemas.js';
import { LLMRouter } from '../types.js';
import { PromptManager } from '../../systemPrompt/manager.js';
import { logger } from '../../../logger/index.js';
import { getEffectiveMaxTokens } from '../registry.js';
import { ConversationHistoryProvider } from './history/types.js';
import { TypedEventEmitter } from '../../../events/TypedEventEmitter.js';
import type { EventMap } from '../../../events/EventMap.js';
/**
 * Factory function to create a MessageManager instance with the correct formatter, tokenizer, and maxTokens
 * based on the LLM config and router
 *
 * @param config LLMConfig object containing provider, model, systemPrompt, etc.
 * @param router LLMRouter flag
 * @param promptManager PromptManager instance
 * @param historyProvider ConversationHistoryProvider instance
 * @param sessionId string
 * @returns MessageManager instance
 * TODO: Make compression strategy also configurable
 */
export function createMessageManager(
    config: LLMConfig,
    router: LLMRouter,
    promptManager: PromptManager,
    agentEventBus: TypedEventEmitter,
    historyProvider: ConversationHistoryProvider,
    sessionId: string
): MessageManager {
    const provider = config.provider.toLowerCase();
    const model = config.model.toLowerCase();

    const effectiveMaxTokens = getEffectiveMaxTokens(config);

    const tokenizer = createTokenizer(provider, model);
    logger.debug(`Tokenizer created for ${provider}/${model}`);

    const formatter = createMessageFormatter(provider, router);
    logger.debug(`Message formatter created for ${provider}/${model}`);

    logger.debug(
        `Creating MessageManager for ${provider}/${model} using ${router} router with maxTokens: ${effectiveMaxTokens}`
    );
    return new MessageManager(
        formatter,
        promptManager,
        agentEventBus,
        effectiveMaxTokens,
        tokenizer,
        historyProvider,
        sessionId
    );
}
