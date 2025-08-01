// schemas/llm.ts
import { z } from 'zod';
import {
    getSupportedModels,
    isValidProviderModel,
    getMaxInputTokensForModel,
    supportsBaseURL,
    requiresBaseURL,
    acceptsAnyModel,
    isRouterSupportedForProvider,
    getSupportedRoutersForProvider,
    LLM_PROVIDERS,
    LLM_ROUTERS,
} from '../llm/registry.js';
import { NonEmptyTrimmed, OptionalURL, EnvExpandedString } from './helpers.js';
import { SaikiErrorCode } from './errors.js';

/** Core object with structural constraints and normalization */
export const LLMConfigBaseSchema = z
    .object({
        provider: z
            .enum(LLM_PROVIDERS)
            .describe("LLM provider (e.g., 'openai', 'anthropic', 'google', 'groq')"),

        model: NonEmptyTrimmed.describe('Specific model name for the selected provider'),

        // Expand $ENV refs and trim; we still require a non-empty string at this stage.
        apiKey: EnvExpandedString(process.env),

        maxIterations: z.coerce
            .number()
            .int()
            .positive()
            .default(50)
            .describe('Max iterations for agentic loops, default 50'),

        router: z
            .enum(LLM_ROUTERS)
            .default('vercel')
            .describe('Router to use (vercel | in-built), default vercel'),

        baseURL: OptionalURL.describe(
            'Base URL for provider (e.g., https://api.openai.com/v1). Only certain providers support this.'
        ),

        maxInputTokens: z.coerce
            .number()
            .int()
            .positive()
            .optional()
            .describe('Max input tokens for history; required for unknown models'),

        maxOutputTokens: z.coerce
            .number()
            .int()
            .positive()
            .optional()
            .describe('Max tokens for model output'),

        temperature: z.coerce
            .number()
            .min(0)
            .max(1)
            .optional()
            .describe('Randomness: 0 deterministic, 1 creative'),
    })
    .strict();

/** Business rules + compatibility checks */
export const LLMConfigSchema = LLMConfigBaseSchema.superRefine((data, ctx) => {
    const baseURLIsSet = data.baseURL != null && data.baseURL.trim() !== '';
    const maxInputTokensIsSet = data.maxInputTokens != null;

    if (baseURLIsSet) {
        if (!supportsBaseURL(data.provider)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['provider'],
                message:
                    `Provider '${data.provider}' does not support baseURL. ` +
                    `Use an 'openai-compatible' provider if you need a custom base URL.`,
                params: { code: SaikiErrorCode.LLM_INVALID_BASE_URL },
            });
        }
    } else if (requiresBaseURL(data.provider)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['baseURL'],
            message: `Provider '${data.provider}' requires a 'baseURL'.`,
            params: { code: SaikiErrorCode.LLM_MISSING_BASE_URL },
        });
    } else {
        if (!acceptsAnyModel(data.provider)) {
            const supportedModelsList = getSupportedModels(data.provider);
            if (!isValidProviderModel(data.provider, data.model)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['model'],
                    message:
                        `Model '${data.model}' is not supported for provider '${data.provider}'. ` +
                        `Supported: ${supportedModelsList.join(', ')}`,
                    params: { code: SaikiErrorCode.LLM_INCOMPATIBLE_MODEL_PROVIDER },
                });
            }
        }

        if (maxInputTokensIsSet && !acceptsAnyModel(data.provider)) {
            try {
                const cap = getMaxInputTokensForModel(data.provider, data.model);
                if (data.maxInputTokens! > cap) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['maxInputTokens'],
                        message:
                            `Max input tokens for model '${data.model}' is ${cap}. ` +
                            `You provided ${data.maxInputTokens}`,
                        params: { code: SaikiErrorCode.LLM_MAX_INPUT_TOKENS_EXCEEDED },
                    });
                }
            } catch (error: unknown) {
                // TODO: improve this
                const e = error as { name?: string; message?: string };
                const isModelNotFoundError = e?.name === 'ModelNotFoundError';
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['model'],
                    message: e?.message ?? 'Unknown provider/model',
                    params: {
                        code: isModelNotFoundError
                            ? SaikiErrorCode.LLM_UNKNOWN_MODEL
                            : SaikiErrorCode.SCHEMA_VALIDATION,
                    },
                });
            }
        }
    }

    if (!isRouterSupportedForProvider(data.provider, data.router)) {
        const supportedRouters = getSupportedRoutersForProvider(data.provider);
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['router'],
            message:
                `Provider '${data.provider}' does not support router '${data.router}'. ` +
                `Supported: ${supportedRouters.join(', ')}`,
            params: { code: SaikiErrorCode.LLM_UNSUPPORTED_ROUTER },
        });
    }
})
    // Brand the validated type so it can be distinguished at compile time
    .brand<'ValidatedLLMConfig'>();

export type LLMConfigInput = z.input<typeof LLMConfigSchema>;
export type ValidatedLLMConfig = z.infer<typeof LLMConfigSchema>;

// PATCH-like schema for updates (switch flows)
export const LLMUpdatesSchema = LLMConfigBaseSchema.partial().strict();
export type LLMUpdates = z.input<typeof LLMUpdatesSchema>;
