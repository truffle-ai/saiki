import {
    isValidProvider,
    isValidProviderModel,
    isValidRouter,
    getSupportedModels,
    getSupportedRoutersForProvider,
    isRouterSupportedForProvider,
    supportsBaseURL,
} from '../ai/llm/registry.js';
import type { LLMConfig } from './schemas.js';
import type { AgentRuntimeState } from './agent-state-manager.js';

/**
 * Result of LLM configuration validation
 */
export interface LLMValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validates an LLM switch request and returns validation errors if any.
 * Moved from registry.ts to be part of validation layer.
 * @param request The LLM switch request parameters.
 * @returns An array of validation error messages. Empty array if valid.
 */
export function validateLLMSwitchRequest(request: {
    provider?: string;
    model?: string;
    router?: string;
    baseURL?: string;
}): string[] {
    const errors: string[] = [];
    const { provider, model, router, baseURL } = request;

    // Check required fields
    if (!provider || !model) {
        errors.push('Provider and model are required');
        return errors; // Return early if basic requirements aren't met
    }

    // Validate router if provided
    if (router && !isValidRouter(router)) {
        errors.push('Router must be either "vercel" or "in-built"');
    }

    // Validate provider exists
    if (!isValidProvider(provider)) {
        errors.push(`Unknown provider: ${provider}`);
        return errors; // Return early if provider doesn't exist
    }

    // Validate provider/model combination
    if (!isValidProviderModel(provider, model)) {
        const supportedModels = getSupportedModels(provider);
        errors.push(
            `Model '${model}' is not supported for provider '${provider}'. Supported models: ${supportedModels.join(', ')}`
        );
    }

    // Validate provider/router combination
    const selectedRouter = router || 'vercel';
    if (!isRouterSupportedForProvider(provider, selectedRouter)) {
        const supportedRouters = getSupportedRoutersForProvider(provider);
        errors.push(
            `Provider '${provider}' does not support '${selectedRouter}' router. Supported routers: ${supportedRouters.join(', ')}`
        );
    }

    // Validate baseURL usage
    if (baseURL && !supportsBaseURL(provider)) {
        errors.push(`Custom baseURL is not supported for ${provider} provider`);
    }

    return errors;
}

/**
 * Validates a partial LLM configuration for runtime updates.
 * This builds on top of validateLLMSwitchRequest but adds context
 * about the current state and runtime-specific validation.
 */
export function validateLLMUpdate(
    update: Partial<LLMConfig>,
    currentState?: AgentRuntimeState
): LLMValidationResult {
    const result: LLMValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
    };

    // If we have current state, merge the update to get the full config for validation
    const effectiveConfig = currentState
        ? {
              ...currentState.llm,
              ...update,
          }
        : update;

    // Use core validation for basic checks
    const coreErrors = validateLLMSwitchRequest({
        provider: effectiveConfig.provider,
        model: effectiveConfig.model,
        router: effectiveConfig.router,
        baseURL: effectiveConfig.baseURL,
    });

    result.errors.push(...coreErrors);

    // Additional runtime-specific validations
    if (update.apiKey !== undefined) {
        if (typeof update.apiKey !== 'string' || update.apiKey.trim().length === 0) {
            result.errors.push('API key must be a non-empty string');
        } else if (update.apiKey.length < 10) {
            result.warnings.push('API key seems too short - please verify it is correct');
        }
    }

    // Validate system prompt if provided
    if (update.systemPrompt !== undefined) {
        if (typeof update.systemPrompt === 'string') {
            if (update.systemPrompt.length === 0) {
                result.warnings.push('System prompt is empty');
            } else if (update.systemPrompt.length > 10000) {
                result.warnings.push('System prompt is very long and may impact performance');
            }
        } else if (typeof update.systemPrompt === 'object') {
            // Validate SystemPromptConfig structure
            if (
                !update.systemPrompt.contributors ||
                !Array.isArray(update.systemPrompt.contributors)
            ) {
                result.errors.push('System prompt config must have a contributors array');
            } else if (update.systemPrompt.contributors.length === 0) {
                result.warnings.push('System prompt config has no contributors');
            }
        }
    }

    // Validate provider options if provided
    if (update.providerOptions !== undefined) {
        if (typeof update.providerOptions !== 'object' || update.providerOptions === null) {
            result.errors.push('Provider options must be an object');
        }
    }

    // Check for potential compatibility issues when switching providers
    if (currentState && update.provider && update.provider !== currentState.llm.provider) {
        result.warnings.push(
            `Switching from ${currentState.llm.provider} to ${update.provider} - ensure API key is valid for the new provider`
        );
    }

    result.isValid = result.errors.length === 0;
    return result;
}

/**
 * Validates runtime settings updates
 */
export function validateRuntimeUpdate(
    update: Partial<AgentRuntimeState['runtime']>
): LLMValidationResult {
    const result: LLMValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
    };

    if (update.debugMode !== undefined && typeof update.debugMode !== 'boolean') {
        result.errors.push('debugMode must be a boolean');
    }

    if (update.logLevel !== undefined) {
        const validLogLevels = ['error', 'warn', 'info', 'debug'];
        if (typeof update.logLevel !== 'string' || !validLogLevels.includes(update.logLevel)) {
            result.errors.push(`logLevel must be one of: ${validLogLevels.join(', ')}`);
        }
    }

    result.isValid = result.errors.length === 0;
    return result;
}

/**
 * Validates an entire runtime state configuration
 */
export function validateRuntimeState(state: AgentRuntimeState): LLMValidationResult {
    const result: LLMValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
    };

    // Validate LLM config
    const llmValidation = validateLLMUpdate(state.llm);
    result.errors.push(...llmValidation.errors);
    result.warnings.push(...llmValidation.warnings);

    // Validate runtime settings
    const runtimeValidation = validateRuntimeUpdate(state.runtime);
    result.errors.push(...runtimeValidation.errors);
    result.warnings.push(...runtimeValidation.warnings);

    result.isValid = result.errors.length === 0;
    return result;
}
