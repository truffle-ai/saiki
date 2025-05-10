import { z } from 'zod';
import {
    getSupportedProviders,
    getSupportedModels,
    isValidProviderModel,
} from '../ai/llm/registry.js';

// Define a base schema for common fields
const baseContributorSchema = z.object({
    id: z.string().describe('Unique identifier for the contributor'),
    priority: z
        .number()
        .describe('Execution priority of the contributor (lower numbers run first)'),
    enabled: z
        .boolean()
        .optional()
        .default(true)
        .describe('Whether this contributor is currently active'),
});

// Schema for 'static' contributors - only includes relevant fields
const staticContributorSchema = baseContributorSchema.extend({
    type: z.literal('static'),
    content: z.string().describe("Static content for the contributor (REQUIRED for 'static')"),
    // No 'source' field here, as it's not relevant to static contributors
});

// Schema for 'dynamic' contributors - only includes relevant fields
const dynamicContributorSchema = baseContributorSchema.extend({
    type: z.literal('dynamic'),
    source: z.string().describe("Source identifier for dynamic content (REQUIRED for 'dynamic')"),
    // No 'content' field here, as it's not relevant to dynamic contributors (source provides the content)
});

// The new contributorConfigSchema using discriminatedUnion
export const contributorConfigSchema = z
    .discriminatedUnion(
        'type', // The field to discriminate on
        [staticContributorSchema, dynamicContributorSchema],
        {
            // Optional: Custom error message for invalid discriminator
            errorMap: (issue, ctx) => {
                if (issue.code === z.ZodIssueCode.invalid_union_discriminator) {
                    return { message: `Invalid contributor type. Expected 'static' or 'dynamic'.` };
                }
                return { message: ctx.defaultError };
            },
        }
    )
    .describe(
        "Configuration for a system prompt contributor. Type 'static' requires 'content', type 'dynamic' requires 'source'."
    );

export type ContributorConfig = z.infer<typeof contributorConfigSchema>;

export const systemPromptConfigSchema = z.object({
    contributors: z
        .array(contributorConfigSchema)
        .describe('An array of contributor configurations that make up the system prompt'),
});

export type SystemPromptConfig = z.infer<typeof systemPromptConfigSchema>;

export const llmConfigSchema = z
    .object({
        provider: z
            .string()
            .nonempty()
            .describe("The LLM provider (e.g., 'openai', 'anthropic', 'groq')"),
        model: z.string().nonempty().describe('The specific model name for the selected provider'),
        systemPrompt: z
            .union([z.string(), systemPromptConfigSchema])
            .describe(
                'The system prompt content as a string, or a structured system prompt configuration'
            ),
        apiKey: z
            .string()
            .optional()
            .describe('API key for the LLM provider (can also be set via environment variables)'),
        maxIterations: z
            .number()
            .int()
            .positive()
            .optional()
            .default(50)
            .describe(
                'Maximum number of iterations for agentic loops or chained LLM calls, defaults to 50'
            ),
        providerOptions: z
            .record(z.any())
            .optional()
            .default({})
            .describe(
                'Additional, provider-specific options (e.g., temperature, top_p), defaults to an empty object'
            ),
        router: z
            .enum(['vercel', 'in-built'])
            .optional()
            .default('vercel')
            .describe('LLM router to use (vercel or in-built), defaults to vercel'),
    })
    .superRefine((data, ctx) => {
        // 1. Provider must be one of the supported list
        const supportedProvidersList = getSupportedProviders();
        if (!supportedProvidersList.includes(data.provider.toLowerCase())) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['provider'],
                message: `Provider '${data.provider}' is not supported. Supported: ${supportedProvidersList.join(', ')}`,
            });
        }
        // 2. Model must be valid for that provider
        // Ensure provider is valid before checking models to avoid errors with getSupportedModels
        if (supportedProvidersList.includes(data.provider.toLowerCase())) {
            const supportedModelsList = getSupportedModels(data.provider);
            if (!isValidProviderModel(data.provider, data.model)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['model'],
                    message: `Model '${data.model}' is not supported for provider '${data.provider}'. Supported: ${supportedModelsList.join(', ')}`,
                });
            }
        }
    });

export type LLMConfig = z.infer<typeof llmConfigSchema>;

// You can add more schemas for AgentConfig, etc., as needed.
// For example:
// export const agentConfigSchema = z.object({ ... });
// export type AgentConfig = z.infer<typeof agentConfigSchema>;

export const stdioServerConfigSchema = z.object({
    type: z.literal('stdio'),
    command: z.string().describe("The shell command to launch the server (e.g., 'node')"),
    args: z.array(z.string()).describe("Array of arguments for the command (e.g., ['script.js'])"),
    env: z
        .record(z.string())
        .optional()
        .default({})
        .describe(
            'Optional environment variables for the server process, defaults to an empty object'
        ),
    timeout: z
        .number()
        .int()
        .positive()
        .optional()
        .default(30000)
        .describe('Timeout in milliseconds for the server connection, defaults to 30000ms'),
});
export type StdioServerConfig = z.infer<typeof stdioServerConfigSchema>;

export const sseServerConfigSchema = z.object({
    type: z.literal('sse'),
    url: z.string().url().describe('URL for the SSE server endpoint'),
    headers: z
        .record(z.string())
        .optional()
        .default({})
        .describe('Optional headers for the SSE connection, defaults to an empty object'),
    timeout: z
        .number()
        .int()
        .positive()
        .optional()
        .default(30000)
        .describe('Timeout in milliseconds for the server connection, defaults to 30000ms'),
});
export type SSEServerConfig = z.infer<typeof sseServerConfigSchema>;

export const httpServerConfigSchema = z.object({
    type: z.literal('http'),
    baseUrl: z.string().url().describe('Base URL for the HTTP server'),
    headers: z
        .record(z.string())
        .optional()
        .default({})
        .describe('Optional headers for HTTP requests, defaults to an empty object'),
    timeout: z
        .number()
        .int()
        .positive()
        .optional()
        .default(30000)
        .describe('Timeout in milliseconds for HTTP requests, defaults to 30000ms'),
});
export type HttpServerConfig = z.infer<typeof httpServerConfigSchema>;

export const mcpServerConfigSchema = z
    .union([stdioServerConfigSchema, sseServerConfigSchema, httpServerConfigSchema])
    .describe('Configuration for an MCP server connection (can be stdio, sse, or http)');
export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>;

export const serverConfigsSchema = z
    .record(mcpServerConfigSchema)
    .refine((obj) => Object.keys(obj).length > 0, {
        message: 'At least one MCP server configuration is required.',
    })
    .describe('A dictionary of server configurations, keyed by server name');
export type ServerConfigs = z.infer<typeof serverConfigsSchema>;

export const agentConfigSchema = z
    .object({
        mcpServers: serverConfigsSchema.describe(
            'Configurations for MCP (Multi-Capability Peer) servers used by the agent'
        ),
        llm: llmConfigSchema.describe('Core LLM configuration for the agent'),
    })
    .describe('Main configuration for an agent, including its LLM and server connections');

export type AgentConfig = z.infer<typeof agentConfigSchema>;
