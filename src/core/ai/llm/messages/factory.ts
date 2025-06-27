import { ContextManager } from './manager.js';
import { PromptManager } from '../../systemPrompt/manager.js';
import { IConversationHistoryProvider } from './history/types.js';
import { ValidatedLLMConfig } from '../../../config/schemas.js';
import { LLMRouter } from '../types.js';
import { createMessageFormatter } from './formatters/factory.js';
import { createTokenizer } from '../tokenizer/factory.js';
import { getEffectiveMaxInputTokens } from '../registry.js';
import { SessionEventBus } from '../../../events/index.js';
import { logger } from '../../../logger/index.js';

/**
 * Factory function to create a ContextManager instance with the correct formatter, tokenizer, and maxInputTokens
 * based on the LLM config and router
 *
 * @param config LLMConfig object containing provider, model, systemPrompt, etc.
 * @param router LLMRouter flag
 * @param promptManager PromptManager instance
 * @param sessionEventBus Session-level event bus for message-related events
 * @param historyProvider ConversationHistoryProvider instance
 * @param sessionId string
 * @returns ContextManager instance
 * TODO: Make compression strategy also configurable
 */
export function createContextManager(
    config: ValidatedLLMConfig,
    router: LLMRouter,
    promptManager: PromptManager,
    sessionEventBus: SessionEventBus,
    historyProvider: IConversationHistoryProvider,
    sessionId: string
): ContextManager {
    const provider = config.provider.toLowerCase();
    const model = config.model.toLowerCase();

    const tokenizer = createTokenizer(provider, model);
    logger.debug(`Tokenizer created for ${provider}/${model}`);

    const formatter = createMessageFormatter(provider, router);
    const effectiveMaxInputTokens = getEffectiveMaxInputTokens(config);
    logger.debug(
        `Creating ContextManager for ${provider}/${model} using ${router} router with maxInputTokens: ${effectiveMaxInputTokens}`
    );
    return new ContextManager(
        formatter,
        promptManager,
        sessionEventBus,
        effectiveMaxInputTokens,
        tokenizer,
        historyProvider,
        sessionId
    );
}
