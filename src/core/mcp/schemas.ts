import { SaikiErrorCode } from '@core/schemas/errors.js';
import { EnvExpandedString, RequiredEnvURL } from '@core/utils/result.js';
import { z } from 'zod';

// ---- stdio ----

export const StdioServerConfigSchema = z
    .object({
        type: z.literal('stdio'),
        // allow env in command & args if you want; remove EnvExpandedString if not desired
        command: EnvExpandedString(process.env).superRefine((s, ctx) => {
            if (s.length === 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Stdio server requires a non-empty command',
                    params: { code: SaikiErrorCode.MCP_MISSING_COMMAND },
                    path: ['command'],
                });
            }
        }),
        args: z
            .array(EnvExpandedString(process.env))
            .default([])
            .describe("Array of arguments for the command (e.g., ['script.js'])"),
        env: z
            .record(EnvExpandedString(process.env))
            .default({})
            .describe('Optional environment variables for the server process'),
        timeout: z.coerce.number().int().positive().default(30000),
        connectionMode: z.enum(['strict', 'lenient']).default('lenient'),
    })
    .strict();

export type StdioServerConfig = z.input<typeof StdioServerConfigSchema>;
export type ValidatedStdioServerConfig = z.infer<typeof StdioServerConfigSchema>;
// ---- sse ----

export const SseServerConfigSchema = z
    .object({
        type: z.literal('sse'),
        url: RequiredEnvURL(process.env).describe('URL for the SSE server endpoint'),
        headers: z.record(EnvExpandedString(process.env)).default({}),
        timeout: z.coerce.number().int().positive().default(30000),
        connectionMode: z.enum(['strict', 'lenient']).default('lenient'),
    })
    .strict();

export type SseServerConfig = z.input<typeof SseServerConfigSchema>;
export type ValidatedSseServerConfig = z.infer<typeof SseServerConfigSchema>;
// ---- http ----

export const HttpServerConfigSchema = z
    .object({
        type: z.literal('http'),
        url: RequiredEnvURL(process.env).describe('URL for the HTTP server'),
        headers: z.record(EnvExpandedString(process.env)).default({}),
        timeout: z.coerce.number().int().positive().default(30000),
        connectionMode: z.enum(['strict', 'lenient']).default('lenient'),
    })
    .strict();

export type HttpServerConfig = z.input<typeof HttpServerConfigSchema>;
export type ValidatedHttpServerConfig = z.infer<typeof HttpServerConfigSchema>;
// ---- discriminated union ----

export const McpServerConfigSchema = z
    .discriminatedUnion('type', [
        StdioServerConfigSchema,
        SseServerConfigSchema,
        HttpServerConfigSchema,
    ])
    .superRefine((_data, _ctx) => {
        // cross-type business rules if you ever need them
    });

export type McpServerConfig = z.input<typeof McpServerConfigSchema>;
export type ValidatedMcpServerConfig = z.infer<typeof McpServerConfigSchema>;

export const ServerConfigsSchema = z
    .record(McpServerConfigSchema)
    .describe('A dictionary of server configurations, keyed by server name');

export type ServerConfigs = z.input<typeof ServerConfigsSchema>;
export type ValidatedServerConfigs = z.infer<typeof ServerConfigsSchema>;
