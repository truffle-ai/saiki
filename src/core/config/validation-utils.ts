import {
    isValidProviderModel,
    getSupportedRoutersForProvider,
    isRouterSupportedForProvider,
    supportsBaseURL,
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

// ============================================================================
// LLM CONFIGURATION VALIDATION
// ============================================================================

/**
 * Core function that builds and validates an LLM configuration from partial updates.
 * Handles smart transformations (provider inference, API key resolution, fallbacks)
 * then delegates validation to LLMConfigSchema via zodResult helper.
 */
// export async function buildLLMConfig(
//     updates: LLMSwitchInput,
//     currentConfig: ValidatedLLMConfig
// ): Promise<Result<ValidatedLLMConfig, LLMConfigContext>> {
//     const warnings: Issue<LLMConfigContext>[] = [];
//     const smartUpdates: LLMSwitchInput = { ...updates };

//     // 1: Provider inference from model
//     if (
//         !smartUpdates.provider &&
//         smartUpdates.model &&
//         smartUpdates.model !== currentConfig.model
//     ) {
//         if (!acceptsAnyModel(currentConfig.provider)) {
//             try {
//                 smartUpdates.provider = getProviderFromModel(smartUpdates.model);
//             } catch {
//                 /* ignore; schema validation will catch */
//             }
//         }
//     }

//     // 2: API key resolution from environment
//     const finalProvider = smartUpdates.provider || currentConfig.provider;
//     if (!smartUpdates.apiKey && finalProvider !== currentConfig.provider) {
//         const envApiKey = resolveApiKeyForProvider(finalProvider);
//         if (envApiKey) {
//             smartUpdates.apiKey = envApiKey;
//         }
//     }

//     // 3: Router fallback when provider changes
//     if (!smartUpdates.router && finalProvider !== currentConfig.provider) {
//         if (!isRouterSupportedForProvider(finalProvider, currentConfig.router)) {
//             const supportedRouters = getSupportedRoutersForProvider(finalProvider);
//             if (supportedRouters.length > 0) {
//                 smartUpdates.router = supportedRouters.includes('vercel')
//                     ? 'vercel'
//                     : (supportedRouters[0] as 'vercel' | 'in-built');
//                 warnings.push({
//                     code: 'router_fallback',
//                     message: `Switched router to '${smartUpdates.router}' for provider '${finalProvider}'`,
//                     severity: 'warning',
//                     context: { provider: finalProvider, router: smartUpdates.router },
//                 });
//             }
//         }
//     }

//     // 4: Model fallback when provider changes
//     if (
//         !smartUpdates.model &&
//         smartUpdates.provider &&
//         smartUpdates.provider !== currentConfig.provider
//     ) {
//         if (
//             !acceptsAnyModel(smartUpdates.provider) &&
//             !isValidProviderModel(smartUpdates.provider, currentConfig.model)
//         ) {
//             const defaultModel = getDefaultModelForProvider(smartUpdates.provider);
//             if (defaultModel) {
//                 smartUpdates.model = defaultModel;
//                 warnings.push({
//                     code: 'model_fallback',
//                     message: `Switched to default model '${defaultModel}'`,
//                     severity: 'warning',
//                     context: { provider: smartUpdates.provider, model: defaultModel },
//                 });
//             }
//         }
//     }

//     // 5: MaxInputTokens calculation (ensure required field is present)
//     const finalModel = smartUpdates.model || currentConfig.model;
//     if (!smartUpdates.maxInputTokens && !currentConfig.maxInputTokens) {
//         // Calculate because it's missing (required for proper LLM operation)
//         const effectiveMaxInputTokens = getEffectiveMaxInputTokens({
//             ...currentConfig,
//             ...smartUpdates,
//             provider: finalProvider,
//             model: finalModel,
//             apiKey: smartUpdates.apiKey || currentConfig.apiKey,
//         });
//         smartUpdates.maxInputTokens = effectiveMaxInputTokens;
//     }

//     // 6: API key length warning (business logic)
//     const finalApiKey = smartUpdates.apiKey || currentConfig.apiKey;
//     if (finalApiKey && finalApiKey.length < 10) {
//         warnings.push({
//             code: 'short_api_key',
//             message: 'API key seems too short - please verify it is correct',
//             severity: 'warning',
//             context: { provider: finalProvider },
//         });
//     }

//     // 7: Prepare merged config and context
//     const mergedConfig = { ...currentConfig, ...smartUpdates };
//     const context: LLMConfigContext = {
//         provider: mergedConfig.provider,
//         model: mergedConfig.model,
//         router: mergedConfig.router,
//     };

//     // 8: Schema validation first (catches structure + compatibility issues)
//     const validationResult = zodResult(LLMConfigSchema, mergedConfig, context);

//     if (!validationResult.ok) {
//         // Remap schema errors to domain-specific codes where appropriate
//         const mappedIssues = validationResult.issues.map((issue) => {
//             if (issue.message.includes('is not supported for provider')) {
//                 return { ...issue, code: 'incompatible_model_provider' };
//             }
//             if (issue.message.includes('does not support') && issue.message.includes('router')) {
//                 return { ...issue, code: 'unsupported_router' };
//             }
//             if (issue.message.includes('does not support baseURL')) {
//                 return { ...issue, code: 'invalid_base_url' };
//             }
//             return issue; // Keep original for other schema issues
//         });
//         return fail(mappedIssues);
//     }

//     // 9: Business logic validation (after schema passes)
//     const validatedConfig = validationResult.data;

//     // Missing API key validation
//     if (!validatedConfig.apiKey || validatedConfig.apiKey.trim() === '') {
//         return fail([
//             {
//                 code: 'missing_api_key',
//                 message: `No API key found for provider '${validatedConfig.provider}'`,
//                 severity: 'error',
//                 context: {
//                     ...context,
//                     suggestedAction: `Set ${validatedConfig.provider.toUpperCase()}_API_KEY environment variable`,
//                 },
//             },
//         ]);
//     }

//     // Base URL validation (additional check beyond schema)
//     if (validatedConfig.baseURL && !supportsBaseURL(validatedConfig.provider)) {
//         return fail([
//             {
//                 code: 'invalid_base_url',
//                 message: `Custom baseURL is not supported for ${validatedConfig.provider} provider`,
//                 severity: 'error',
//                 context: {
//                     ...context,
//                     suggestedAction: 'Remove baseURL or use openai-compatible provider',
//                 },
//             },
//         ]);
//     }

//     // Max tokens validation (additional check beyond schema)
//     if (validatedConfig.maxInputTokens !== undefined && validatedConfig.maxInputTokens <= 0) {
//         return fail([
//             {
//                 code: 'invalid_max_tokens',
//                 message: 'maxInputTokens must be a positive number',
//                 severity: 'error',
//                 context,
//             },
//         ]);
//     }

//     // Combine schema validation issues + accumulated warnings
//     const allIssues = [...validationResult.issues, ...warnings];
//     return ok(validatedConfig, allIssues);
// }

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
