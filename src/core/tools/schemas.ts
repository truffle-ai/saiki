import { z } from 'zod';
import { INTERNAL_TOOL_NAMES } from './internal-tools/registry.js';

// Internal tools schema - separate for type derivation

export const InternalToolsSchema = z
    .array(z.enum(INTERNAL_TOOL_NAMES).describe('Available internal tool names'))
    .default([])
    .describe(
        `Array of internal tool names to enable. Empty array = disabled. Available tools: ${INTERNAL_TOOL_NAMES.join(', ')}`
    );
// Derive type from schema

export type InternalToolsConfig = z.infer<typeof InternalToolsSchema>;
