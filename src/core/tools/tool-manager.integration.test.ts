import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToolManager } from './tool-manager.js';
import { NoOpConfirmationProvider } from '../client/tool-confirmation/noop-confirmation-provider.js';
import type { ToolSet, ToolExecutionContext } from './types.js';

/**
 * Integration tests for ToolManager cross-source conflict resolution
 * and end-to-end tool execution flows
 */

// Mock implementations that provide realistic tool behavior
class RealisticMCPManager {
    private tools: Record<string, any>;

    constructor(tools: Record<string, any> = {}) {
        this.tools = tools;
    }

    async getAllTools(): Promise<ToolSet> {
        return this.tools;
    }

    async executeTool(toolName: string, args: any, sessionId?: string): Promise<any> {
        if (!this.tools[toolName]) {
            throw new Error(`No MCP tool found: ${toolName}`);
        }

        // Simulate realistic MCP tool execution
        return {
            content: [
                {
                    type: 'text',
                    text: `MCP tool '${toolName}' executed with args: ${JSON.stringify(args)}`,
                },
            ],
            metadata: {
                source: 'mcp',
                sessionId,
                timestamp: new Date().toISOString(),
            },
        };
    }

    getToolClient(toolName: string): any {
        return this.tools[toolName] ? { name: `mcp-client-${toolName}` } : undefined;
    }
}

class RealisticCustomToolProvider {
    private tools: Record<string, any>;
    private initialized = false;

    constructor(tools: Record<string, any> = {}) {
        this.tools = tools;
    }

    async initialize(): Promise<void> {
        this.initialized = true;
    }

    getAllTools(): ToolSet {
        if (!this.initialized) {
            throw new Error('CustomToolProvider not initialized');
        }
        return this.tools;
    }

    hasTool(toolName: string): boolean {
        return this.initialized && toolName in this.tools;
    }

    async executeTool(toolName: string, args: any, context?: ToolExecutionContext): Promise<any> {
        if (!this.initialized) {
            throw new Error('CustomToolProvider not initialized');
        }

        if (!this.tools[toolName]) {
            throw new Error(`Custom tool not found: ${toolName}`);
        }

        // Simulate realistic custom tool execution
        return {
            success: true,
            result: `Custom tool '${toolName}' processed successfully`,
            data: args,
            metadata: {
                source: 'custom',
                sessionId: context?.sessionId,
                executedAt: new Date().toISOString(),
            },
        };
    }
}

describe('ToolManager Integration Tests', () => {
    let toolManager: ToolManager;
    let mcpManager: RealisticMCPManager;
    let customToolProvider: RealisticCustomToolProvider;
    let confirmationProvider: NoOpConfirmationProvider;

    beforeEach(() => {
        confirmationProvider = new NoOpConfirmationProvider();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Cross-Source Conflict Resolution', () => {
        it('should handle simple conflict between MCP and custom tools', async () => {
            // Setup: Both sources have a tool with the same name
            mcpManager = new RealisticMCPManager({
                file_read: {
                    description: 'Read files using MCP server',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'File path' },
                        },
                        required: ['path'],
                    },
                },
            });

            customToolProvider = new RealisticCustomToolProvider({
                file_read: {
                    description: 'Read files using custom implementation',
                    parameters: {
                        type: 'object',
                        properties: {
                            filename: { type: 'string', description: 'File name' },
                            encoding: { type: 'string', description: 'File encoding' },
                        },
                        required: ['filename'],
                    },
                },
            });

            toolManager = new ToolManager(mcpManager as any, confirmationProvider);
            toolManager['customToolProvider'] = customToolProvider as any;
            await customToolProvider.initialize();

            // Act: Get all tools
            const tools = await toolManager.getAllTools();

            // Assert: Conflict should be resolved with qualified names
            expect(tools).not.toHaveProperty('file_read'); // Unqualified should not exist
            expect(tools).toHaveProperty('mcp--file_read');
            expect(tools).toHaveProperty('custom--file_read');

            // Check that descriptions indicate source
            expect(tools['mcp--file_read']?.description).toContain('(via MCP servers)');
            expect(tools['custom--file_read']?.description).toContain('(custom tool)');
        });

        it('should handle multiple conflicts with different parameter schemas', async () => {
            mcpManager = new RealisticMCPManager({
                search: {
                    description: 'Search using MCP',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string' },
                            limit: { type: 'number' },
                        },
                        required: ['query'],
                    },
                },
                format: {
                    description: 'Format data using MCP',
                    parameters: {
                        type: 'object',
                        properties: {
                            data: { type: 'string' },
                            style: { type: 'string' },
                        },
                    },
                },
                unique_mcp: {
                    description: 'Unique to MCP',
                },
            });

            customToolProvider = new RealisticCustomToolProvider({
                search: {
                    description: 'Search using custom logic',
                    parameters: {
                        type: 'object',
                        properties: {
                            term: { type: 'string' },
                            filters: { type: 'array' },
                        },
                        required: ['term'],
                    },
                },
                format: {
                    description: 'Format using custom formatter',
                    parameters: {
                        type: 'object',
                        properties: {
                            input: { type: 'string' },
                            template: { type: 'string' },
                        },
                    },
                },
                unique_custom: {
                    description: 'Unique to custom',
                },
            });

            toolManager = new ToolManager(mcpManager as any, confirmationProvider);
            toolManager['customToolProvider'] = customToolProvider as any;
            await customToolProvider.initialize();

            const tools = await toolManager.getAllTools();

            // Conflicts should be qualified
            expect(tools).toHaveProperty('mcp--search');
            expect(tools).toHaveProperty('custom--search');
            expect(tools).toHaveProperty('mcp--format');
            expect(tools).toHaveProperty('custom--format');

            // Non-conflicts should be direct
            expect(tools).toHaveProperty('unique_mcp');
            expect(tools).toHaveProperty('unique_custom');

            // Should not have unqualified conflicted names
            expect(tools).not.toHaveProperty('search');
            expect(tools).not.toHaveProperty('format');
        });

        it('should dynamically update conflicts when tools change', async () => {
            // Initial setup with conflict
            mcpManager = new RealisticMCPManager({
                dynamic_tool: { description: 'MCP version' },
            });

            customToolProvider = new RealisticCustomToolProvider({
                dynamic_tool: { description: 'Custom version' },
            });

            toolManager = new ToolManager(mcpManager as any, confirmationProvider);
            toolManager['customToolProvider'] = customToolProvider as any;
            await customToolProvider.initialize();

            // Check initial conflict state
            let tools = await toolManager.getAllTools();
            expect(tools).toHaveProperty('mcp--dynamic_tool');
            expect(tools).toHaveProperty('custom--dynamic_tool');
            expect(tools).not.toHaveProperty('dynamic_tool');

            // Simulate removal of custom tool
            customToolProvider = new RealisticCustomToolProvider({
                other_tool: { description: 'Different tool' },
            });
            toolManager['customToolProvider'] = customToolProvider as any;
            await customToolProvider.initialize();

            // Update conflicts and check resolution
            await toolManager['updateCrossSourceConflicts']();
            tools = await toolManager.getAllTools();

            // Conflict should be resolved
            expect(tools).toHaveProperty('dynamic_tool'); // Now available directly
            expect(tools).not.toHaveProperty('mcp--dynamic_tool');
            expect(tools).not.toHaveProperty('custom--dynamic_tool');
            expect(tools).toHaveProperty('other_tool');
        });
    });

    describe('End-to-End Tool Execution', () => {
        beforeEach(async () => {
            mcpManager = new RealisticMCPManager({
                mcp_calculator: {
                    description: 'Calculate using MCP service',
                    parameters: {
                        type: 'object',
                        properties: {
                            operation: { type: 'string' },
                            a: { type: 'number' },
                            b: { type: 'number' },
                        },
                        required: ['operation', 'a', 'b'],
                    },
                },
                shared_utility: {
                    description: 'Shared utility via MCP',
                },
            });

            customToolProvider = new RealisticCustomToolProvider({
                custom_validator: {
                    description: 'Validate input using custom logic',
                    parameters: {
                        type: 'object',
                        properties: {
                            data: { type: 'string' },
                            rules: { type: 'array' },
                        },
                        required: ['data'],
                    },
                },
                shared_utility: {
                    description: 'Shared utility via custom implementation',
                },
            });

            toolManager = new ToolManager(mcpManager as any, confirmationProvider);
            toolManager['customToolProvider'] = customToolProvider as any;
            await customToolProvider.initialize();
        });

        it('should execute MCP tools correctly', async () => {
            const result = await toolManager.executeTool(
                'mcp_calculator',
                {
                    operation: 'add',
                    a: 5,
                    b: 3,
                },
                'session-123'
            );

            expect(result.content[0].text).toContain('mcp_calculator');
            expect(result.content[0].text).toContain('add');
            expect(result.metadata.source).toBe('mcp');
            expect(result.metadata.sessionId).toBe('session-123');
        });

        it('should execute custom tools correctly', async () => {
            const result = await toolManager.executeTool(
                'custom_validator',
                {
                    data: 'test@example.com',
                    rules: ['email'],
                },
                'session-456'
            );

            expect(result.success).toBe(true);
            expect(result.result).toContain('custom_validator');
            expect(result.data.data).toBe('test@example.com');
            expect(result.metadata.source).toBe('custom');
            expect(result.metadata.sessionId).toBe('session-456');
        });

        it('should execute qualified conflicted tools correctly', async () => {
            // Execute MCP version of shared utility
            const mcpResult = await toolManager.executeTool('mcp--shared_utility', {
                param: 'mcp_test',
            });

            expect(mcpResult.content[0].text).toContain('shared_utility');
            expect(mcpResult.metadata.source).toBe('mcp');

            // Execute custom version of shared utility
            const customResult = await toolManager.executeTool('custom--shared_utility', {
                param: 'custom_test',
            });

            expect(customResult.success).toBe(true);
            expect(customResult.result).toContain('shared_utility');
            expect(customResult.metadata.source).toBe('custom');
        });

        it('should handle tool execution errors appropriately', async () => {
            // Test non-existent tool
            await expect(toolManager.executeTool('nonexistent_tool', {})).rejects.toThrow(
                'Tool not found: nonexistent_tool'
            );

            // Test unqualified conflicted tool - auto-detect should work
            const autoDetectResult = await toolManager.executeTool('shared_utility', {});
            expect(autoDetectResult.success).toBe(true);
        });

        it('should propagate errors from underlying tool sources', async () => {
            // Mock an error in MCP execution
            const errorMCPManager = {
                getAllTools: vi.fn().mockResolvedValue({
                    error_tool: { description: 'Tool that will error' },
                }),
                executeTool: vi.fn().mockRejectedValue(new Error('MCP execution failed')),
                getToolClient: vi.fn().mockReturnValue({}),
            };

            toolManager = new ToolManager(errorMCPManager as any, confirmationProvider);

            await expect(toolManager.executeTool('error_tool', {})).rejects.toThrow(
                'MCP execution failed'
            );
        });
    });

    describe('Tool Discovery and Existence Checks', () => {
        beforeEach(async () => {
            mcpManager = new RealisticMCPManager({
                mcp_tool_1: { description: 'First MCP tool' },
                mcp_tool_2: { description: 'Second MCP tool' },
                common_name: { description: 'Common tool via MCP' },
            });

            customToolProvider = new RealisticCustomToolProvider({
                custom_tool_1: { description: 'First custom tool' },
                custom_tool_2: { description: 'Second custom tool' },
                common_name: { description: 'Common tool via custom' },
            });

            toolManager = new ToolManager(mcpManager as any, confirmationProvider);
            toolManager['customToolProvider'] = customToolProvider as any;
            await customToolProvider.initialize();
        });

        it('should correctly identify tool existence across sources', async () => {
            // MCP tools
            expect(await toolManager.hasTool('mcp_tool_1')).toBe(true);
            expect(await toolManager.hasTool('mcp_tool_2')).toBe(true);

            // Custom tools
            expect(await toolManager.hasTool('custom_tool_1')).toBe(true);
            expect(await toolManager.hasTool('custom_tool_2')).toBe(true);

            // Qualified conflicted tools
            expect(await toolManager.hasTool('mcp--common_name')).toBe(true);
            expect(await toolManager.hasTool('custom--common_name')).toBe(true);

            // Auto-detect for conflicted tools
            expect(await toolManager.hasTool('common_name')).toBe(true);

            // Non-existent tools
            expect(await toolManager.hasTool('nonexistent')).toBe(false);
        });

        it('should provide complete tool inventory', async () => {
            const tools = await toolManager.getAllTools();

            // Count tools
            const toolCount = Object.keys(tools).length;
            expect(toolCount).toBe(6); // 2 MCP + 2 Custom + 2 qualified conflicted

            // Verify all expected tools are present
            expect(tools).toHaveProperty('mcp_tool_1');
            expect(tools).toHaveProperty('mcp_tool_2');
            expect(tools).toHaveProperty('custom_tool_1');
            expect(tools).toHaveProperty('custom_tool_2');
            expect(tools).toHaveProperty('mcp--common_name');
            expect(tools).toHaveProperty('custom--common_name');

            // Verify conflicted tool is not available unqualified
            expect(tools).not.toHaveProperty('common_name');
        });
    });

    describe('Error Recovery and Resilience', () => {
        it('should handle MCP manager failures gracefully', async () => {
            const flakyMCPManager = {
                getAllTools: vi.fn().mockRejectedValue(new Error('Network error')),
                executeTool: vi.fn().mockRejectedValue(new Error('Connection lost')),
                getToolClient: vi.fn().mockReturnValue(undefined),
            };

            customToolProvider = new RealisticCustomToolProvider({
                backup_tool: { description: 'Backup custom tool' },
            });

            toolManager = new ToolManager(flakyMCPManager as any, confirmationProvider);
            toolManager['customToolProvider'] = customToolProvider as any;
            await customToolProvider.initialize();

            // Tool aggregation should fail due to MCP error
            await expect(toolManager.getAllTools()).rejects.toThrow('Network error');

            // But custom tools should still be accessible if we can work around the error
            expect(customToolProvider.hasTool('backup_tool')).toBe(true);
        });

        it('should handle custom tool provider failures gracefully', async () => {
            mcpManager = new RealisticMCPManager({
                primary_tool: { description: 'Primary MCP tool' },
            });

            // Create a failing custom tool provider
            const flakyCustomProvider = {
                initialize: vi.fn().mockRejectedValue(new Error('Initialization failed')),
                getAllTools: vi.fn().mockImplementation(() => {
                    throw new Error('Provider crashed');
                }),
                hasTool: vi.fn().mockReturnValue(false),
                executeTool: vi.fn().mockRejectedValue(new Error('Execution failed')),
            };

            toolManager = new ToolManager(mcpManager as any, confirmationProvider);
            toolManager['customToolProvider'] = flakyCustomProvider as any;

            // Should handle custom provider errors and continue with MCP tools
            const tools = await toolManager.getAllTools();
            expect(tools).toHaveProperty('primary_tool');
        });
    });
});
