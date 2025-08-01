import {
    isValidProviderModel,
    getSupportedRoutersForProvider,
    isRouterSupportedForProvider,
    getProviderFromModel,
    getDefaultModelForProvider,
    getEffectiveMaxInputTokens,
    acceptsAnyModel,
} from '../llm/registry.js';
import type {
    ValidatedLLMConfig,
    ValidatedMcpServerConfig,
    McpServerConfig,
    LLMSwitchInput,
} from './schemas.js';
import { LLMConfigSchema, McpServerConfigSchema } from './schemas.js';
import { resolveApiKeyForProvider } from '../utils/api-key-resolver.js';
import { logger } from '../logger/index.js';
import { Result, ok, fail, Issue, zodResult } from '../utils/result.js';

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export type LLMConfigContext = {
    provider?: string;
    model?: string;
    router?: string;
    suggestedAction?: string;
};

export type McpServerContext = {
    serverName?: string;
    suggestedAction?: string;
};

// ============================================================================
// LLM CONFIGURATION VALIDATION
// ============================================================================

/**
 * Core function that builds and validates an LLM configuration from partial updates.
 * Handles smart transformations (provider inference, API key resolution, fallbacks)
 * then delegates validation to LLMConfigSchema via zodResult helper.
 */
export async function buildLLMConfig(
    updates: LLMSwitchInput,
    currentConfig: ValidatedLLMConfig
): Promise<Result<ValidatedLLMConfig, LLMConfigContext>> {
    const warnings: Issue<LLMConfigContext>[] = [];
    const smartUpdates: LLMSwitchInput = { ...updates };

    // 1: Provider inference from model
    if (
        !smartUpdates.provider &&
        smartUpdates.model &&
        smartUpdates.model !== currentConfig.model
    ) {
        if (!acceptsAnyModel(currentConfig.provider)) {
            try {
                smartUpdates.provider = getProviderFromModel(smartUpdates.model);
            } catch {
                /* ignore; schema validation will catch */
            }
        }
    }

    // 2: API key resolution from environment
    const finalProvider = smartUpdates.provider || currentConfig.provider;
    if (!smartUpdates.apiKey && finalProvider !== currentConfig.provider) {
        const envApiKey = resolveApiKeyForProvider(finalProvider);
        if (envApiKey) {
            smartUpdates.apiKey = envApiKey;
        }
    }

    // 3: Router fallback when provider changes
    if (!smartUpdates.router && finalProvider !== currentConfig.provider) {
        if (!isRouterSupportedForProvider(finalProvider, currentConfig.router)) {
            const supportedRouters = getSupportedRoutersForProvider(finalProvider);
            if (supportedRouters.length > 0) {
                smartUpdates.router = supportedRouters.includes('vercel')
                    ? 'vercel'
                    : (supportedRouters[0] as 'vercel' | 'in-built');
                warnings.push({
                    code: 'router_fallback',
                    message: `Switched router to '${smartUpdates.router}' for provider '${finalProvider}'`,
                    severity: 'warning',
                    context: { provider: finalProvider, router: smartUpdates.router },
                });
            }
        }
    }

    // 4: Model fallback when provider changes
    if (
        !smartUpdates.model &&
        smartUpdates.provider &&
        smartUpdates.provider !== currentConfig.provider
    ) {
        if (
            !acceptsAnyModel(smartUpdates.provider) &&
            !isValidProviderModel(smartUpdates.provider, currentConfig.model)
        ) {
            const defaultModel = getDefaultModelForProvider(smartUpdates.provider);
            if (defaultModel) {
                smartUpdates.model = defaultModel;
                warnings.push({
                    code: 'model_fallback',
                    message: `Switched to default model '${defaultModel}'`,
                    severity: 'warning',
                    context: { provider: smartUpdates.provider, model: defaultModel },
                });
            }
        }
    }

    // 5: MaxInputTokens recalculation when model changes
    const finalModel = smartUpdates.model || currentConfig.model;
    if (!smartUpdates.maxInputTokens && finalModel !== currentConfig.model) {
        const effectiveMaxInputTokens = getEffectiveMaxInputTokens({
            ...currentConfig,
            ...smartUpdates,
            provider: finalProvider,
            model: finalModel,
            apiKey: smartUpdates.apiKey || currentConfig.apiKey,
        });
        smartUpdates.maxInputTokens = effectiveMaxInputTokens;
    }

    // 6: Merge with current and validate via zodResult helper
    const mergedConfig = { ...currentConfig, ...smartUpdates };
    const context: LLMConfigContext = {
        provider: mergedConfig.provider,
        model: mergedConfig.model,
        router: mergedConfig.router,
    };

    const validationResult = zodResult(LLMConfigSchema, mergedConfig, context);

    if (!validationResult.ok) {
        return validationResult as Result<ValidatedLLMConfig, LLMConfigContext>;
    }

    // Combine schema validation issues + accumulated warnings
    const allIssues = [...validationResult.issues, ...warnings];
    return ok(validationResult.data as ValidatedLLMConfig, allIssues);
}

// ============================================================================
// MCP SERVER CONFIGURATION VALIDATION
// ============================================================================

/**
 * Validate an MCP server configuration and apply schema defaults
 */
export function validateMcpServerConfig(
    serverName: string,
    serverConfig: McpServerConfig,
    existingServerNames: string[] = []
): Result<ValidatedMcpServerConfig, McpServerContext> {
    const issues: Issue<McpServerContext>[] = [];
    const context: McpServerContext = { serverName };

    // Validate server name
    if (!serverName || typeof serverName !== 'string' || serverName.trim() === '') {
        return fail([
            {
                code: 'schema_validation',
                message: 'Server name must be a non-empty string',
                path: 'serverName',
                context: { serverName, suggestedAction: 'Provide a valid server name' },
            },
        ]);
    }

    // Use zodResult for schema validation
    const schemaResult = zodResult(McpServerConfigSchema, serverConfig, context);

    if (!schemaResult.ok) {
        return schemaResult as Result<ValidatedMcpServerConfig, McpServerContext>;
    }

    // Additional business logic validation
    const duplicateName = existingServerNames.find(
        (name) => name.toLowerCase() === serverName.toLowerCase() && name !== serverName
    );
    if (duplicateName) {
        issues.push({
            code: 'duplicate_name',
            message: `Server name '${serverName}' is similar to existing server '${duplicateName}' (case difference only)`,
            severity: 'warning',
            context: { serverName },
        });
    }

    // Type-specific validation - we know it's valid McpServerConfig at this point
    if (serverConfig.type === 'stdio') {
        if (!serverConfig.command || serverConfig.command.trim() === '') {
            return fail([
                {
                    code: 'schema_validation',
                    message: 'Stdio server requires a non-empty command',
                    path: 'command',
                    context: { serverName, suggestedAction: 'Provide a valid command to execute' },
                },
            ]);
        }
    } else if (serverConfig.type === 'sse' || serverConfig.type === 'http') {
        const url = serverConfig.url;
        if (!url) {
            return fail([
                {
                    code: 'schema_validation',
                    message: 'URL is required for http/sse server types',
                    path: 'url',
                    context: { serverName, suggestedAction: 'Provide a non-empty url string' },
                },
            ]);
        } else {
            try {
                new URL(url);
            } catch {
                return fail([
                    {
                        code: 'schema_validation',
                        message: `Invalid URL format: ${url}`,
                        path: 'url',
                        context: {
                            serverName,
                            suggestedAction:
                                'Provide a valid URL with protocol (http:// or https://)',
                        },
                    },
                ]);
            }
        }
    }

    // Combine schema validation issues + business logic warnings
    const allIssues = [...schemaResult.issues, ...issues];
    return ok(schemaResult.data as ValidatedMcpServerConfig, allIssues);
}
