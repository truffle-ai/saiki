import { z } from 'zod';
import {
    getSupportedProviders,
    getSupportedModels,
    isValidProviderModel,
    getMaxInputTokensForModel,
} from '../ai/llm/registry.js';

// (agent card overrides are now represented as Partial<AgentCard> and processed via AgentCardSchema)

export const AgentCardSchema = z
    .object({
        name: z.string(), // No default, must be provided by context
        description: z
            .string()
            .default(
                'Saiki is an AI assistant capable of chat and task delegation, accessible via multiple protocols.'
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

// Input type for user-facing API (pre-parsing)
export type AgentCard = z.input<typeof AgentCardSchema>;
// Validated type for internal use (post-parsing)
export type ValidatedAgentCard = z.infer<typeof AgentCardSchema>;

// Define a base schema for common fields
const BaseContributorSchema = z
    .object({
        id: z.string().describe('Unique identifier for the contributor'),
        priority: z
            .number()
            .int()
            .nonnegative()
            .describe('Execution priority of the contributor (lower numbers run first)'),
        enabled: z
            .boolean()
            .optional()
            .default(true)
            .describe('Whether this contributor is currently active'),
    })
    .strict();

// Schema for 'static' contributors - only includes relevant fields
const StaticContributorSchema = BaseContributorSchema.extend({
    type: z.literal('static'),
    content: z.string().describe("Static content for the contributor (REQUIRED for 'static')"),
    // No 'source' field here, as it's not relevant to static contributors
}).strict();

// Schema for 'dynamic' contributors - only includes relevant fields
const DynamicContributorSchema = BaseContributorSchema.extend({
    type: z.literal('dynamic'),
    source: z.string().describe("Source identifier for dynamic content (REQUIRED for 'dynamic')"),
    // No 'content' field here, as it's not relevant to dynamic contributors (source provides the content)
}).strict();

export const ContributorConfigSchema = z
    .discriminatedUnion(
        'type', // The field to discriminate on
        [StaticContributorSchema, DynamicContributorSchema],
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

// Input type for user-facing API (pre-parsing)
export type ContributorConfig = z.input<typeof ContributorConfigSchema>;
// Validated type for internal use (post-parsing)
export type ValidatedContributorConfig = z.infer<typeof ContributorConfigSchema>;

export const SystemPromptConfigSchema = z
    .object({
        contributors: z
            .array(ContributorConfigSchema)
            .min(1)
            .describe('An array of contributor configurations that make up the system prompt'),
    })
    .strict();

export type SystemPromptConfig = z.infer<typeof SystemPromptConfigSchema>;

export const LLMConfigSchema = z
    .object({
        provider: z
            .string()
            .nonempty()
            .describe("The LLM provider (e.g., 'openai', 'anthropic', 'google', 'groq')"),
        model: z.string().nonempty().describe('The specific model name for the selected provider'),
        apiKey: z
            .string()
            .min(1)
            .describe(
                'API key for the LLM provider (can also be set via environment variables using $VAR syntax)'
            ),
        maxIterations: z
            .number()
            .int()
            .positive()
            .default(50)
            .describe(
                'Maximum number of iterations for agentic loops or chained LLM calls, defaults to 50'
            ),
        router: z
            .enum(['vercel', 'in-built'])
            .default('vercel')
            .describe('LLM router to use (vercel or in-built), defaults to vercel'),
        baseURL: z
            .string()
            .url()
            .optional()
            .describe(
                'Base URL for the LLM provider (e.g., https://api.openai.com/v1, https://api.anthropic.com/v1). \nCurrently only supported for OpenAI.'
            ),
        maxInputTokens: z
            .number()
            .int()
            .positive()
            .optional()
            .describe(
                'Maximum number of input tokens for conversation history. Used for compression/truncation. Required for unknown models, defaults to maximum value for known models.'
            ),
        maxOutputTokens: z
            .number()
            .int()
            .positive()
            .optional()
            .describe(
                'Maximum number of tokens the LLM can generate in its response. Controls the length of AI responses.'
            ),
        temperature: z
            .number()
            .min(0)
            .max(1)
            .optional()
            .describe(
                'Controls randomness in AI responses. 0 = deterministic, 1 = very creative. Default varies by provider.'
            ),
    })
    .strict()
    .superRefine((data, ctx) => {
        const providerLower = data.provider?.toLowerCase();
        const baseURLIsSet = data.baseURL != null && data.baseURL.trim() !== '';
        const maxInputTokensIsSet = data.maxInputTokens != null;

        // Provider must be one of the supported list
        const supportedProvidersList = getSupportedProviders();
        if (!supportedProvidersList.includes(providerLower)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['provider'],
                message: `Provider '${data.provider}' is not supported. Supported: ${supportedProvidersList.join(', ')}`,
            });
        }

        // When user provides a custom baseURL
        if (baseURLIsSet) {
            // 1. Provider must be set to 'openai'
            if (providerLower !== 'openai') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['provider'],
                    message: "If 'baseURL' is provided, provider must be set to 'openai'",
                });
            }
        }
        // If no base URL
        else {
            // 1. Model must be valid for the provider
            if (supportedProvidersList.includes(providerLower)) {
                const supportedModelsList = getSupportedModels(providerLower);
                if (!isValidProviderModel(providerLower, data.model)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['model'],
                        message: `Model '${data.model}' is not supported for provider '${data.provider}'. Supported: ${supportedModelsList.join(', ')}`,
                    });
                }
            }
            // 2. maxInputTokens must be within the model's limit
            if (maxInputTokensIsSet) {
                try {
                    const registryMaxInputTokens = getMaxInputTokensForModel(
                        providerLower,
                        data.model
                    );
                    // Check maxInputTokens field
                    if (
                        data.maxInputTokens != null &&
                        data.maxInputTokens > registryMaxInputTokens
                    ) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: ['maxInputTokens'],
                            message: `Max input tokens for model '${data.model}' is ${registryMaxInputTokens}. You provided ${data.maxInputTokens}`,
                        });
                    }
                    // Temperature validation is already handled by the Zod schema, so we don't need to validate it here
                } catch (error: any) {
                    // Handle ProviderNotFoundError and ModelNotFoundError specifically
                    if (
                        error.name === 'ProviderNotFoundError' ||
                        error.name === 'ModelNotFoundError'
                    ) {
                        // This scenario should ideally be caught by the earlier provider/model validation checks.
                        // However, if it still occurs, add an issue.
                        // We might not have supportedModelsList here if provider was invalid.
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: ['model'], // Or ['provider', 'model']
                            message: error.message, // The message from our custom error
                        });
                    } else {
                        // For any other unexpected error, rethrow or handle as a generic validation issue
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: [], // General error
                            message: `An unexpected error occurred while validating maxInputTokens: ${error.message}`,
                        });
                    }
                }
            }
        }
    });

// Input type for user-facing API (pre-parsing)
export type LLMConfig = z.input<typeof LLMConfigSchema>;
// Validated type for internal use (post-parsing)
export type ValidatedLLMConfig = z.infer<typeof LLMConfigSchema>;

export const StdioServerConfigSchema = z
    .object({
        type: z.literal('stdio'),
        command: z.string().describe("The shell command to launch the server (e.g., 'node')"),
        args: z
            .array(z.string())
            .describe("Array of arguments for the command (e.g., ['script.js'])"),
        env: z
            .record(z.string())
            .default({})
            .describe(
                'Optional environment variables for the server process, defaults to an empty object'
            ),
        timeout: z
            .number()
            .int()
            .positive()
            .default(30000)
            .describe('Timeout in milliseconds for the server connection, defaults to 30000ms'),
        connectionMode: z
            .enum(['strict', 'lenient'])
            .default('lenient')
            .describe(
                'Connection mode: "strict" requires successful connection, "lenient" allows failures, defaults to "lenient"'
            ),
    })
    .strict();
// Input type for user-facing API (pre-parsing)
export type StdioServerConfig = z.input<typeof StdioServerConfigSchema>;
// Validated type for internal use (post-parsing)
export type ValidatedStdioServerConfig = z.infer<typeof StdioServerConfigSchema>;

export const SseServerConfigSchema = z
    .object({
        type: z.literal('sse'),
        url: z.string().url().describe('URL for the SSE server endpoint'),
        headers: z
            .record(z.string())
            .default({})
            .describe('Optional headers for the SSE connection, defaults to an empty object'),
        timeout: z
            .number()
            .int()
            .positive()
            .default(30000)
            .describe('Timeout in milliseconds for the server connection, defaults to 30000ms'),
        connectionMode: z
            .enum(['strict', 'lenient'])
            .default('lenient')
            .describe(
                'Connection mode: "strict" requires successful connection, "lenient" allows failures, defaults to "lenient"'
            ),
    })
    .strict();
// Input type for user-facing API (pre-parsing)
export type SseServerConfig = z.input<typeof SseServerConfigSchema>;
// Validated type for internal use (post-parsing)
export type ValidatedSseServerConfig = z.infer<typeof SseServerConfigSchema>;

export const HttpServerConfigSchema = z
    .object({
        type: z.literal('http'),
        url: z.string().url().describe('URL for the HTTP server'),
        headers: z
            .record(z.string())
            .default({})
            .describe('Optional headers for HTTP requests, defaults to an empty object'),
        timeout: z
            .number()
            .int()
            .positive()
            .default(30000)
            .describe('Timeout in milliseconds for HTTP requests, defaults to 30000ms'),
        connectionMode: z
            .enum(['strict', 'lenient'])
            .default('lenient')
            .describe(
                'Connection mode: "strict" requires successful connection, "lenient" allows failures, defaults to "lenient"'
            ),
    })
    .strict();
// Input type for user-facing API (pre-parsing)
export type HttpServerConfig = z.input<typeof HttpServerConfigSchema>;
// Validated type for internal use (post-parsing)
export type ValidatedHttpServerConfig = z.infer<typeof HttpServerConfigSchema>;

export const McpServerConfigSchema = z
    .discriminatedUnion(
        'type',
        [StdioServerConfigSchema, SseServerConfigSchema, HttpServerConfigSchema],
        {
            errorMap: (issue, ctx) => {
                if (issue.code === z.ZodIssueCode.invalid_union_discriminator) {
                    return {
                        message: `Invalid server type. Expected 'stdio', 'sse', or 'http'.`,
                    };
                }
                return { message: ctx.defaultError };
            },
        }
    )
    .describe('Configuration for an MCP server connection (can be stdio, sse, or http)');
// Input type for user-facing API (pre-parsing)
export type McpServerConfig = z.input<typeof McpServerConfigSchema>;
// Validated type for internal use (post-parsing)
export type ValidatedMcpServerConfig = z.infer<typeof McpServerConfigSchema>;

export const ServerConfigsSchema = z
    .record(McpServerConfigSchema)
    .describe('A dictionary of server configurations, keyed by server name');
// Input type for user-facing API (pre-parsing)
export type ServerConfigs = z.input<typeof ServerConfigsSchema>;
// Validated type for internal use (post-parsing)
export type ValidatedServerConfigs = z.infer<typeof ServerConfigsSchema>;

// ==== STORAGE CONFIGURATION ====
// Base schema for common connection pool options
const BaseBackendSchema = z.object({
    maxConnections: z.number().int().positive().optional().describe('Maximum connections'),
    idleTimeoutMillis: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Idle timeout in milliseconds'),
    connectionTimeoutMillis: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Connection timeout in milliseconds'),
    options: z.record(z.any()).optional().describe('Backend-specific options'),
});

// Memory backend - minimal configuration
const InMemoryBackendSchema = BaseBackendSchema.extend({
    type: z.literal('in-memory'),
    // In-memory backend doesn't need connection options, but inherits pool options for consistency
}).strict();

export type InMemoryBackendConfig = z.infer<typeof InMemoryBackendSchema>;

// Redis backend configuration
const RedisBackendSchema = BaseBackendSchema.extend({
    type: z.literal('redis'),
    url: z.string().optional().describe('Redis connection URL (redis://...)'),
    host: z.string().optional().describe('Redis host'),
    port: z.number().int().positive().optional().describe('Redis port'),
    password: z.string().optional().describe('Redis password'),
    database: z.number().int().nonnegative().optional().describe('Redis database number'),
}).strict();

export type RedisBackendConfig = z.infer<typeof RedisBackendSchema>;

// SQLite backend configuration
const SqliteBackendSchema = BaseBackendSchema.extend({
    type: z.literal('sqlite'),
    path: z
        .string()
        .optional()
        .describe(
            'SQLite database file path (optional, will auto-detect using path resolver if not provided)'
        ),
    database: z.string().optional().describe('Database filename (default: saiki.db)'),
}).strict();

export type SqliteBackendConfig = z.infer<typeof SqliteBackendSchema>;

// PostgreSQL backend configuration
const PostgresBackendSchema = BaseBackendSchema.extend({
    type: z.literal('postgres'),
    url: z.string().optional().describe('PostgreSQL connection URL (postgresql://...)'),
    connectionString: z.string().optional().describe('PostgreSQL connection string'),
    host: z.string().optional().describe('PostgreSQL host'),
    port: z.number().int().positive().optional().describe('PostgreSQL port'),
    database: z.string().optional().describe('PostgreSQL database name'),
    password: z.string().optional().describe('PostgreSQL password'),
}).strict();

export type PostgresBackendConfig = z.infer<typeof PostgresBackendSchema>;

// Backend configuration using discriminated union
const BackendConfigSchema = z
    .discriminatedUnion(
        'type',
        [InMemoryBackendSchema, RedisBackendSchema, SqliteBackendSchema, PostgresBackendSchema],
        {
            errorMap: (issue, ctx) => {
                if (issue.code === z.ZodIssueCode.invalid_union_discriminator) {
                    return {
                        message: `Invalid backend type. Expected 'in-memory', 'redis', 'sqlite', or 'postgres'.`,
                    };
                }
                return { message: ctx.defaultError };
            },
        }
    )
    .describe('Backend configuration for storage system')
    .superRefine((data, ctx) => {
        // Validate Redis backend requirements
        if (data.type === 'redis') {
            if (!data.url && !data.host) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Redis backend requires either 'url' or 'host' to be specified",
                    path: ['url'],
                });
            }
        }

        // Validate PostgreSQL backend requirements
        if (data.type === 'postgres') {
            if (!data.url && !data.connectionString && !data.host) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message:
                        "PostgreSQL backend requires one of 'url', 'connectionString', or 'host' to be specified",
                    path: ['url'],
                });
            }
        }
    });

export type BackendConfig = z.infer<typeof BackendConfigSchema>;

// Storage configuration with cache and database backends
export const StorageSchema = z
    .object({
        cache: BackendConfigSchema.describe('Cache backend configuration (fast, ephemeral)'),
        database: BackendConfigSchema.describe(
            'Database backend configuration (persistent, reliable)'
        ),
    })
    .strict()
    .describe('Storage configuration with cache and database backends');

export type StorageConfig = z.infer<typeof StorageSchema>;

export const AgentConfigSchema = z
    .object({
        agentCard: AgentCardSchema.describe('Configuration for the agent card').optional(),
        systemPrompt: z
            .union([z.string(), SystemPromptConfigSchema])
            .describe(
                'The system prompt content as a string, or a structured system prompt configuration'
            ),
        mcpServers: ServerConfigsSchema.default({}).describe(
            'Configurations for MCP (Model Context Protocol) servers used by the agent'
        ),
        llm: LLMConfigSchema.describe('Core LLM configuration for the agent'),

        // Storage configuration
        storage: StorageSchema.default({
            cache: { type: 'in-memory' },
            database: { type: 'in-memory' },
        }).describe('Storage configuration for the agent using cache and database backends'),

        sessions: z
            .object({
                maxSessions: z
                    .number()
                    .int()
                    .positive()
                    .default(100)
                    .describe('Maximum number of concurrent sessions allowed, defaults to 100'),
                sessionTTL: z
                    .number()
                    .int()
                    .positive()
                    .default(3600000)
                    .describe(
                        'Session time-to-live in milliseconds, defaults to 3600000ms (1 hour)'
                    ),
            })
            .default({
                maxSessions: 100,
                sessionTTL: 3600000,
            })
            .describe('Session management configuration'),

        toolConfirmation: z
            .object({
                mode: z
                    .enum(['event-based', 'auto-approve', 'auto-deny'])
                    .default('event-based')
                    .describe(
                        'Tool confirmation mode: event-based (interactive), auto-approve (all tools), auto-deny (no tools)'
                    ),
                timeout: z
                    .number()
                    .int()
                    .positive()
                    .default(30000)
                    .describe(
                        'Timeout for tool confirmation requests in milliseconds, defaults to 30000ms (30 seconds)'
                    ),
                allowedToolsStorage: z
                    .enum(['memory', 'storage'])
                    .default('storage')
                    .describe(
                        'Storage type for remembered tool approvals: memory (session-only) or storage (persistent)'
                    ),
            })
            .default({
                mode: 'event-based',
                timeout: 30000,
                allowedToolsStorage: 'storage',
            })
            .describe('Tool confirmation and approval configuration'),
    })
    .strict()
    .describe('Main configuration for an agent, including its LLM and server connections');
// Input type for user-facing API (pre-parsing) - makes fields with defaults optional
export type AgentConfig = z.input<typeof AgentConfigSchema>;
// Validated type for internal use (post-parsing) - all defaults applied
export type ValidatedAgentConfig = z.infer<typeof AgentConfigSchema>;
