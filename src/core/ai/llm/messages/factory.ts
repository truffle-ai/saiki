import { MessageManager } from './manager.js';
import { PromptManager } from '../../systemPrompt/manager.js';
import { IConversationHistoryProvider } from './history/types.js';
import { LLMConfig } from '../../../config/schemas.js';
import { LLMRouter } from '../types.js';
import { createMessageFormatter } from './formatters/factory.js';
import { createTokenizer } from '../tokenizer/factory.js';
import { getEffectiveMaxTokens } from '../registry.js';
import { getMaxTokensForModel } from '../registry.js';
import { SessionEventBus } from '../../../events/index.js';
import { logger } from '../../../logger/index.js';

/**
 * Factory function to create a MessageManager instance with the correct formatter, tokenizer, and maxTokens
 * based on the LLM config and router
 *
 * @param config LLMConfig object containing provider, model, systemPrompt, etc.
 * @param router LLMRouter flag
 * @param promptManager PromptManager instance
 * @param sessionEventBus Session-level event bus for message-related events
 * @param historyProvider ConversationHistoryProvider instance
 * @param sessionId string
 * @returns MessageManager instance
 * TODO: Make compression strategy also configurable
 */
export function createMessageManager(
    config: LLMConfig,
    router: LLMRouter,
    promptManager: PromptManager,
    sessionEventBus: SessionEventBus,
    historyProvider: IConversationHistoryProvider,
    sessionId: string
): MessageManager {
    const provider = config.provider.toLowerCase();
    const model = config.model.toLowerCase();

    const tokenizer = createTokenizer(provider, model);
    logger.debug(`Tokenizer created for ${provider}/${model}`);

    const formatter = createMessageFormatter(provider, router);
    const effectiveMaxTokens = getEffectiveMaxTokens(config);
    logger.debug(
        `Creating MessageManager for ${provider}/${model} using ${router} router with maxTokens: ${effectiveMaxTokens}`
    );
    return new MessageManager(
        formatter,
        promptManager,
        sessionEventBus,
        effectiveMaxTokens,
        tokenizer,
        historyProvider,
        sessionId
    );
}
