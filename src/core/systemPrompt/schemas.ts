import { z } from 'zod';

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
// Schema for 'file' contributors - includes file-specific configuration
const FileContributorSchema = BaseContributorSchema.extend({
    type: z.literal('file'),
    files: z
        .array(z.string())
        .min(1)
        .describe('Array of file paths to include as context (.md and .txt files)'),
    options: z
        .object({
            includeFilenames: z
                .boolean()
                .optional()
                .default(true)
                .describe('Whether to include the filename as a header for each file'),
            separator: z
                .string()
                .optional()
                .default('\n\n---\n\n')
                .describe('Separator to use between multiple files'),
            errorHandling: z
                .enum(['skip', 'error'])
                .optional()
                .default('skip')
                .describe(
                    'How to handle missing or unreadable files: skip (ignore) or error (throw)'
                ),
            maxFileSize: z
                .number()
                .int()
                .positive()
                .optional()
                .default(100000)
                .describe('Maximum file size in bytes (default: 100KB)'),
            includeMetadata: z
                .boolean()
                .optional()
                .default(false)
                .describe(
                    'Whether to include file metadata (size, modification time) in the context'
                ),
        })
        .strict()
        .optional()
        .default({}),
}).strict();

export const ContributorConfigSchema = z
    .discriminatedUnion(
        'type', // The field to discriminate on
        [StaticContributorSchema, DynamicContributorSchema, FileContributorSchema],
        {
            // Optional: Custom error message for invalid discriminator
            errorMap: (issue, ctx) => {
                if (issue.code === z.ZodIssueCode.invalid_union_discriminator) {
                    return {
                        message: `Invalid contributor type. Expected 'static', 'dynamic', or 'file'.`,
                    };
                }
                return { message: ctx.defaultError };
            },
        }
    )
    .describe(
        "Configuration for a system prompt contributor. Type 'static' requires 'content', type 'dynamic' requires 'source', type 'file' requires 'files'."
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
