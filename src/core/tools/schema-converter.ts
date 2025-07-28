import { z } from 'zod';
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
 * Handles common Zod types used in tool definitions
 */
export class SchemaConverter {
    /**
     * Convert a Zod schema to JSON Schema
     */
    static zodToJsonSchema(schema: z.ZodSchema): JSONSchema {
        try {
            return SchemaConverter.convertZodType(schema);
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

    private static convertZodType(schema: z.ZodSchema): JSONSchema {
        const def = schema._def as any;

        // Handle ZodObject
        if (def.typeName === 'ZodObject') {
            const properties: Record<string, JSONSchema> = {};
            const required: string[] = [];

            for (const [key, value] of Object.entries(def.shape())) {
                properties[key] = SchemaConverter.convertZodType(value as z.ZodSchema);

                // Check if field is required (not optional)
                if (!(value as any).isOptional()) {
                    required.push(key);
                }
            }

            const result: JSONSchema = {
                type: 'object',
                properties,
            };

            if (required.length > 0) {
                result.required = required;
            }

            return result;
        }

        // Handle ZodString
        if (def.typeName === 'ZodString') {
            const result: JSONSchema = { type: 'string' };

            if (def.description) {
                result.description = def.description;
            }

            // Handle string enums
            if (def.checks) {
                for (const check of def.checks) {
                    if (check.kind === 'min') {
                        result.minLength = check.value;
                    } else if (check.kind === 'max') {
                        result.maxLength = check.value;
                    }
                }
            }

            return result;
        }

        // Handle ZodNumber
        if (def.typeName === 'ZodNumber') {
            const result: JSONSchema = { type: 'number' };

            if (def.description) {
                result.description = def.description;
            }

            if (def.checks) {
                for (const check of def.checks) {
                    if (check.kind === 'min') {
                        result.minimum = check.value;
                    } else if (check.kind === 'max') {
                        result.maximum = check.value;
                    } else if (check.kind === 'int') {
                        result.type = 'integer';
                    }
                }
            }

            return result;
        }

        // Handle ZodBoolean
        if (def.typeName === 'ZodBoolean') {
            const result: JSONSchema = { type: 'boolean' };

            if (def.description) {
                result.description = def.description;
            }

            return result;
        }

        // Handle ZodArray
        if (def.typeName === 'ZodArray') {
            const result: JSONSchema = {
                type: 'array',
                items: SchemaConverter.convertZodType(def.type),
            };

            if (def.description) {
                result.description = def.description;
            }

            if (def.minLength !== null) {
                result.minItems = def.minLength;
            }

            if (def.maxLength !== null) {
                result.maxItems = def.maxLength;
            }

            return result;
        }

        // Handle ZodEnum
        if (def.typeName === 'ZodEnum') {
            const result: JSONSchema = {
                type: 'string',
                enum: def.values,
            };

            if (def.description) {
                result.description = def.description;
            }

            return result;
        }

        // Handle ZodLiteral
        if (def.typeName === 'ZodLiteral') {
            const result: JSONSchema = {
                type: typeof def.value,
                enum: [def.value],
            };

            if (def.description) {
                result.description = def.description;
            }

            return result;
        }

        // Handle ZodOptional
        if (def.typeName === 'ZodOptional') {
            return SchemaConverter.convertZodType(def.innerType);
        }

        // Handle ZodDefault
        if (def.typeName === 'ZodDefault') {
            const result = SchemaConverter.convertZodType(def.innerType);
            result.default = def.defaultValue();
            return result;
        }

        // Handle ZodUnion
        if (def.typeName === 'ZodUnion') {
            const anyOfSchemas = def.options.map((option: any) =>
                SchemaConverter.convertZodType(option)
            );
            return {
                anyOf: anyOfSchemas,
            };
        }

        // Handle ZodRecord
        if (def.typeName === 'ZodRecord') {
            const result: JSONSchema = {
                type: 'object',
                additionalProperties: def.valueType
                    ? SchemaConverter.convertZodType(def.valueType)
                    : { type: 'string' },
            };

            if (def.description) {
                result.description = def.description;
            }

            return result;
        }

        // Handle ZodAny
        if (def.typeName === 'ZodAny') {
            return {
                type: 'object',
                description: def.description || 'Any type',
            };
        }

        // Fallback for unsupported types
        logger.debug(`Unsupported Zod type: ${def.typeName}, falling back to object`);
        return {
            type: 'object',
            description: def.description || `Unsupported type: ${def.typeName}`,
        };
    }
}
