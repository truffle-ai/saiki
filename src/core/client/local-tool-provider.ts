import { ToolSet, Tool } from '../ai/types.js';
import type { IMCPClient } from './types.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { logger } from '../logger/index.js';

/**
 * LocalToolProvider wraps plain JS/TS functions and exposes them via the IMCPClient interface
 * so that they can be registered with MCPManager just like remote MCP servers.
 */
export class LocalToolProvider implements IMCPClient {
    private readonly name: string;
    private readonly functions: Record<string, (...args: any[]) => any>;
    private readonly toolSet: ToolSet;

    constructor(name: string, fns: Record<string, (...args: any[]) => any>) {
        this.name = name;
        this.functions = fns;
        this.toolSet = {};
        Object.keys(fns).forEach((fnName) => {
            const fn = fns[fnName];
            if (fn) {
                this.toolSet[fnName] = {
                    name: fnName,
                    description: this.extractDescription(fn, fnName),
                    parameters: this.inferParameters(fn),
                } as Tool;
            }
        });
    }

    /* -------------------------------------------------- */
    /* IMCPClient minimal implementation                  */
    /* -------------------------------------------------- */

    async connect(): Promise<Client> {
        throw new Error('LocalToolProvider does not support connect()');
    }

    async disconnect(): Promise<void> {
        /* nothing */
    }

    async getTools(): Promise<ToolSet> {
        return this.toolSet;
    }

    async callTool(toolName: string, args: any): Promise<any> {
        const fn = this.functions[toolName];
        if (!fn)
            throw new Error(`Tool '${toolName}' not found in LocalToolProvider '${this.name}'`);
        try {
            return await fn(args);
        } catch (err) {
            logger.error(
                `Local tool '${toolName}' threw error: ${err instanceof Error ? err.message : String(err)}`
            );
            throw err;
        }
    }

    /* ------------------- Optional IMCP capabilities ------------------- */

    async listPrompts(): Promise<string[]> {
        return [];
    }

    async getPrompt(): Promise<any> {
        throw new Error('Prompts not supported by LocalToolProvider');
    }

    async listResources(): Promise<string[]> {
        return [];
    }

    async readResource(): Promise<any> {
        throw new Error('Resources not supported by LocalToolProvider');
    }

    async getConnectedClient(): Promise<Client> {
        throw new Error('LocalToolProvider has no underlying MCP client');
    }

    /**
     * Extract description from function comments or generate a reasonable default
     */
    private extractDescription(fn: Function, fnName: string): string {
        // Try to extract JSDoc comment from function string
        const fnString = fn.toString();
        const jsdocMatch = fnString.match(/\/\*\*\s*\n\s*\*\s*([^*]*?)\s*\n\s*\*/);
        if (jsdocMatch && jsdocMatch[1]) {
            return jsdocMatch[1].trim();
        }

        // Look for single-line comment before function
        const singleLineMatch = fnString.match(/\/\/\s*(.+)/);
        if (singleLineMatch && singleLineMatch[1]) {
            return singleLineMatch[1].trim();
        }

        // Generate default description
        return `Local function tool '${fnName}'`;
    }

    /**
     * Infer parameter schema from function signature
     */
    private inferParameters(fn: Function): any {
        const fnString = fn.toString();

        // Try to extract parameters from function signature
        let paramString = '';

        // First try arrow function pattern
        const arrowMatch = fnString.match(/\(([^)]*)\)\s*=>/);
        if (arrowMatch && arrowMatch[1] !== undefined) {
            paramString = arrowMatch[1];
        } else {
            // Try regular function pattern
            const funcMatch = fnString.match(/function\s*\w*\s*\(([^)]*)\)/);
            if (funcMatch && funcMatch[1] !== undefined) {
                paramString = funcMatch[1];
            }
        }

        if (!paramString) {
            return { type: 'object', properties: {}, required: [] };
        }

        // Handle parameter splitting carefully to avoid splitting inside destructuring patterns
        const params = [];
        let depth = 0;
        let current = '';

        for (let i = 0; i < paramString.length; i++) {
            const char = paramString[i];
            if (char === '{' || char === '[' || char === '(') {
                depth++;
            } else if (char === '}' || char === ']' || char === ')') {
                depth--;
            }

            if (char === ',' && depth === 0) {
                if (current.trim()) {
                    params.push(current.trim());
                }
                current = '';
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            params.push(current.trim());
        }

        if (params.length === 0) {
            return { type: 'object', properties: {}, required: [] };
        }

        // For local tools, we typically expect a single object parameter
        // This is a simple heuristic - in practice, users should provide better schemas
        const properties: any = {};
        const required: string[] = [];

        if (params.length === 1) {
            const param = params[0];
            // Check if it looks like destructured object parameter
            if (param && param.includes('{') && param.includes('}')) {
                // Try to extract property names from destructuring
                const destructureMatch = param.match(/\{([^}]+)\}/);
                if (destructureMatch && destructureMatch[1]) {
                    const props = destructureMatch[1]
                        .split(',')
                        .map((p) => p.trim().split(':')[0]?.trim());
                    props.forEach((propName) => {
                        if (propName && !propName.includes('...')) {
                            properties[propName] = {
                                type: 'string',
                                description: `Parameter ${propName}`,
                            };
                            required.push(propName);
                        }
                    });
                }
            } else {
                // Single parameter, assume it's the whole args object
                properties.args = { type: 'object', description: 'Function arguments' };
                required.push('args');
            }
        } else {
            // Multiple parameters - map them as individual properties
            params.forEach((param, _index) => {
                if (param) {
                    let paramName = param.split('=')[0]?.trim(); // Remove default values
                    paramName = paramName?.split(':')[0]?.trim(); // Remove type annotations
                    if (paramName && !paramName.includes('...')) {
                        properties[paramName] = {
                            type: 'string',
                            description: `Parameter ${paramName}`,
                        };
                        if (!param.includes('=')) {
                            // Required if no default value
                            required.push(paramName);
                        }
                    }
                }
            });
        }

        return {
            type: 'object',
            properties,
            required,
        };
    }
}
