import { createTool } from '@truffle-ai/saiki';
import { z } from 'zod';

/**
 * Math tools using the new clean API
 */

export const addTool = createTool({
    id: 'add',
    description: 'Adds two numbers together',
    inputSchema: z.object({
        a: z.number().describe('First number to add'),
        b: z.number().describe('Second number to add'),
    }),
    execute: async ({ a, b }) => {
        const result = a + b;
        return {
            result,
            operation: 'addition',
            inputs: [a, b],
        };
    },
    metadata: {
        category: 'math',
        tags: ['math', 'calculator', 'addition'],
    },
});

export const powerTool = createTool({
    id: 'power',
    description: 'Raises a number to a specified power',
    inputSchema: z.object({
        base: z.number().describe('Base number'),
        exponent: z.number().describe('Exponent'),
    }),
    execute: async ({ base, exponent }) => {
        const result = Math.pow(base, exponent);
        return {
            result,
            operation: 'exponentiation',
            base,
            exponent,
        };
    },
    metadata: {
        category: 'math',
        tags: ['math', 'power', 'exponent'],
    },
});

export const randomTool = createTool({
    id: 'random',
    description: 'Generates a random number between min and max',
    inputSchema: z.object({
        min: z.number().default(0).describe('Minimum value (inclusive)'),
        max: z.number().default(1).describe('Maximum value (exclusive)'),
    }),
    execute: async ({ min = 0, max = 1 }) => {
        const result = Math.random() * (max - min) + min;
        return {
            result,
            operation: 'random_generation',
            range: { min, max },
        };
    },
    metadata: {
        category: 'math',
        tags: ['math', 'random', 'generator'],
    },
});

// Export all tools as an array for easy registration
export const mathTools = [addTool, powerTool, randomTool];
