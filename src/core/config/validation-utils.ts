import {
    isValidProviderModel,
    isValidRouter,
    getSupportedModels,
    getSupportedRoutersForProvider,
    isRouterSupportedForProvider,
    supportsBaseURL,
    getProviderFromModel,
    getDefaultModelForProvider,
    getEffectiveMaxInputTokens,
    acceptsAnyModel,
    LLMProvider,
} from '../llm/registry.js';
import type {
    ValidatedLLMConfig,
    ValidatedMcpServerConfig,
    LLMConfig,
    McpServerConfig,
    LLMSwitchInput,
} from './schemas.js';
import { LLMConfigSchema, McpServerConfigSchema } from './schemas.js';
import { resolveApiKeyForProvider } from '../utils/api-key-resolver.js';
import { logger } from '../logger/index.js';
import { ZodError } from 'zod';

/**
 * Types of validation errors that can occur
 */
export type ValidationErrorType =
    | 'missing_api_key'
    | 'invalid_model'
    | 'invalid_provider'
    | 'incompatible_model_provider'
    | 'unsupported_router'
    | 'invalid_base_url'
    | 'invalid_max_tokens'
    | 'schema_validation'
    | 'general';

/**
 * Structured validation error with context
 */
export interface ValidationError {
    type: ValidationErrorType;
    message: string;
    field?: string;
    provider?: string;
    model?: string;
    router?: string;
    suggestedAction?: string;
}

/**
 * Standard result type for validation operations
 */
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: string[];
    config?: LLMConfig; // Optional validated config for buildLLMConfig
}

/**
 * Result of LLM configuration validation with the validated config
 */
export interface LLMConfigResult extends ValidationResult {
    config: ValidatedLLMConfig;
}

// validateLLMCore function removed - basic validation now handled by Zod schemas at API boundary

// validateLLMSwitchRequest function removed - request validation now handled by Zod schemas at API boundary

/**
 * Helper function to convert ValidationError array to string array for backward compatibility
 */
export function validationErrorsToStrings(errors: ValidationError[]): string[] {
    return errors.map((error) => error.message);
}

/**
 * Core function that builds and validates an LLM configuration from partial updates.
 * Handles provider inference, model compatibility, router selection, and API key resolution.
 */
export async function buildLLMConfig(
    updates: LLMSwitchInput,
    currentConfig: ValidatedLLMConfig
): Promise<LLMConfigResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Helper for early returns - currentConfig is already validated
    const returnError = () => ({
        config: currentConfig,
        isValid: false,
        errors,
        warnings,
    });

    // Step 1: Determine model
    const model = resolveModel(updates, currentConfig, errors);
    if (errors.length > 0) return returnError();

    // Step 2: Determine provider
    const provider = resolveProvider(updates, currentConfig, model, errors, warnings);
    if (errors.length > 0) return returnError();

    // Step 3: Validate model/provider compatibility and fix if needed
    const { finalModel, finalProvider } = resolveModelProviderCompatibility(
        model,
        provider,
        updates,
        currentConfig,
        errors,
        warnings
    );
    if (errors.length > 0) return returnError();

    // Step 4: Determine router
    const router = resolveRouter(updates, currentConfig, finalProvider, errors, warnings);
    if (errors.length > 0) return returnError();

    // Step 5: Determine API key
    const apiKey = await resolveApiKey(updates, currentConfig, finalProvider, errors, warnings);
    if (errors.length > 0) return returnError();

    // Step 6: Build remaining fields
    const config = buildFinalConfig(
        { provider: finalProvider, model: finalModel, router, apiKey },
        updates,
        currentConfig,
        errors,
        warnings
    );
    if (errors.length > 0) return returnError();

    // Step 7: Final schema validation
    const schemaValidation = LLMConfigSchema.safeParse(config);
    if (!schemaValidation.success) {
        const schemaErrors = schemaValidation.error.errors.map((err) => ({
            type: 'schema_validation' as ValidationErrorType,
            message: `${err.path.join('.')}: ${err.message}`,
        }));
        errors.push(...schemaErrors);
        return returnError();
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
    updates: LLMSwitchInput,
    currentConfig: ValidatedLLMConfig,
    _errors: ValidationError[]
): string {
    // Basic validation (non-empty string) now handled by Zod schemas
    return updates.model !== undefined ? updates.model : currentConfig.model;
}

function resolveProvider(
    updates: LLMSwitchInput,
    currentConfig: ValidatedLLMConfig,
    model: string,
    errors: ValidationError[],
    _warnings: string[]
): LLMProvider {
    if (updates.provider !== undefined) {
        // Explicit provider provided - already validated by Zod schema
        return updates.provider;
    } else if (updates.model !== undefined && model !== currentConfig.model) {
        // Model changed but provider not specified
        // If current provider accepts any model, keep it
        if (acceptsAnyModel(currentConfig.provider)) {
            return currentConfig.provider;
        }

        // Otherwise, try to infer provider from new model
        try {
            const inferredProvider = getProviderFromModel(model);
            if (inferredProvider !== currentConfig.provider) {
                logger.info(`Inferred provider '${inferredProvider}' from model '${model}'`);
            }
            return inferredProvider;
        } catch (_error) {
            errors.push({
                type: 'general',
                message: `Could not infer provider from model '${model}'. Please specify provider explicitly.`,
            });
            return currentConfig.provider; // Fallback to current provider
        }
    }

    // No provider update and no model change - keep current provider
    return currentConfig.provider;
}

function resolveModelProviderCompatibility(
    model: string,
    provider: LLMProvider,
    updates: LLMSwitchInput,
    currentConfig: LLMConfig,
    errors: ValidationError[],
    warnings: string[]
): { finalModel: string; finalProvider: LLMProvider } {
    if (acceptsAnyModel(provider) || isValidProviderModel(provider, model)) {
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
    errors.push({
        type: 'incompatible_model_provider',
        message: `Model '${model}' is not supported for provider '${provider}'. Supported models: ${supportedModels.join(', ')}`,
        provider,
        model,
    });
    return { finalModel: model, finalProvider: provider };
}

function resolveRouter(
    updates: LLMSwitchInput,
    currentConfig: ValidatedLLMConfig,
    provider: LLMProvider,
    errors: ValidationError[],
    warnings: string[]
): 'vercel' | 'in-built' {
    if (updates.router !== undefined) {
        if (!isValidRouter(updates.router)) {
            errors.push({
                type: 'unsupported_router',
                message: 'Router must be either "vercel" or "in-built"',
                router: updates.router,
            });
            return 'vercel';
        }

        if (!isRouterSupportedForProvider(provider, updates.router)) {
            const supportedRouters = getSupportedRoutersForProvider(provider);
            errors.push({
                type: 'unsupported_router',
                message: `Provider '${provider}' does not support '${updates.router}' router. Supported routers: ${supportedRouters.join(', ')}`,
                provider,
                router: updates.router,
            });
            return 'vercel';
        }

        return updates.router;
    }

    // Try to keep current router if compatible with new provider
    if (currentConfig.router && isRouterSupportedForProvider(provider, currentConfig.router)) {
        return currentConfig.router;
    }

    // Current router not supported - find a compatible one
    const supportedRouters = getSupportedRoutersForProvider(provider);
    if (supportedRouters.length === 0) {
        errors.push({
            type: 'unsupported_router',
            message: `Provider '${provider}' is not supported by any router`,
            provider,
        });
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
    updates: LLMSwitchInput,
    currentConfig: LLMConfig,
    provider: string,
    errors: ValidationError[],
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
            errors.push({
                type: 'missing_api_key',
                message: `No API key found for provider '${provider}'. Please set the appropriate environment variable or provide apiKey explicitly.`,
                provider,
            });
            return '';
        }
    } else {
        // Provider unchanged - keep existing API key
        return currentConfig.apiKey;
    }
}

function buildFinalConfig(
    core: { provider: LLMProvider; model: string; router: 'vercel' | 'in-built'; apiKey: string },
    updates: LLMSwitchInput,
    currentConfig: LLMConfig,
    errors: ValidationError[],
    warnings: string[]
): ValidatedLLMConfig {
    // Base URL
    let baseURL: string | undefined;
    if (updates.baseURL !== undefined) {
        if (!supportsBaseURL(core.provider)) {
            errors.push({
                type: 'invalid_base_url',
                message: `Custom baseURL is not supported for ${core.provider} provider`,
                provider: core.provider,
            });
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

    let maxInputTokens: number | undefined;
    if (updates.maxInputTokens !== undefined) {
        if (typeof updates.maxInputTokens !== 'number' || updates.maxInputTokens <= 0) {
            errors.push({
                type: 'invalid_max_tokens',
                message: 'maxInputTokens must be a positive number',
            });
        } else {
            maxInputTokens = updates.maxInputTokens;
        }
    } else {
        const effectiveMaxInputTokens = getEffectiveMaxInputTokens({
            ...core,
            maxIterations: updates.maxIterations ?? currentConfig.maxIterations,
            maxInputTokens: currentConfig.maxInputTokens,
            maxOutputTokens: currentConfig.maxOutputTokens,
            temperature: currentConfig.temperature,
            baseURL: currentConfig.baseURL,
        });
        const modelChanged = core.model !== currentConfig.model;

        if (modelChanged) {
            maxInputTokens = effectiveMaxInputTokens;
            if (
                currentConfig.maxInputTokens &&
                currentConfig.maxInputTokens !== effectiveMaxInputTokens
            ) {
                warnings.push(
                    `Updated maxInputTokens from ${currentConfig.maxInputTokens} to ${effectiveMaxInputTokens} for model '${core.model}'`
                );
            }
        } else {
            maxInputTokens = currentConfig.maxInputTokens || effectiveMaxInputTokens;
        }
    }

    return {
        provider: core.provider,
        model: core.model,
        apiKey: core.apiKey,
        router: core.router,
        maxIterations:
            updates.maxIterations !== undefined
                ? updates.maxIterations
                : currentConfig.maxIterations || 50,
        temperature:
            updates.temperature !== undefined ? updates.temperature : currentConfig.temperature,
        maxOutputTokens:
            updates.maxOutputTokens !== undefined
                ? updates.maxOutputTokens
                : currentConfig.maxOutputTokens,
        ...(baseURL && { baseURL }),
        ...(maxInputTokens && { maxInputTokens }),
    };
}

/**
 * Result type for MCP server validation
 */
export interface McpServerValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: string[];
    config: ValidatedMcpServerConfig | undefined;
}

/**
 * Validate an MCP server configuration and apply schema defaults
 */
export function validateMcpServerConfig(
    serverName: string,
    serverConfig: McpServerConfig,
    existingServerNames: string[] = []
): McpServerValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Validate server name
    if (!serverName || typeof serverName !== 'string' || serverName.trim() === '') {
        errors.push({
            type: 'schema_validation',
            message: 'Server name must be a non-empty string',
            field: 'serverName',
            suggestedAction: 'Provide a valid server name',
        });
    }

    // Validate server config using Zod schema
    try {
        McpServerConfigSchema.parse(serverConfig);
    } catch (error) {
        if (error instanceof ZodError) {
            for (const issue of error.errors) {
                errors.push({
                    type: 'schema_validation',
                    message: `Invalid server configuration: ${issue.message}`,
                    field: issue.path.join('.'),
                    suggestedAction: 'Check the server configuration format and required fields',
                });
            }
        } else {
            errors.push({
                type: 'schema_validation',
                message: `Invalid server configuration: ${error instanceof Error ? error.message : 'Unknown validation error'}`,
                suggestedAction: 'Check the server configuration format and required fields',
            });
        }
    }

    // Additional business logic validation
    if (errors.length === 0) {
        // Check for duplicate server names (case-insensitive)
        const duplicateName = existingServerNames.find(
            (name) => name.toLowerCase() === serverName.toLowerCase() && name !== serverName
        );
        if (duplicateName) {
            warnings.push(
                `Server name '${serverName}' is similar to existing server '${duplicateName}' (case difference only)`
            );
        }

        // Type-specific validation - we know it's valid McpServerConfig at this point
        if (serverConfig.type === 'stdio') {
            if (!serverConfig.command || serverConfig.command.trim() === '') {
                errors.push({
                    type: 'schema_validation',
                    message: 'Stdio server requires a non-empty command',
                    field: 'command',
                    suggestedAction: 'Provide a valid command to execute',
                });
            }
        } else if (serverConfig.type === 'sse' || serverConfig.type === 'http') {
            const url = serverConfig.url;
            if (!url) {
                errors.push({
                    type: 'schema_validation',
                    message: 'URL is required for http/sse server types',
                    field: 'url',
                    suggestedAction: 'Provide a non-empty url string',
                });
            } else {
                try {
                    new URL(url);
                } catch {
                    errors.push({
                        type: 'schema_validation',
                        message: `Invalid URL format: ${url}`,
                        field: 'url',
                        suggestedAction: 'Provide a valid URL with protocol (http:// or https://)',
                    });
                }
            }
        }
    }

    // If validation passed, parse through schema to apply defaults
    let validatedConfig: ValidatedMcpServerConfig | undefined;
    if (errors.length === 0) {
        try {
            validatedConfig = McpServerConfigSchema.parse(serverConfig);
        } catch (schemaError) {
            if (schemaError instanceof ZodError) {
                for (const issue of schemaError.errors) {
                    errors.push({
                        type: 'schema_validation',
                        message: `Schema parsing failed: ${issue.message}`,
                        field: issue.path.join('.'),
                    });
                }
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        config: validatedConfig,
    };
}
