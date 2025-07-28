import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToolManager } from './tool-manager.js';
import { NoOpConfirmationProvider } from '../client/tool-confirmation/noop-confirmation-provider.js';
import type { ToolSet, ToolExecutionContext } from './types.js';

// Mock MCPManager
class MockMCPManager {
    private tools: Record<string, any> = {};

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
        return { result: `MCP:${toolName}`, args, sessionId };
    }

    getToolClient(toolName: string): any {
        return this.tools[toolName] ? {} : undefined;
    }
}

// Mock CustomToolsProvider
class MockCustomToolsProvider {
    private tools: Record<string, any> = {};

    constructor(tools: Record<string, any> = {}) {
        this.tools = tools;
    }

    getAllTools(): ToolSet {
        return this.tools;
    }

    hasTool(toolName: string): boolean {
        return toolName in this.tools;
    }

    async executeTool(toolName: string, args: any, context?: ToolExecutionContext): Promise<any> {
        if (!this.tools[toolName]) {
            throw new Error(`Custom tool not found: ${toolName}`);
        }
        return { result: `Custom:${toolName}`, args, context };
    }

    async initialize(): Promise<void> {
        // Mock initialization
    }
}

describe('ToolManager', () => {
    let toolManager: ToolManager;
    let mockMCPManager: MockMCPManager;
    let mockCustomToolProvider: MockCustomToolsProvider;
    let confirmationProvider: NoOpConfirmationProvider;

    beforeEach(() => {
        confirmationProvider = new NoOpConfirmationProvider();
        mockMCPManager = new MockMCPManager();
        toolManager = new ToolManager(mockMCPManager as any, confirmationProvider);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic Tool Aggregation', () => {
        it('should aggregate tools from MCP manager only when no custom tools', async () => {
            // Setup MCP tools
            mockMCPManager = new MockMCPManager({
                mcp_tool_1: { description: 'MCP Tool 1' },
                mcp_tool_2: { description: 'MCP Tool 2' },
            });
            toolManager = new ToolManager(mockMCPManager as any, confirmationProvider);

            const tools = await toolManager.getAllTools();

            expect(tools).toHaveProperty('mcp_tool_1');
            expect(tools).toHaveProperty('mcp_tool_2');
            expect(Object.keys(tools)).toHaveLength(2);
        });

        it('should aggregate tools from both MCP and custom sources without conflicts', async () => {
            // Setup MCP tools
            mockMCPManager = new MockMCPManager({
                mcp_tool: { description: 'MCP Tool' },
            });
            toolManager = new ToolManager(mockMCPManager as any, confirmationProvider);

            // Setup custom tools
            mockCustomToolProvider = new MockCustomToolsProvider({
                custom_tool: { description: 'Custom Tool' },
            });

            // Inject custom tool provider
            toolManager['customToolProvider'] = mockCustomToolProvider as any;

            const tools = await toolManager.getAllTools();

            expect(tools).toHaveProperty('mcp_tool');
            expect(tools).toHaveProperty('custom_tool');
            expect(Object.keys(tools)).toHaveLength(2);
        });
    });

    describe('Cross-Source Conflict Resolution', () => {
        beforeEach(() => {
            // Setup tools with conflicts
            mockMCPManager = new MockMCPManager({
                shared_tool: { description: 'MCP version of shared tool' },
                unique_mcp: { description: 'Unique MCP tool' },
            });

            mockCustomToolProvider = new MockCustomToolsProvider({
                shared_tool: { description: 'Custom version of shared tool' },
                unique_custom: { description: 'Unique custom tool' },
            });

            toolManager = new ToolManager(mockMCPManager as any, confirmationProvider);
            toolManager['customToolProvider'] = mockCustomToolProvider as any;
        });

        it('should detect conflicts and use qualified names', async () => {
            const tools = await toolManager.getAllTools();

            // Conflicted tool should be qualified
            expect(tools).toHaveProperty('mcp--shared_tool');
            expect(tools).toHaveProperty('custom--shared_tool');
            expect(tools).not.toHaveProperty('shared_tool'); // Unqualified should not exist

            // Non-conflicted tools should be available directly
            expect(tools).toHaveProperty('unique_mcp');
            expect(tools).toHaveProperty('unique_custom');
        });

        it('should add source information to conflicted tool descriptions', async () => {
            const tools = await toolManager.getAllTools();

            expect(tools['mcp--shared_tool']?.description).toContain('(via MCP servers)');
            expect(tools['custom--shared_tool']?.description).toContain('(custom tool)');
        });

        it('should update conflicts when tools change', async () => {
            // Initial state - conflict exists
            let tools = await toolManager.getAllTools();
            expect(tools).toHaveProperty('mcp--shared_tool');
            expect(tools).toHaveProperty('custom--shared_tool');

            // Remove custom tool (simulate provider change)
            mockCustomToolProvider = new MockCustomToolsProvider({
                unique_custom: { description: 'Unique custom tool' },
            });
            toolManager['customToolProvider'] = mockCustomToolProvider as any;

            // Update conflicts
            await toolManager['updateCrossSourceConflicts']();

            tools = await toolManager.getAllTools();

            // Conflict resolved - shared_tool should be available directly
            expect(tools).toHaveProperty('shared_tool');
            expect(tools).not.toHaveProperty('mcp--shared_tool');
            expect(tools).not.toHaveProperty('custom--shared_tool');
        });
    });

    describe('Tool Execution Routing', () => {
        beforeEach(() => {
            mockMCPManager = new MockMCPManager({
                mcp_tool: { description: 'MCP Tool' },
                shared_tool: { description: 'MCP version' },
            });

            mockCustomToolProvider = new MockCustomToolsProvider({
                custom_tool: { description: 'Custom Tool' },
                shared_tool: { description: 'Custom version' },
            });

            toolManager = new ToolManager(mockMCPManager as any, confirmationProvider);
            toolManager['customToolProvider'] = mockCustomToolProvider as any;
        });

        it('should route MCP tools to MCPManager', async () => {
            const result = await toolManager.executeTool(
                'mcp_tool',
                { test: 'data' },
                'session123'
            );

            expect(result.result).toBe('MCP:mcp_tool');
            expect(result.args).toEqual({ test: 'data' });
            expect(result.sessionId).toBe('session123');
        });

        it('should route custom tools to CustomToolsProvider', async () => {
            const result = await toolManager.executeTool(
                'custom_tool',
                { test: 'data' },
                'session123'
            );

            expect(result.result).toBe('Custom:custom_tool');
            expect(result.args).toEqual({ test: 'data' });
            expect(result.context).toEqual({ sessionId: 'session123' });
        });

        it('should route qualified conflicted tools correctly', async () => {
            // Test MCP qualified tool
            const mcpResult = await toolManager.executeTool('mcp--shared_tool', { test: 'mcp' });
            expect(mcpResult.result).toBe('MCP:shared_tool');

            // Test custom qualified tool
            const customResult = await toolManager.executeTool('custom--shared_tool', {
                test: 'custom',
            });
            expect(customResult.result).toBe('Custom:shared_tool');
        });

        it('should throw error for non-existent tools', async () => {
            await expect(toolManager.executeTool('nonexistent', {})).rejects.toThrow(
                'Tool not found: nonexistent'
            );
        });

        it('should handle unqualified conflicted tools by auto-detecting source', async () => {
            // In the current implementation, auto-detect will find the custom tool
            const result = await toolManager.executeTool('shared_tool', {});
            expect(result.result).toBe('Custom:shared_tool');
        });
    });

    describe('Tool Name Parsing', () => {
        it('should parse qualified tool names correctly', () => {
            const parseMethod = toolManager['parseToolName'].bind(toolManager);

            // MCP qualified
            const mcpResult = parseMethod('mcp--toolname');
            expect(mcpResult).toEqual({
                source: 'mcp',
                actualToolName: 'toolname',
            });

            // Custom qualified
            const customResult = parseMethod('custom--toolname');
            expect(customResult).toEqual({
                source: 'custom',
                actualToolName: 'toolname',
            });

            // Auto-detect (non-qualified)
            const autoResult = parseMethod('simpletool');
            expect(autoResult).toEqual({
                source: 'auto',
                actualToolName: 'simpletool',
            });
        });

        it('should handle complex tool names', () => {
            const parseMethod = toolManager['parseToolName'].bind(toolManager);

            // Tool name with underscores
            const result = parseMethod('mcp--tool_with_underscores');
            expect(result.actualToolName).toBe('tool_with_underscores');

            // Tool name with hyphens
            const result2 = parseMethod('custom--tool-with-hyphens');
            expect(result2.actualToolName).toBe('tool-with-hyphens');
        });
    });

    describe('Tool Existence Checks', () => {
        beforeEach(() => {
            mockMCPManager = new MockMCPManager({
                mcp_tool: { description: 'MCP Tool' },
            });

            mockCustomToolProvider = new MockCustomToolsProvider({
                custom_tool: { description: 'Custom Tool' },
            });

            toolManager = new ToolManager(mockMCPManager as any, confirmationProvider);
            toolManager['customToolProvider'] = mockCustomToolProvider as any;
        });

        it('should correctly identify existing tools from both sources', async () => {
            expect(await toolManager.hasTool('mcp_tool')).toBe(true);
            expect(await toolManager.hasTool('custom_tool')).toBe(true);
            expect(await toolManager.hasTool('nonexistent')).toBe(false);
        });

        it('should handle qualified tool names in existence checks', async () => {
            // Add conflicted tools
            mockMCPManager = new MockMCPManager({
                shared: { description: 'MCP version' },
            });
            mockCustomToolProvider = new MockCustomToolsProvider({
                shared: { description: 'Custom version' },
            });

            toolManager = new ToolManager(mockMCPManager as any, confirmationProvider);
            toolManager['customToolProvider'] = mockCustomToolProvider as any;

            expect(await toolManager.hasTool('mcp--shared')).toBe(true);
            expect(await toolManager.hasTool('custom--shared')).toBe(true);
            expect(await toolManager.hasTool('shared')).toBe(true); // Auto-detect should find it
        });
    });

    describe('Custom Tool Initialization', () => {
        it('should initialize custom tools when configured', async () => {
            const mockConfig = {
                enabledTools: 'all' as const,
                enableToolDiscovery: false, // Disable tool discovery for testing
                toolConfigs: {},
                globalSettings: {
                    requiresConfirmation: true,
                    timeout: 5000,
                    enableCaching: true,
                },
            };

            // Start with no custom tool provider
            (toolManager as any)['customToolProvider'] = undefined;

            // Mock the CustomToolsProvider constructor
            const _mockProvider = {
                initialize: vi.fn().mockResolvedValue(undefined),
            };

            // The initializeCustomTools method will create a new provider
            await toolManager.initializeCustomTools(mockConfig);

            // Check that a custom tool provider was created
            expect(toolManager['customToolProvider']).toBeDefined();
        });

        it('should not reinitialize if custom tools already exist', async () => {
            // Set up existing custom tool provider
            const existingProvider = new MockCustomToolsProvider();
            toolManager['customToolProvider'] = existingProvider as any;

            const mockConfig = {
                enabledTools: 'all' as const,
                enableToolDiscovery: false, // Disable tool discovery for testing
                toolConfigs: {},
                globalSettings: {
                    requiresConfirmation: false,
                    timeout: 30000,
                    enableCaching: false,
                },
            };

            await toolManager.initializeCustomTools(mockConfig);

            // Should still be the same provider
            expect(toolManager['customToolProvider']).toBe(existingProvider);
        });
    });

    describe('MCP Manager Access', () => {
        it('should provide access to MCPManager for system prompt contributors', () => {
            const mcpManager = toolManager.getMcpManager();
            expect(mcpManager).toBe(mockMCPManager);
        });
    });

    describe('Error Handling', () => {
        it('should handle MCPManager errors gracefully', async () => {
            const errorMCPManager = {
                getAllTools: vi.fn().mockRejectedValue(new Error('MCP Error')),
                executeTool: vi.fn().mockRejectedValue(new Error('MCP Execution Error')),
                getToolClient: vi.fn().mockReturnValue(undefined),
            };

            toolManager = new ToolManager(errorMCPManager as any, confirmationProvider);

            // getAllTools should propagate MCP errors since they're critical
            await expect(toolManager.getAllTools()).rejects.toThrow('MCP Error');
        });

        it('should handle CustomToolsProvider errors gracefully', async () => {
            const errorCustomProvider = {
                getAllTools: vi.fn().mockImplementation(() => {
                    throw new Error('Custom Provider Error');
                }),
                hasTool: vi.fn().mockReturnValue(false),
                executeTool: vi.fn().mockRejectedValue(new Error('Custom Execution Error')),
            };

            toolManager['customToolProvider'] = errorCustomProvider as any;

            // Should handle errors and continue with MCP tools only
            const tools = await toolManager.getAllTools();
            expect(Object.keys(tools)).toHaveLength(0); // No tools since MCP is empty too

            await expect(toolManager.executeTool('custom--test', {})).rejects.toThrow(
                'Custom Execution Error'
            );
        });
    });
});
