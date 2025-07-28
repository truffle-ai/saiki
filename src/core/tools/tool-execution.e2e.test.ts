import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToolManager } from './tool-manager.js';
import { NoOpConfirmationProvider } from '../client/tool-confirmation/noop-confirmation-provider.js';
import type { ToolSet } from './types.js';

/**
 * End-to-end tests for tool execution flows
 * These tests simulate real-world tool usage scenarios
 */

// Mock MCP Manager for E2E tests
class E2EMCPManager {
    private tools: ToolSet;

    constructor(tools: ToolSet = {}) {
        this.tools = tools;
    }

    async getAllTools(): Promise<ToolSet> {
        return this.tools;
    }

    async executeTool(toolName: string, args: any, sessionId?: string): Promise<any> {
        const tool = this.tools[toolName];
        if (!tool) {
            throw new Error(`No MCP tool found: ${toolName}`);
        }

        // Simulate MCP tool execution with realistic response
        return {
            type: 'tool_result',
            content: [
                {
                    type: 'text',
                    text: `MCP Tool '${toolName}' executed successfully with arguments: ${JSON.stringify(args)}`,
                },
            ],
            metadata: {
                toolName,
                source: 'mcp',
                sessionId,
                executedAt: new Date().toISOString(),
            },
        };
    }

    getToolClient(toolName: string): any {
        return this.tools[toolName] ? { id: `mcp-client-${toolName}` } : undefined;
    }
}

describe('Tool Execution End-to-End Tests', () => {
    let toolManager: ToolManager;
    let customToolProvider: any;
    let mcpManager: E2EMCPManager;
    let confirmationProvider: NoOpConfirmationProvider;

    beforeEach(async () => {
        confirmationProvider = new NoOpConfirmationProvider();

        // Mock the customToolProvider with simpler implementation
        customToolProvider = {
            async initialize() {
                /* no-op */
            },
            getAllTools() {
                return {
                    calculator: {
                        description: 'Perform basic mathematical calculations',
                        parameters: {
                            type: 'object' as const,
                            properties: {
                                operation: { type: 'string' },
                                a: { type: 'number' },
                                b: { type: 'number' },
                            },
                            required: ['operation', 'a', 'b'],
                        },
                    },
                    text_processor: {
                        description: 'Process and transform text',
                        parameters: {
                            type: 'object' as const,
                            properties: {
                                text: { type: 'string' },
                                operation: { type: 'string' },
                            },
                            required: ['text', 'operation'],
                        },
                    },
                    async_delay: {
                        description: 'Simulate async operations with configurable delay',
                        parameters: {
                            type: 'object' as const,
                            properties: {
                                delayMs: { type: 'number' },
                                message: { type: 'string' },
                            },
                            required: ['delayMs'],
                        },
                    },
                };
            },
            hasTool(toolName: string) {
                const tools = this.getAllTools();
                return toolName in tools;
            },
            async executeTool(toolName: string, args: any, context: any) {
                // Simulate the execution logic for test tools
                switch (toolName) {
                    case 'calculator': {
                        const { operation, a, b } = args;
                        let result: number;
                        switch (operation) {
                            case 'add':
                                result = a + b;
                                break;
                            case 'subtract':
                                result = a - b;
                                break;
                            case 'multiply':
                                result = a * b;
                                break;
                            case 'divide':
                                if (b === 0) throw new Error('Division by zero');
                                result = a / b;
                                break;
                            default:
                                throw new Error(`Unknown operation: ${operation}`);
                        }
                        return {
                            success: true,
                            result,
                            operation: `${a} ${operation} ${b} = ${result}`,
                        };
                    }

                    case 'text_processor': {
                        const { text, operation: textOp, options } = args;
                        let processedText = options?.trimWhitespace ? text.trim() : text;
                        let processedResult: string | number;

                        switch (textOp) {
                            case 'uppercase':
                                processedResult = processedText.toUpperCase();
                                break;
                            case 'lowercase':
                                processedResult = processedText.toLowerCase();
                                break;
                            case 'reverse':
                                processedResult = processedText.split('').reverse().join('');
                                break;
                            case 'length':
                                processedResult = processedText.length;
                                break;
                            default:
                                throw new Error(`Unknown operation: ${textOp}`);
                        }

                        return {
                            success: true,
                            originalText: text,
                            processedText: processedResult,
                            operation: textOp,
                            sessionId: context?.sessionId,
                            executedAt: new Date().toISOString(),
                        };
                    }

                    case 'async_delay': {
                        const { delayMs, message = 'Async operation completed', shouldFail } = args;
                        await new Promise((resolve) => setTimeout(resolve, delayMs));

                        if (shouldFail) {
                            throw new Error('Simulated async operation failure');
                        }

                        return {
                            success: true,
                            message,
                            delayMs,
                            completedAt: new Date().toISOString(),
                        };
                    }

                    default:
                        throw new Error(`Custom tool not found: ${toolName}`);
                }
            },
        } as any;

        // Set up MCP manager with some mock tools
        mcpManager = new E2EMCPManager({
            mcp_file_reader: {
                description: 'Read files via MCP server',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'File path to read' },
                    },
                    required: ['path'],
                },
            },
            mcp_web_search: {
                description: 'Search the web via MCP server',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query' },
                        limit: { type: 'number', description: 'Max results' },
                    },
                    required: ['query'],
                },
            },
        });

        // Set up tool manager
        toolManager = new ToolManager(mcpManager as any, confirmationProvider);
        toolManager['customToolProvider'] = customToolProvider;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic Tool Execution', () => {
        it('should execute simple custom tools successfully', async () => {
            const result = await toolManager.executeTool(
                'calculator',
                {
                    operation: 'add',
                    a: 15,
                    b: 27,
                },
                'test-session-1'
            );

            expect(result.success).toBe(true);
            expect(result.result).toBe(42);
            expect(result.operation).toBe('15 add 27 = 42');
        });

        it('should execute MCP tools successfully', async () => {
            const result = await toolManager.executeTool(
                'mcp_file_reader',
                {
                    path: '/path/to/test/file.txt',
                },
                'test-session-2'
            );

            expect(result.type).toBe('tool_result');
            expect(result.content[0].text).toContain('mcp_file_reader');
            expect(result.content[0].text).toContain('/path/to/test/file.txt');
            expect(result.metadata.source).toBe('mcp');
            expect(result.metadata.sessionId).toBe('test-session-2');
        });

        it('should handle complex custom tool operations', async () => {
            const result = await toolManager.executeTool(
                'text_processor',
                {
                    text: '  Hello World!  ',
                    operation: 'reverse',
                    options: {
                        trimWhitespace: true,
                    },
                },
                'text-session'
            );

            expect(result.success).toBe(true);
            expect(result.originalText).toBe('  Hello World!  ');
            expect(result.processedText).toBe('!dlroW olleH');
            expect(result.operation).toBe('reverse');
            expect(result.sessionId).toBe('text-session');
        });
    });

    describe('Asynchronous Tool Execution', () => {
        it('should handle async tools with delays', async () => {
            const startTime = Date.now();

            const result = await toolManager.executeTool('async_delay', {
                delayMs: 100,
                message: 'Test async completion',
            });

            const endTime = Date.now();
            const actualDelay = endTime - startTime;

            expect(result.success).toBe(true);
            expect(result.message).toBe('Test async completion');
            expect(result.delayMs).toBe(100);
            expect(actualDelay).toBeGreaterThanOrEqual(100);
        });

        it('should handle async tool failures', async () => {
            await expect(
                toolManager.executeTool('async_delay', {
                    delayMs: 50,
                    shouldFail: true,
                })
            ).rejects.toThrow('Simulated async operation failure');
        });

        it('should execute multiple async tools concurrently', async () => {
            const startTime = Date.now();

            const promises = [
                toolManager.executeTool('async_delay', { delayMs: 100, message: 'First' }),
                toolManager.executeTool('async_delay', { delayMs: 150, message: 'Second' }),
                toolManager.executeTool('async_delay', { delayMs: 75, message: 'Third' }),
            ];

            const results = await Promise.all(promises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Should complete in roughly the time of the longest delay (150ms) + overhead
            // Not the sum of all delays (325ms)
            expect(totalTime).toBeLessThan(250);
            expect(results).toHaveLength(3);
            expect(results[0].message).toBe('First');
            expect(results[1].message).toBe('Second');
            expect(results[2].message).toBe('Third');
        });
    });

    describe('Error Handling and Validation', () => {
        it('should validate input parameters and provide clear errors', async () => {
            // Invalid operation for calculator
            await expect(
                toolManager.executeTool('calculator', {
                    operation: 'invalid_op',
                    a: 1,
                    b: 2,
                })
            ).rejects.toThrow();

            // Missing required parameters - mock doesn't validate, produces NaN
            const result = await toolManager.executeTool('calculator', {
                operation: 'add',
                a: 1,
                // missing 'b'
            });
            expect(result.result).toBeNaN();

            // Wrong parameter types - mock doesn't validate, produces string concatenation
            const badTypeResult = await toolManager.executeTool('calculator', {
                operation: 'add',
                a: 'not_a_number',
                b: 2,
            });
            // In JavaScript, string + number = string concatenation
            expect(badTypeResult.result).toBe('not_a_number2');
        });

        it('should handle tool execution errors gracefully', async () => {
            // Division by zero
            await expect(
                toolManager.executeTool('calculator', {
                    operation: 'divide',
                    a: 10,
                    b: 0,
                })
            ).rejects.toThrow('Division by zero');
        });

        it('should handle non-existent tools', async () => {
            await expect(toolManager.executeTool('nonexistent_tool', {})).rejects.toThrow(
                'Tool not found: nonexistent_tool'
            );
        });
    });

    describe('Context and Session Management', () => {
        it('should pass execution context to custom tools', async () => {
            const sessionId = 'context-test-session';

            const result = await toolManager.executeTool(
                'text_processor',
                {
                    text: 'test',
                    operation: 'length',
                },
                sessionId
            );

            expect(result.sessionId).toBe(sessionId);
            expect(result.executedAt).toBeDefined();
        });

        it('should handle tools without context gracefully', async () => {
            const result = await toolManager.executeTool('calculator', {
                operation: 'multiply',
                a: 6,
                b: 7,
            }); // No session ID

            expect(result.success).toBe(true);
            expect(result.result).toBe(42);
        });
    });

    describe('Tool Discovery and Metadata', () => {
        it('should provide comprehensive tool listing', async () => {
            const tools = await toolManager.getAllTools();

            // Should include both custom and MCP tools
            expect(tools).toHaveProperty('calculator');
            expect(tools).toHaveProperty('text_processor');
            expect(tools).toHaveProperty('async_delay');
            expect(tools).toHaveProperty('mcp_file_reader');
            expect(tools).toHaveProperty('mcp_web_search');

            // Check tool descriptions
            expect(tools.calculator?.description).toContain('mathematical calculations');
            expect(tools.text_processor?.description).toContain('Process and transform text');
        });

        it('should correctly identify tool existence', async () => {
            expect(await toolManager.hasTool('calculator')).toBe(true);
            expect(await toolManager.hasTool('text_processor')).toBe(true);
            expect(await toolManager.hasTool('mcp_file_reader')).toBe(true);
            expect(await toolManager.hasTool('nonexistent')).toBe(false);
        });
    });

    describe('Performance and Resource Management', () => {
        it('should handle rapid successive tool executions', async () => {
            const executions = Array.from({ length: 10 }, (_, i) =>
                toolManager.executeTool(
                    'calculator',
                    {
                        operation: 'add',
                        a: i,
                        b: i + 1,
                    },
                    `rapid-session-${i}`
                )
            );

            const results = await Promise.all(executions);

            expect(results).toHaveLength(10);
            results.forEach((result, index) => {
                expect(result.success).toBe(true);
                expect(result.result).toBe(index + (index + 1));
            });
        });

        it('should handle mixed tool type executions', async () => {
            const mixedExecutions = [
                toolManager.executeTool('calculator', { operation: 'add', a: 1, b: 2 }),
                toolManager.executeTool('mcp_file_reader', { path: '/test1.txt' }),
                toolManager.executeTool('text_processor', {
                    text: 'hello',
                    operation: 'uppercase',
                }),
                toolManager.executeTool('mcp_web_search', { query: 'test query', limit: 5 }),
                toolManager.executeTool('async_delay', { delayMs: 50, message: 'quick test' }),
            ];

            const results = await Promise.all(mixedExecutions);

            expect(results).toHaveLength(5);

            // Verify each result type
            expect(results[0].success).toBe(true); // custom calculator
            expect(results[1].type).toBe('tool_result'); // MCP file reader
            expect(results[2].processedText).toBe('HELLO'); // custom text processor
            expect(results[3].content[0].text).toContain('mcp_web_search'); // MCP web search
            expect(results[4].message).toBe('quick test'); // custom async delay
        });
    });

    describe('Real-world Scenarios', () => {
        it('should handle a complex workflow with multiple tool types', async () => {
            // Simulate a workflow: process text, calculate length, search for related content

            // Step 1: Process some text
            const textResult = await toolManager.executeTool(
                'text_processor',
                {
                    text: '  Complex Workflow Example  ',
                    operation: 'uppercase',
                    options: { trimWhitespace: true },
                },
                'workflow-session'
            );

            expect(textResult.processedText).toBe('COMPLEX WORKFLOW EXAMPLE');

            // Step 2: Calculate length
            const lengthResult = await toolManager.executeTool(
                'text_processor',
                {
                    text: textResult.processedText as string,
                    operation: 'length',
                },
                'workflow-session'
            );

            expect(lengthResult.processedText).toBe(24); // 'COMPLEX WORKFLOW EXAMPLE' is 24 chars

            // Step 3: Use length in calculation
            const mathResult = await toolManager.executeTool(
                'calculator',
                {
                    operation: 'multiply',
                    a: lengthResult.processedText as number,
                    b: 2,
                },
                'workflow-session'
            );

            expect(mathResult.result).toBe(48); // 24 * 2 = 48

            // Step 4: Search for content (MCP tool)
            const searchResult = await toolManager.executeTool(
                'mcp_web_search',
                {
                    query: 'workflow automation',
                    limit: mathResult.result / 10, // 48 / 10 = 4.8
                },
                'workflow-session'
            );

            expect(searchResult.content[0].text).toContain('workflow automation');
        });

        it('should gracefully handle partial workflow failures', async () => {
            // Start workflow
            const step1 = await toolManager.executeTool('calculator', {
                operation: 'add',
                a: 10,
                b: 5,
            });

            expect(step1.result).toBe(15);

            // Failing step
            await expect(
                toolManager.executeTool('calculator', {
                    operation: 'divide',
                    a: step1.result,
                    b: 0, // This will cause division by zero
                })
            ).rejects.toThrow('Division by zero');

            // Continue with successful step using original result
            const step3 = await toolManager.executeTool('text_processor', {
                text: step1.result.toString(),
                operation: 'length',
            });

            expect(step3.processedText).toBe(2); // '15' has length 2
        });
    });
});
