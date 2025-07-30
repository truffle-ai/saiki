import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { logger } from '../logger/index.js';

/**
 * JSON Schema representation used by MCP tools
 */
export interface JSONSchema {
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
    items?: JSONSchema;
    enum?: any[];
    default?: any;
    description?: string;
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
    minItems?: number;
    maxItems?: number;
    additionalProperties?: JSONSchema | boolean;
    anyOf?: JSONSchema[];
}

/**
 * Converts Zod schemas to JSON Schema format for MCP compatibility
 *
 * Uses the zod-to-json-schema package for robust conversion
 */
export class SchemaConverter {
    /**
     * Convert a Zod schema to JSON Schema
     */
    static zodToJsonSchema(schema: z.ZodSchema): JSONSchema {
        try {
            return zodToJsonSchema(schema) as JSONSchema;
        } catch (error) {
            logger.warn(
                `Failed to convert Zod schema to JSON Schema: ${error instanceof Error ? error.message : String(error)}`
            );
            return {
                type: 'object',
                properties: {},
                required: [],
            };
        }
    }
}
