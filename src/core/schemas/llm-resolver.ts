// TODO: move this to llm folder
import { Result, Issue, hasErrors, splitIssues } from './helpers.js';
import { ok, fail } from './helpers.js';
import { zodToIssues } from './zod-bridge.js';
import { SaikiErrorCode } from './errors.js';

import {
    LLMConfigSchema,
    type ValidatedLLMConfig,
    type LLMUpdates,
    type LLMConfigInput,
} from './llm.js';
import {
    getProviderFromModel,
    getSupportedRoutersForProvider,
    isRouterSupportedForProvider,
    getDefaultModelForProvider,
    getEffectiveMaxInputTokens,
    acceptsAnyModel,
    isValidProviderModel,
} from '../llm/registry.js';
import type { LLMUpdateContext } from '../llm/types.js';
import { resolveApiKeyForProvider } from '@core/utils/api-key-resolver.js';

/**
 * Convenience function that combines resolveLLM and validateLLM
 */
export function resolveAndValidateLLM(
    previous: ValidatedLLMConfig,
    updates: LLMUpdates
): Result<ValidatedLLMConfig, LLMUpdateContext> {
    const { candidate, warnings } = resolveLLMConfig(previous, updates);

    // If resolver produced any errors, fail immediately (don’t try to validate a broken candidate)
    if (hasErrors(warnings)) {
        const { errors } = splitIssues(warnings);
        return fail<ValidatedLLMConfig, LLMUpdateContext>(errors);
    }
    const result = validateLLMConfig(candidate, warnings);
    return result;
}

/**
 * Infers the LLM config from the provided updates
 * @param previous - The previous LLM config
 * @param updates - The updates to the LLM config
 * @returns The resolved LLM config
 */
export function resolveLLMConfig(
    previous: ValidatedLLMConfig,
    updates: LLMUpdates
): { candidate: LLMConfigInput; warnings: Issue<LLMUpdateContext>[] } {
    const warnings: Issue<LLMUpdateContext>[] = [];

    // Provider inference (if not provided, infer from model or previous provider)
    const provider =
        updates.provider ??
        (updates.model
            ? (() => {
                  try {
                      return getProviderFromModel(updates.model);
                  } catch {
                      return previous.provider;
                  }
              })()
            : previous.provider);

    // API key resolution
    // (if not provided, previous API key if provider is the same)
    // (if not provided, and provider is different, throw error)
    const envKey = resolveApiKeyForProvider(provider);
    const apiKey =
        updates.apiKey ?? (provider !== previous.provider ? envKey : previous.apiKey) ?? '';
    if (!apiKey) {
        warnings.push({
            code: SaikiErrorCode.MISSING_API_KEY_CANDIDATE,
            message: 'API key not provided or found in environment',
            severity: 'warning',
            context: { provider },
        });
    } else if (typeof apiKey === 'string' && apiKey.length < 10) {
        warnings.push({
            code: SaikiErrorCode.SHORT_API_KEY,
            message: 'API key looks unusually short',
            severity: 'warning',
            context: { provider },
        });
    }

    // Router fallback
    // if new provider doesn't support the previous router, use the first supported router
    // if no supported routers, throw error
    let router = updates.router;
    if (!router) {
        // if new provider is different from previous provider, and previous router is not supported
        if (
            provider !== previous.provider &&
            !isRouterSupportedForProvider(provider, previous.router)
        ) {
            const supported = getSupportedRoutersForProvider(provider);
            // if no routers supported, throw error
            if (supported.length === 0) {
                warnings.push({
                    code: SaikiErrorCode.UNSUPPORTED_ROUTER,
                    message: `No routers supported for provider '${provider}'`,
                    severity: 'error',
                    context: { provider, router },
                });
                // if routers supported, use the first supported router
            } else {
                router = supported.includes('vercel') ? 'vercel' : supported[0]!;
                warnings.push({
                    code: SaikiErrorCode.UNSUPPORTED_ROUTER,
                    message: `Router changed to '${router}' for provider '${provider}'`,
                    severity: 'warning',
                    context: { provider, router },
                });
            }
        } else {
            router = previous.router;
        }
    }

    // Model fallback
    // if new provider doesn't support the previous model, use the default model
    let model = updates.model ?? previous.model;
    if (
        provider !== previous.provider &&
        !acceptsAnyModel(provider) &&
        !isValidProviderModel(provider, previous.model)
    ) {
        model = getDefaultModelForProvider(provider) ?? previous.model;
        warnings.push({
            code: SaikiErrorCode.INCOMPATIBLE_MODEL_PROVIDER,
            message: `Model set to default '${model}' for provider '${provider}'`,
            severity: 'warning',
            context: { provider, model },
        });
    }

    // Token defaults
    const maxInputTokens =
        updates.maxInputTokens ??
        previous.maxInputTokens ??
        getEffectiveMaxInputTokens({ provider, model, apiKey: apiKey || previous.apiKey });

    return {
        candidate: {
            provider,
            model,
            apiKey,
            router,
            baseURL: updates.baseURL ?? previous.baseURL,
            maxIterations: updates.maxIterations ?? previous.maxIterations,
            maxInputTokens,
            maxOutputTokens: updates.maxOutputTokens ?? previous.maxOutputTokens,
            temperature: updates.temperature ?? previous.temperature,
        },
        warnings,
    };
}

export function validateLLMConfig(
    candidate: LLMConfigInput,
    warnings: Issue<LLMUpdateContext>[]
): Result<ValidatedLLMConfig, LLMUpdateContext> {
    // Final validation (business rules + shape)
    const parsed = LLMConfigSchema.safeParse(candidate);
    if (!parsed.success) {
        return fail<ValidatedLLMConfig, LLMUpdateContext>(zodToIssues(parsed.error, 'error'));
    }

    // Enforce final apiKey (hard error)
    if (!parsed.data.apiKey?.trim()) {
        return fail<ValidatedLLMConfig, LLMUpdateContext>([
            {
                code: SaikiErrorCode.MISSING_API_KEY,
                message: 'Missing API key',
                path: ['apiKey'],
                severity: 'error',
                context: {
                    provider: candidate.provider,
                    model: candidate.model,
                    router: candidate.router,
                },
            },
        ]);
    }

    return ok<ValidatedLLMConfig, LLMUpdateContext>(parsed.data, warnings);
}
