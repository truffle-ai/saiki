import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToolManager } from './tool-manager.js';
import { NoOpConfirmationProvider } from '../client/tool-confirmation/noop-confirmation-provider.js';
import type { ToolManagerToolSet } from './types.js';

// Mock MCPManager
class MockMCPManager {
    private tools: Record<string, any> = {};

    constructor(tools: Record<string, any> = {}) {
        this.tools = tools;
    }

    async getAllTools(): Promise<ToolManagerToolSet> {
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

// Mock InternalToolsProvider
class MockInternalToolsProvider {
    private tools: ToolManagerToolSet = {};

    constructor(tools: ToolManagerToolSet = {}) {
        this.tools = tools;
    }

    async initialize(): Promise<void> {
        // No-op for mocking
    }

    hasTool(toolName: string): boolean {
        return toolName in this.tools;
    }

    async executeTool(toolName: string, args: any, sessionId?: string): Promise<any> {
        if (!this.hasTool(toolName)) {
            throw new Error(`No internal tool found: ${toolName}`);
        }
        return { result: `INTERNAL:${toolName}`, args, sessionId };
    }

    getAllTools(): ToolManagerToolSet {
        return this.tools;
    }

    getToolNames(): string[] {
        return Object.keys(this.tools);
    }
}

describe('ToolManager', () => {
    let confirmationProvider: NoOpConfirmationProvider;

    beforeEach(() => {
        confirmationProvider = new NoOpConfirmationProvider();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic functionality', () => {
        it('should initialize with empty tools', async () => {
            const mcpManager = new MockMCPManager();
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);

            const tools = await toolManager.getAllTools();
            expect(tools).toEqual({});
        });

        it('should return MCP tools when only MCP tools exist', async () => {
            const mcpTools = {
                mcp_tool1: { description: 'MCP Tool 1' },
                mcp_tool2: { description: 'MCP Tool 2' },
            };
            const mcpManager = new MockMCPManager(mcpTools);
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);

            const tools = await toolManager.getAllTools();
            expect(Object.keys(tools)).toHaveLength(2);
            expect(tools['mcp_tool1']).toBeDefined();
            expect(tools['mcp_tool2']).toBeDefined();
        });

        it('should return internal tools when only internal tools exist', async () => {
            const internalTools = {
                internal_tool1: { description: 'Internal Tool 1' },
                internal_tool2: { description: 'Internal Tool 2' },
            };
            const mcpManager = new MockMCPManager();
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);
            const internalProvider = new MockInternalToolsProvider(internalTools);

            await toolManager.initializeInternalTools(internalProvider as any);

            const tools = await toolManager.getAllTools();
            expect(Object.keys(tools)).toHaveLength(2);
            expect(tools['internal_tool1']).toBeDefined();
            expect(tools['internal_tool2']).toBeDefined();
        });
    });

    describe('Conflict resolution', () => {
        it('should give precedence to internal tools over MCP tools with same name', async () => {
            const mcpTools = {
                common_tool: { description: 'MCP Common Tool' },
                mcp_only: { description: 'MCP Only Tool' },
            };
            const internalTools = {
                common_tool: { description: 'Internal Common Tool' },
                internal_only: { description: 'Internal Only Tool' },
            };

            const mcpManager = new MockMCPManager(mcpTools);
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);
            const internalProvider = new MockInternalToolsProvider(internalTools);

            await toolManager.initializeInternalTools(internalProvider as any);

            const tools = await toolManager.getAllTools();

            // Should have internal version of common_tool and prefixed MCP version
            expect(tools['common_tool']).toBeDefined();
            expect(tools['common_tool']?.description).toBe('Internal Common Tool');
            expect(tools['mcp--common_tool']).toBeDefined();
            expect(tools['mcp--common_tool']?.description).toContain('MCP Common Tool');
            expect(tools['mcp_only']).toBeDefined();
            expect(tools['internal_only']).toBeDefined();
        });
    });

    describe('Tool execution', () => {
        it('should route to internal tools first', async () => {
            const mcpTools = {
                common_tool: { description: 'MCP Common Tool' },
            };
            const internalTools = {
                common_tool: { description: 'Internal Common Tool' },
            };

            const mcpManager = new MockMCPManager(mcpTools);
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);
            const internalProvider = new MockInternalToolsProvider(internalTools);

            await toolManager.initializeInternalTools(internalProvider as any);

            const result = (await toolManager.executeTool('common_tool', { test: 'args' })) as any;

            expect(result.result).toBe('INTERNAL:common_tool');
        });

        it('should route to MCP tools when internal tool not available', async () => {
            const mcpTools = {
                mcp_tool: { description: 'MCP Tool' },
            };

            const mcpManager = new MockMCPManager(mcpTools);
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);

            const result = (await toolManager.executeTool('mcp_tool', { test: 'args' })) as any;

            expect(result.result).toBe('MCP:mcp_tool');
        });

        it('should execute prefixed tools correctly', async () => {
            const mcpTools = {
                common_tool: { description: 'MCP Common Tool' },
            };
            const internalTools = {
                common_tool: { description: 'Internal Common Tool' },
            };

            const mcpManager = new MockMCPManager(mcpTools);
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);
            const internalProvider = new MockInternalToolsProvider(internalTools);

            await toolManager.initializeInternalTools(internalProvider as any);

            // Execute the prefixed MCP version
            const result = (await toolManager.executeTool('mcp--common_tool', {
                test: 'args',
            })) as any;

            expect(result.result).toBe('MCP:common_tool');
        });

        it('should throw error for non-existent tools', async () => {
            const mcpManager = new MockMCPManager();
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);

            await expect(toolManager.executeTool('non_existent', {})).rejects.toThrow(
                'Tool not found: non_existent'
            );
        });
    });

    describe('Tool statistics', () => {
        it('should return correct tool stats', async () => {
            const mcpTools = {
                mcp_tool1: { description: 'MCP Tool 1' },
                mcp_tool2: { description: 'MCP Tool 2' },
                common_tool: { description: 'MCP Common Tool' },
            };
            const internalTools = {
                internal_tool1: { description: 'Internal Tool 1' },
                common_tool: { description: 'Internal Common Tool' },
            };

            const mcpManager = new MockMCPManager(mcpTools);
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);
            const internalProvider = new MockInternalToolsProvider(internalTools);

            await toolManager.initializeInternalTools(internalProvider as any);

            const stats = await toolManager.getToolStats();

            expect(stats.mcp).toBe(3);
            expect(stats.internal).toBe(2);
            expect(stats.conflicts).toBe(1); // common_tool conflicts
            expect(stats.total).toBe(4); // 3 MCP + 2 internal - 1 conflict = 4 unique tools
        });
    });

    describe('Tool source detection', () => {
        it('should detect tool sources correctly', () => {
            const mcpManager = new MockMCPManager();
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);

            expect(toolManager.getToolSource('regular_tool')).toBe('auto');
            expect(toolManager.getToolSource('mcp--prefixed_tool')).toBe('mcp');
            expect(toolManager.getToolSource('internal--prefixed_tool')).toBe('internal');
        });
    });
});
