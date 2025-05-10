import { z } from 'zod';
import type { LLMConfig, AgentConfig, ContributorConfig, SystemPromptConfig } from './types.js';
import { SchemaFromInterface } from '../utils/zod.js';
import {
    getSupportedProviders,
    getSupportedModels,
    isValidProviderModel,
} from '../ai/llm/registry.js';

export const contributorConfigSchema = z.object({
    id: z.string(),
    type: z.union([z.literal('static'), z.literal('dynamic')]),
    priority: z.number(),
    enabled: z.boolean().optional(),
    content: z.string().optional(),
    source: z.string().optional(),
}) satisfies SchemaFromInterface<ContributorConfig>;

export const systemPromptConfigSchema = z.object({
    contributors: z.array(contributorConfigSchema),
});

// NOTE: We cannot use SchemaFromInterface here because the 'systemPrompt' property is a union type (string | SystemPromptConfig),
// which is not supported by the mapped type utility. This schema must be maintained separately from the LLMConfig interface.
export const llmConfigSchema = z
    .object({
        provider: z.string(),
        model: z.string(),
        systemPrompt: z.union([z.string(), systemPromptConfigSchema]),
        apiKey: z.string().optional(),
        maxIterations: z.number().optional(),
        providerOptions: z.record(z.any()).optional(),
        router: z.any().optional(),
    })
    .superRefine((data, ctx) => {
        // 1. Provider must be one of the supported list
        const supportedProviders = getSupportedProviders();
        if (!supportedProviders.includes(data.provider.toLowerCase())) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['provider'],
                message: `Provider '${data.provider}' is not supported. Supported: ${supportedProviders.join(', ')}`,
            });
        }
        // 2. Model must be valid for that provider
        const supportedModels = getSupportedModels(data.provider);
        if (!isValidProviderModel(data.provider, data.model)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['model'],
                message: `Model '${data.model}' is not supported for provider '${data.provider}'. Supported: ${supportedModels.join(', ')}`,
            });
        }
    });

// (agent card overrides are now represented as Partial<AgentCard> and processed via AgentCardSchema)

export const AgentCardSchema = z
    .object({
        name: z.string(), // No default, must be provided by context
        description: z
            .string()
            .default(
                'Alfred is an AI assistant capable of chat and task delegation, accessible via multiple protocols.'
            ),
        url: z.string().url(), // No default, must be provided by context
        provider: z
            .object({
                organization: z.string(),
                url: z.string().url(),
            })
            .optional(), // Remains optional, undefined if not provided
        version: z.string(), // No default, must be provided by context
        documentationUrl: z.string().url().optional(), // Remains optional, undefined if not provided
        capabilities: z
            .object({
                streaming: z.boolean().optional().default(true),
                pushNotifications: z.boolean().optional(), // Default is context-dependent (webSubscriber)
                stateTransitionHistory: z.boolean().optional().default(false),
            })
            .strict()
            .default({}), // Add default for the capabilities object itself
        authentication: z
            .object({
                schemes: z.array(z.string()).default([]),
                credentials: z.string().optional(), // Remains optional
            })
            .strict()
            .default({}), // Add default for the authentication object itself
        defaultInputModes: z.array(z.string()).default(['application/json', 'text/plain']),
        defaultOutputModes: z
            .array(z.string())
            .default(['application/json', 'text/event-stream', 'text/plain']),
        skills: z
            .array(
                z.object({
                    id: z.string(),
                    name: z.string(),
                    description: z.string(),
                    tags: z.array(z.string()),
                    examples: z.array(z.string()).optional(),
                    inputModes: z.array(z.string()).optional().default(['text/plain']),
                    outputModes: z.array(z.string()).optional().default(['text/plain']),
                })
            )
            .default([
                {
                    id: 'chat_with_agent',
                    name: 'chat_with_agent',
                    description: 'Allows you to chat with an AI agent. Send a message to interact.',
                    tags: ['chat', 'AI', 'assistant', 'mcp', 'natural language'],
                    examples: [
                        `Send a JSON-RPC request to /mcp with method: "chat_with_agent" and params: {"message":"Your query..."}`,
                        'Alternatively, use a compatible MCP client library.',
                    ],
                    // inputModes and outputModes will use their own defaults if not specified here
                },
            ]),
    })
    .strict();
