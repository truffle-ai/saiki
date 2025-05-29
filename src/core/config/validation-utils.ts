import {
    isValidProvider,
    isValidProviderModel,
    isValidRouter,
    getSupportedModels,
    getSupportedRoutersForProvider,
    isRouterSupportedForProvider,
    supportsBaseURL,
    getProviderFromModel,
    getDefaultModelForProvider,
    getEffectiveMaxTokens,
} from '../ai/llm/registry.js';
import type { LLMConfig } from './schemas.js';
import { LLMConfigSchema } from './schemas.js';
import type { AgentRuntimeState } from './agent-state-manager.js';
import { resolveApiKeyForProvider } from '../utils/api-key-resolver.js';
import { logger } from '../logger/index.js';

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

/**
 * Updates and validates LLM configuration by intelligently building a new config step-by-step.
 * This function handles all the complex logic for provider inference, API key resolution,
 * smart defaults, AND comprehensive validation. It builds the config progressively to avoid
 * carrying forward incompatible values from the current config.
 *
 * Each section has explicit pre/post-conditions to ensure robust logic.
 *
 * @param updates Partial configuration updates from the request
 * @param currentConfig Current LLM configuration to use as fallback for unchanged fields
 * @returns Object containing the updated config, validation results, and any warnings
 */
export async function updateAndValidateLLMConfig(
    updates: Partial<LLMConfig>,
    currentConfig: LLMConfig
): Promise<{
    config: LLMConfig;
    isValid: boolean;
    errors: string[];
    warnings: string[];
}> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // BUILD CONFIG STEP-BY-STEP (not by cloning)
    // Pre-condition: We start with a clean slate
    // Post-condition: We build a fully compatible config

    // ======== STEP 1: DETERMINE MODEL ========
    // Pre-condition: We have either updates.model or currentConfig.model
    // Goal: Set the model we want to use
    // Post-condition: We have a valid model string

    let model: string;
    if (updates.model !== undefined) {
        // Validate model format
        if (typeof updates.model !== 'string' || updates.model.trim() === '') {
            errors.push('Model must be a non-empty string');
            return { config: currentConfig, isValid: false, errors, warnings };
        }
        model = updates.model.trim();
        logger.debug(`Using updated model: '${model}'`);
    } else {
        model = currentConfig.model;
        logger.debug(`Using current model: '${model}'`);
    }
    // Post-condition: model is set to a valid string

    // ======== STEP 2: DETERMINE PROVIDER ========
    // Pre-condition: We have a model
    // Goal: Set the provider, either explicitly provided or inferred from model
    // Post-condition: We have a valid provider that supports the model

    let provider: string;
    if (updates.provider !== undefined) {
        // Explicit provider provided - validate it
        if (typeof updates.provider !== 'string' || updates.provider.trim() === '') {
            errors.push('Provider must be a non-empty string');
            return { config: currentConfig, isValid: false, errors, warnings };
        }

        const providerName = updates.provider.trim();
        if (!isValidProvider(providerName)) {
            errors.push(`Unknown provider: ${providerName}`);
            return { config: currentConfig, isValid: false, errors, warnings };
        }

        provider = providerName;
        logger.debug(`Using explicit provider: '${provider}'`);
    } else {
        // No explicit provider - infer from model
        try {
            provider = getProviderFromModel(model);
            if (provider !== currentConfig.provider) {
                logger.info(`Inferred provider '${provider}' from model '${model}'`);
            } else {
                logger.debug(`Keeping current provider: '${provider}'`);
            }
        } catch (error) {
            errors.push(
                `Could not infer provider from model '${model}'. Please specify provider explicitly.`
            );
            return { config: currentConfig, isValid: false, errors, warnings };
        }
    }
    // Post-condition: provider is set to a valid provider string

    // ======== STEP 3: VALIDATE MODEL/PROVIDER COMPATIBILITY ========
    // Pre-condition: We have both model and provider
    // Goal: Ensure the model is actually supported by the provider
    // Post-condition: model/provider combination is valid, or we've switched to a default model

    if (!isValidProviderModel(provider, model)) {
        if (updates.provider && !updates.model) {
            // Provider was explicitly changed but model wasn't - try default model for provider
            const defaultModel = getDefaultModelForProvider(provider);
            if (defaultModel) {
                model = defaultModel;
                logger.info(
                    `Model '${currentConfig.model}' incompatible with provider '${provider}', using default model '${defaultModel}'`
                );
                warnings.push(
                    `Switched to default model '${defaultModel}' for provider '${provider}'`
                );
            } else {
                errors.push(
                    `Current model '${model}' is not supported for provider '${provider}' and no default model available`
                );
                return { config: currentConfig, isValid: false, errors, warnings };
            }
        } else {
            // Model was explicitly provided or inferred - this is a hard error
            const supportedModels = getSupportedModels(provider);
            errors.push(
                `Model '${model}' is not supported for provider '${provider}'. Supported models: ${supportedModels.join(', ')}`
            );
            return { config: currentConfig, isValid: false, errors, warnings };
        }
    }
    // Post-condition: model and provider are compatible

    // ======== STEP 4: DETERMINE ROUTER ========
    // Pre-condition: We have valid model and provider
    // Goal: Set a router that is supported by the provider
    // Post-condition: We have a valid router supported by the provider

    let router: 'vercel' | 'in-built';
    if (updates.router !== undefined) {
        // Explicit router provided - validate it
        if (!isValidRouter(updates.router)) {
            errors.push('Router must be either "vercel" or "in-built"');
            return { config: currentConfig, isValid: false, errors, warnings };
        }
        router = updates.router;
        logger.debug(`Using explicit router: '${router}'`);
    } else {
        // No explicit router - try to keep current router if compatible with new provider
        if (isRouterSupportedForProvider(provider, currentConfig.router)) {
            router = currentConfig.router;
            logger.debug(`Keeping current router: '${router}'`);
        } else {
            // Current router not supported by new provider - find a supported one
            const supportedRouters = getSupportedRoutersForProvider(provider);
            if (supportedRouters.length === 0) {
                errors.push(`Provider '${provider}' is not supported by any router`);
                return { config: currentConfig, isValid: false, errors, warnings };
            }

            // Prefer 'vercel' if available, otherwise use the first supported router
            router = supportedRouters.includes('vercel')
                ? 'vercel'
                : (supportedRouters[0] as 'vercel' | 'in-built');
            logger.info(
                `Current router '${currentConfig.router}' not supported by provider '${provider}', switching to '${router}'`
            );
            warnings.push(
                `Switched router from '${currentConfig.router}' to '${router}' for provider '${provider}'`
            );
        }
    }

    // Validate final provider/router combination
    if (!isRouterSupportedForProvider(provider, router)) {
        const supportedRouters = getSupportedRoutersForProvider(provider);
        errors.push(
            `Provider '${provider}' does not support '${router}' router. Supported routers: ${supportedRouters.join(', ')}`
        );
        return { config: currentConfig, isValid: false, errors, warnings };
    }
    // Post-condition: router is valid and supported by provider

    // ======== STEP 5: DETERMINE API KEY ========
    // Pre-condition: We have valid model, provider, and router
    // Goal: Set an appropriate API key for the provider
    // Post-condition: We have an API key suitable for the provider

    let apiKey: string;
    const providerChanged = provider !== currentConfig.provider;

    if (updates.apiKey !== undefined) {
        // Explicit API key provided (could be empty string)
        apiKey = updates.apiKey;
        logger.debug('Using explicitly provided API key');

        // Validate API key format if provided
        if (updates.apiKey && (typeof updates.apiKey !== 'string' || updates.apiKey.length < 10)) {
            warnings.push('API key seems too short - please verify it is correct');
        }
    } else if (providerChanged) {
        // Provider changed - must resolve new API key from environment
        logger.info(
            `Provider changed from '${currentConfig.provider}' to '${provider}' - resolving API key from environment`
        );
        const resolvedApiKey = resolveApiKeyForProvider(provider);
        if (resolvedApiKey) {
            apiKey = resolvedApiKey;
            logger.info(`Resolved API key for provider '${provider}' from environment`);
        } else {
            errors.push(
                `No API key found for provider '${provider}'. Please set the appropriate environment variable or provide apiKey explicitly.`
            );
            return { config: currentConfig, isValid: false, errors, warnings };
        }
    } else {
        // Provider unchanged - keep existing API key
        apiKey = currentConfig.apiKey;
        logger.debug(`Provider unchanged ('${provider}'), keeping existing API key`);
    }
    // Post-condition: apiKey is set appropriately for the provider

    // ======== STEP 6: DETERMINE OTHER FIELDS ========
    // Pre-condition: We have all core fields (model, provider, router, apiKey)
    // Goal: Set remaining fields from updates or current config
    // Post-condition: We have a complete LLMConfig

    // Base URL
    let baseURL: string | undefined;
    if (updates.baseURL !== undefined) {
        if (!supportsBaseURL(provider)) {
            errors.push(`Custom baseURL is not supported for ${provider} provider`);
            return { config: currentConfig, isValid: false, errors, warnings };
        }
        baseURL = updates.baseURL;
        logger.debug(`Setting baseURL to '${baseURL || 'default'}'`);
    } else {
        // Keep current baseURL only if the provider supports it
        if (currentConfig.baseURL && supportsBaseURL(provider)) {
            baseURL = currentConfig.baseURL;
            logger.debug('Keeping current baseURL');
        } else if (currentConfig.baseURL && !supportsBaseURL(provider)) {
            // baseURL was set but new provider doesn't support it
            logger.info(
                `Removing baseURL because provider '${provider}' doesn't support custom baseURL`
            );
            warnings.push(
                `Removed custom baseURL because provider '${provider}' doesn't support it`
            );
        }
    }

    // MaxTokens
    let maxTokens: number | undefined;
    if (updates.maxTokens !== undefined) {
        if (typeof updates.maxTokens !== 'number' || updates.maxTokens <= 0) {
            errors.push('maxTokens must be a positive number');
            return { config: currentConfig, isValid: false, errors, warnings };
        }
        maxTokens = updates.maxTokens;
        logger.debug(`Using explicit maxTokens: ${maxTokens}`);
    } else {
        // Check if model changed (which affects token limits)
        const modelChanged = model !== currentConfig.model;

        if (modelChanged) {
            // Model changed - recalculate maxTokens for new model
            const effectiveMaxTokens = getEffectiveMaxTokens({ provider, model, router, apiKey });
            maxTokens = effectiveMaxTokens;
            if (currentConfig.maxTokens && currentConfig.maxTokens !== effectiveMaxTokens) {
                logger.info(
                    `Model changed from '${currentConfig.model}' to '${model}' - updated maxTokens from ${currentConfig.maxTokens} to ${effectiveMaxTokens}`
                );
                warnings.push(
                    `Updated maxTokens from ${currentConfig.maxTokens} to ${effectiveMaxTokens} for model '${model}'`
                );
            } else {
                logger.debug(`Set maxTokens to ${maxTokens} for new model '${model}'`);
            }
        } else {
            // Model unchanged - use current maxTokens, or calculate default if not set
            const effectiveMaxTokens = getEffectiveMaxTokens({ provider, model, router, apiKey });
            maxTokens = currentConfig.maxTokens || effectiveMaxTokens;
            if (!currentConfig.maxTokens) {
                logger.debug(`Set maxTokens to ${maxTokens} based on model capabilities`);
            } else {
                logger.debug(`Keeping current maxTokens: ${maxTokens}`);
            }
        }
    }

    // Provider-specific options
    let providerOptions: Record<string, any> = {};
    if (updates.providerOptions !== undefined) {
        if (typeof updates.providerOptions !== 'object' || updates.providerOptions === null) {
            errors.push('Provider options must be an object');
            return { config: currentConfig, isValid: false, errors, warnings };
        }
        providerOptions = updates.providerOptions;
        logger.debug('Applied provider-specific options');
    } else {
        providerOptions = currentConfig.providerOptions || {};
    }

    // TODO: System prompt - always use current system prompt (no updates allowed - going to move system prompt to a separate config section)
    const systemPrompt = currentConfig.systemPrompt;
    logger.debug('Using current system prompt (updates not supported via this function)');

    // MaxIterations
    const maxIterations =
        updates.maxIterations !== undefined ? updates.maxIterations : currentConfig.maxIterations;

    // ======== STEP 7: BUILD FINAL CONFIG ========
    // Pre-condition: All individual fields are validated and set
    // Goal: Create the final LLMConfig object
    // Post-condition: We have a complete, internally consistent LLMConfig

    const config: LLMConfig = {
        provider,
        model,
        apiKey,
        router,
        systemPrompt,
        maxIterations: maxIterations || 50,
        providerOptions,
        ...(baseURL && { baseURL }),
        ...(maxTokens && { maxTokens }),
    };

    // ======== STEP 8: FINAL SCHEMA VALIDATION ========
    // Pre-condition: We have a complete LLMConfig
    // Goal: Ensure it passes all schema validation rules
    // Post-condition: Config is fully valid according to LLMConfigSchema

    const schemaValidation = LLMConfigSchema.safeParse(config);
    if (!schemaValidation.success) {
        const schemaErrors = schemaValidation.error.errors.map(
            (err) => `${err.path.join('.')}: ${err.message}`
        );
        errors.push(...schemaErrors);
        return { config: currentConfig, isValid: false, errors, warnings };
    }

    logger.debug(
        `Built and validated LLM config: provider=${config.provider}, model=${config.model}, router=${config.router}`
    );
    return {
        config,
        isValid: true,
        errors: [],
        warnings,
    };
}
