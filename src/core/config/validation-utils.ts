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
import type { AgentRuntimeState, AgentStateManager } from './agent-state-manager.js';
import { resolveApiKeyForProvider } from '../utils/api-key-resolver.js';
import { logger } from '../logger/index.js';

/**
 * Result of configuration validation
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Result of LLM configuration validation with the validated config
 */
export interface LLMConfigResult extends ValidationResult {
    config: LLMConfig;
}

/**
 * Core validation for LLM configuration parameters.
 * Used by all other LLM validation functions.
 */
function validateLLMCore(config: {
    provider?: string;
    model?: string;
    router?: string;
    baseURL?: string;
}): string[] {
    const errors: string[] = [];
    const { provider, model, router, baseURL } = config;

    // Validate provider
    if (provider && !isValidProvider(provider)) {
        errors.push(`Unknown provider: ${provider}`);
        return errors; // Return early if provider doesn't exist
    }

    // Validate router
    if (router && !isValidRouter(router)) {
        errors.push('Router must be either "vercel" or "in-built"');
    }

    // Validate provider/model combination if both provided
    if (provider && model && !isValidProviderModel(provider, model)) {
        const supportedModels = getSupportedModels(provider);
        errors.push(
            `Model '${model}' is not supported for provider '${provider}'. Supported models: ${supportedModels.join(', ')}`
        );
    }

    // Validate provider/router combination if both provided
    if (provider && router && !isRouterSupportedForProvider(provider, router)) {
        const supportedRouters = getSupportedRoutersForProvider(provider);
        errors.push(
            `Provider '${provider}' does not support '${router}' router. Supported routers: ${supportedRouters.join(', ')}`
        );
    }

    // Validate baseURL usage
    if (baseURL && provider && !supportsBaseURL(provider)) {
        errors.push(`Custom baseURL is not supported for ${provider} provider`);
    }

    return errors;
}

/**
 * Validates an LLM switch request.
 */
export function validateLLMSwitchRequest(request: {
    provider?: string;
    model?: string;
    router?: string;
    baseURL?: string;
}): string[] {
    const { provider, model } = request;

    // Check required fields
    if (!provider || !model) {
        return ['Provider and model are required'];
    }

    return validateLLMCore(request);
}

/**
 * Validates runtime settings updates
 */
export function validateRuntimeUpdate(
    update: Partial<AgentRuntimeState['runtime']>
): ValidationResult {
    const errors: string[] = [];

    if (update.debugMode !== undefined && typeof update.debugMode !== 'boolean') {
        errors.push('debugMode must be a boolean');
    }

    if (update.logLevel !== undefined) {
        const validLogLevels = ['error', 'warn', 'info', 'debug'];
        if (typeof update.logLevel !== 'string' || !validLogLevels.includes(update.logLevel)) {
            errors.push(`logLevel must be one of: ${validLogLevels.join(', ')}`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings: [],
    };
}

/**
 * Validates an entire runtime state configuration
 */
export function validateRuntimeState(state: AgentRuntimeState): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate LLM config using core validation
    const llmErrors = validateLLMCore(state.llm);
    errors.push(...llmErrors);

    // Additional LLM-specific validation
    if (!state.llm.provider || !state.llm.model) {
        errors.push('Provider and model are required');
    }

    if (state.llm.apiKey && state.llm.apiKey.length < 10) {
        warnings.push('API key seems too short - please verify it is correct');
    }

    if (state.llm.maxTokens !== undefined && state.llm.maxTokens <= 0) {
        errors.push('maxTokens must be a positive number');
    }

    // Validate runtime settings
    const runtimeValidation = validateRuntimeUpdate(state.runtime);
    errors.push(...runtimeValidation.errors);
    warnings.push(...runtimeValidation.warnings);

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Builds a complete LLM configuration from partial updates, handling all the complex
 * logic for provider inference, API key resolution, compatibility checks, and validation.
 */
export async function buildValidatedLLMConfig(
    updates: Partial<LLMConfig>,
    currentConfig: LLMConfig,
    stateManager: AgentStateManager,
    sessionId?: string
): Promise<{ config: LLMConfig; configWarnings: string[] }> {
    const result = await buildLLMConfig(updates, currentConfig);

    if (!result.isValid) {
        throw new Error(`LLM configuration validation failed: ${result.errors.join('; ')}`);
    }

    // Update state manager with the validated config
    const stateValidation = stateManager.updateLLM(result.config, sessionId);
    if (!stateValidation.isValid) {
        throw new Error(`State manager validation failed: ${stateValidation.errors.join('; ')}`);
    }

    return {
        config: result.config,
        configWarnings: [...result.warnings, ...stateValidation.warnings],
    };
}

/**
 * Core function that builds and validates an LLM configuration from partial updates.
 * Handles provider inference, model compatibility, router selection, and API key resolution.
 */
export async function buildLLMConfig(
    updates: Partial<LLMConfig>,
    currentConfig: LLMConfig
): Promise<LLMConfigResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Step 1: Determine model
    const model = resolveModel(updates, currentConfig, errors);
    if (errors.length > 0) {
        return { config: currentConfig, isValid: false, errors, warnings };
    }

    // Step 2: Determine provider
    const provider = resolveProvider(updates, currentConfig, model, errors, warnings);
    if (errors.length > 0) {
        return { config: currentConfig, isValid: false, errors, warnings };
    }

    // Step 3: Validate model/provider compatibility and fix if needed
    const { finalModel, finalProvider } = resolveModelProviderCompatibility(
        model,
        provider,
        updates,
        currentConfig,
        errors,
        warnings
    );
    if (errors.length > 0) {
        return { config: currentConfig, isValid: false, errors, warnings };
    }

    // Step 4: Determine router
    const router = resolveRouter(updates, currentConfig, finalProvider, errors, warnings);
    if (errors.length > 0) {
        return { config: currentConfig, isValid: false, errors, warnings };
    }

    // Step 5: Determine API key
    const apiKey = await resolveApiKey(updates, currentConfig, finalProvider, errors, warnings);
    if (errors.length > 0) {
        return { config: currentConfig, isValid: false, errors, warnings };
    }

    // Step 6: Build remaining fields
    const config = buildFinalConfig(
        { provider: finalProvider, model: finalModel, router, apiKey },
        updates,
        currentConfig,
        errors,
        warnings
    );
    if (errors.length > 0) {
        return { config: currentConfig, isValid: false, errors, warnings };
    }

    // Step 7: Final schema validation
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

// Helper functions for building LLM config

function resolveModel(
    updates: Partial<LLMConfig>,
    currentConfig: LLMConfig,
    errors: string[]
): string {
    if (updates.model !== undefined) {
        if (typeof updates.model !== 'string' || updates.model.trim() === '') {
            errors.push('Model must be a non-empty string');
            return '';
        }
        return updates.model.trim();
    }
    return currentConfig.model;
}

function resolveProvider(
    updates: Partial<LLMConfig>,
    currentConfig: LLMConfig,
    model: string,
    errors: string[],
    warnings: string[]
): string {
    if (updates.provider !== undefined) {
        // Explicit provider provided
        if (typeof updates.provider !== 'string' || updates.provider.trim() === '') {
            errors.push('Provider must be a non-empty string');
            return '';
        }

        const providerName = updates.provider.trim();
        if (!isValidProvider(providerName)) {
            errors.push(`Unknown provider: ${providerName}`);
            return '';
        }

        return providerName;
    } else if (updates.model !== undefined && model !== currentConfig.model) {
        // Model changed but provider not specified - infer provider
        try {
            const inferredProvider = getProviderFromModel(model);
            if (inferredProvider !== currentConfig.provider) {
                logger.info(`Inferred provider '${inferredProvider}' from model '${model}'`);
            }
            return inferredProvider;
        } catch (error) {
            errors.push(
                `Could not infer provider from model '${model}'. Please specify provider explicitly.`
            );
            return '';
        }
    }

    // No provider update and no model change - keep current provider
    return currentConfig.provider;
}

function resolveModelProviderCompatibility(
    model: string,
    provider: string,
    updates: Partial<LLMConfig>,
    currentConfig: LLMConfig,
    errors: string[],
    warnings: string[]
): { finalModel: string; finalProvider: string } {
    if (isValidProviderModel(provider, model)) {
        return { finalModel: model, finalProvider: provider };
    }

    // Incompatible - try to fix if provider was changed without model
    if (updates.provider && !updates.model) {
        const defaultModel = getDefaultModelForProvider(provider);
        if (defaultModel) {
            logger.info(
                `Model '${model}' incompatible with provider '${provider}', using default model '${defaultModel}'`
            );
            warnings.push(`Switched to default model '${defaultModel}' for provider '${provider}'`);
            return { finalModel: defaultModel, finalProvider: provider };
        }
    }

    // Can't fix - this is an error
    const supportedModels = getSupportedModels(provider);
    errors.push(
        `Model '${model}' is not supported for provider '${provider}'. Supported models: ${supportedModels.join(', ')}`
    );
    return { finalModel: model, finalProvider: provider };
}

function resolveRouter(
    updates: Partial<LLMConfig>,
    currentConfig: LLMConfig,
    provider: string,
    errors: string[],
    warnings: string[]
): 'vercel' | 'in-built' {
    if (updates.router !== undefined) {
        if (!isValidRouter(updates.router)) {
            errors.push('Router must be either "vercel" or "in-built"');
            return 'vercel';
        }

        if (!isRouterSupportedForProvider(provider, updates.router)) {
            const supportedRouters = getSupportedRoutersForProvider(provider);
            errors.push(
                `Provider '${provider}' does not support '${updates.router}' router. Supported routers: ${supportedRouters.join(', ')}`
            );
            return 'vercel';
        }

        return updates.router;
    }

    // Try to keep current router if compatible with new provider
    if (isRouterSupportedForProvider(provider, currentConfig.router)) {
        return currentConfig.router;
    }

    // Current router not supported - find a compatible one
    const supportedRouters = getSupportedRoutersForProvider(provider);
    if (supportedRouters.length === 0) {
        errors.push(`Provider '${provider}' is not supported by any router`);
        return 'vercel';
    }

    const newRouter = supportedRouters.includes('vercel')
        ? 'vercel'
        : (supportedRouters[0] as 'vercel' | 'in-built');

    logger.info(
        `Current router '${currentConfig.router}' not supported by provider '${provider}', switching to '${newRouter}'`
    );
    warnings.push(
        `Switched router from '${currentConfig.router}' to '${newRouter}' for provider '${provider}'`
    );

    return newRouter;
}

async function resolveApiKey(
    updates: Partial<LLMConfig>,
    currentConfig: LLMConfig,
    provider: string,
    errors: string[],
    warnings: string[]
): Promise<string> {
    const providerChanged = provider !== currentConfig.provider;

    if (updates.apiKey !== undefined) {
        // Explicit API key provided
        if (updates.apiKey && updates.apiKey.length < 10) {
            warnings.push('API key seems too short - please verify it is correct');
        }
        return updates.apiKey;
    } else if (providerChanged) {
        // Provider changed - resolve from environment
        const resolvedApiKey = resolveApiKeyForProvider(provider);
        if (resolvedApiKey) {
            logger.info(`Resolved API key for provider '${provider}' from environment`);
            return resolvedApiKey;
        } else {
            errors.push(
                `No API key found for provider '${provider}'. Please set the appropriate environment variable or provide apiKey explicitly.`
            );
            return '';
        }
    } else {
        // Provider unchanged - keep existing API key
        return currentConfig.apiKey;
    }
}

function buildFinalConfig(
    core: { provider: string; model: string; router: 'vercel' | 'in-built'; apiKey: string },
    updates: Partial<LLMConfig>,
    currentConfig: LLMConfig,
    errors: string[],
    warnings: string[]
): LLMConfig {
    // Base URL
    let baseURL: string | undefined;
    if (updates.baseURL !== undefined) {
        if (!supportsBaseURL(core.provider)) {
            errors.push(`Custom baseURL is not supported for ${core.provider} provider`);
        } else {
            baseURL = updates.baseURL;
        }
    } else if (currentConfig.baseURL && supportsBaseURL(core.provider)) {
        baseURL = currentConfig.baseURL;
    } else if (currentConfig.baseURL && !supportsBaseURL(core.provider)) {
        warnings.push(
            `Removed custom baseURL because provider '${core.provider}' doesn't support it`
        );
    }

    // MaxTokens
    let maxTokens: number | undefined;
    if (updates.maxTokens !== undefined) {
        if (typeof updates.maxTokens !== 'number' || updates.maxTokens <= 0) {
            errors.push('maxTokens must be a positive number');
        } else {
            maxTokens = updates.maxTokens;
        }
    } else {
        const effectiveMaxTokens = getEffectiveMaxTokens(core);
        const modelChanged = core.model !== currentConfig.model;

        if (modelChanged) {
            maxTokens = effectiveMaxTokens;
            if (currentConfig.maxTokens && currentConfig.maxTokens !== effectiveMaxTokens) {
                warnings.push(
                    `Updated maxTokens from ${currentConfig.maxTokens} to ${effectiveMaxTokens} for model '${core.model}'`
                );
            }
        } else {
            maxTokens = currentConfig.maxTokens || effectiveMaxTokens;
        }
    }

    // Provider options
    let providerOptions: Record<string, any> = {};
    if (updates.providerOptions !== undefined) {
        if (typeof updates.providerOptions !== 'object' || updates.providerOptions === null) {
            errors.push('Provider options must be an object');
        } else {
            providerOptions = updates.providerOptions;
        }
    } else {
        providerOptions = currentConfig.providerOptions || {};
    }

    return {
        provider: core.provider,
        model: core.model,
        apiKey: core.apiKey,
        router: core.router,
        systemPrompt: currentConfig.systemPrompt, // Always use current system prompt
        maxIterations:
            updates.maxIterations !== undefined
                ? updates.maxIterations
                : currentConfig.maxIterations || 50,
        providerOptions,
        ...(baseURL && { baseURL }),
        ...(maxTokens && { maxTokens }),
    };
}
