import {
    validateLLMSwitchRequest as coreValidateLLMSwitchRequest,
    isValidProvider,
    isValidProviderModel,
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
 * Validates a partial LLM configuration for runtime updates.
 * This builds on top of the core validateLLMSwitchRequest but adds context
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
    const coreErrors = coreValidateLLMSwitchRequest({
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

/**
 * Quick validation functions for common use cases
 */
export const quickValidations = {
    /**
     * Check if a provider/model combination is valid
     */
    isValidProviderModel(provider: string, model: string): boolean {
        return isValidProvider(provider) && isValidProviderModel(provider, model);
    },

    /**
     * Check if a router is supported for a provider
     */
    isValidProviderRouter(provider: string, router: string): boolean {
        return isValidProvider(provider) && isRouterSupportedForProvider(provider, router);
    },

    /**
     * Get available models for a provider
     */
    getModelsForProvider(provider: string): string[] {
        return isValidProvider(provider) ? getSupportedModels(provider) : [];
    },

    /**
     * Get available routers for a provider
     */
    getRoutersForProvider(provider: string): string[] {
        return isValidProvider(provider) ? getSupportedRoutersForProvider(provider) : [];
    },

    /**
     * Check if provider supports custom base URL
     */
    providerSupportsBaseURL(provider: string): boolean {
        return isValidProvider(provider) && supportsBaseURL(provider);
    },
};
