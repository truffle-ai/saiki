import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToolManager } from './tool-manager.js';
import { NoOpConfirmationProvider } from '../client/tool-confirmation/noop-confirmation-provider.js';
import type { ToolManagerToolSet } from './types.js';

/**
 * Integration tests for ToolManager cross-source conflict resolution
 * and end-to-end tool execution flows between MCP and internal tools
 */

// Mock implementations that provide realistic tool behavior
// These mocks are essential for integration testing as they allow us to:
// 1. Test ToolManager's conflict resolution logic without external dependencies
// 2. Simulate realistic tool responses from both sources
// 3. Test edge cases and error scenarios in a controlled environment
class RealisticMCPManager {
    private tools: Record<string, any>;

    constructor(tools: Record<string, any> = {}) {
        this.tools = tools;
    }

    async getAllTools(): Promise<ToolManagerToolSet> {
        return this.tools;
    }

    async executeTool(toolName: string, args: any, _sessionId?: string): Promise<any> {
        if (!this.tools[toolName]) {
            throw new Error(`No MCP tool found: ${toolName}`);
        }

        // Simulate realistic MCP tool execution response format
        return {
            content: [
                {
                    type: 'text',
                    text: `MCP tool '${toolName}' executed successfully with args: ${JSON.stringify(args)}`,
                },
            ],
            isError: false,
        };
    }

    getToolClient(toolName: string): any {
        return this.tools[toolName] ? { name: `mcp-client-${toolName}` } : undefined;
    }
}

class RealisticInternalToolsProvider {
    private tools: ToolManagerToolSet = {};

    constructor(tools: ToolManagerToolSet = {}) {
        this.tools = tools;
    }

    async initialize(): Promise<void> {
        // Simulate initialization - in real implementation this would register tools
    }

    hasTool(toolName: string): boolean {
        return toolName in this.tools;
    }

    async executeTool(toolName: string, args: any, sessionId?: string): Promise<any> {
        if (!this.hasTool(toolName)) {
            throw new Error(`No internal tool found: ${toolName}`);
        }

        // Simulate realistic internal tool execution response format
        return {
            success: true,
            data: `Internal tool '${toolName}' executed with args: ${JSON.stringify(args)}`,
            metadata: {
                sessionId: sessionId,
                executionTime: Date.now(),
            },
        };
    }

    getAllTools(): ToolManagerToolSet {
        return this.tools;
    }

    getToolNames(): string[] {
        return Object.keys(this.tools);
    }

    getToolCount(): number {
        return Object.keys(this.tools).length;
    }
}

describe('ToolManager Integration Tests', () => {
    let confirmationProvider: NoOpConfirmationProvider;

    beforeEach(() => {
        confirmationProvider = new NoOpConfirmationProvider();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Cross-source conflict resolution', () => {
        it('should handle complex conflict scenarios with internal tools taking precedence', async () => {
            // Setup: Both MCP and internal tools have overlapping names
            const mcpTools = {
                search: {
                    description: 'MCP search tool for external APIs',
                    parameters: { type: 'object', properties: { query: { type: 'string' } } },
                },
                file_read: {
                    description: 'MCP file reading tool',
                    parameters: { type: 'object', properties: { path: { type: 'string' } } },
                },
                mcp_specific: {
                    description: 'MCP-only tool',
                    parameters: { type: 'object', properties: { data: { type: 'string' } } },
                },
            };

            const internalTools = {
                search: {
                    description: 'Internal search through agent history',
                    parameters: {
                        type: 'object',
                        properties: { query: { type: 'string' }, limit: { type: 'number' } },
                    },
                },
                session_info: {
                    description: 'Internal session information tool',
                    parameters: { type: 'object', properties: {} },
                },
            };

            const mcpManager = new RealisticMCPManager(mcpTools);
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);
            const internalProvider = new RealisticInternalToolsProvider(internalTools as any);

            await toolManager.initializeInternalTools(internalProvider as any);

            const allTools = await toolManager.getAllTools();

            // Verify conflict resolution
            expect(allTools['search']).toBeDefined();
            expect(allTools['search']?.description).toBe('Internal search through agent history');

            // MCP version should be prefixed
            expect(allTools['mcp--search']).toBeDefined();
            expect(allTools['mcp--search']?.description).toContain('MCP search tool');

            // Non-conflicting tools should be available directly
            expect(allTools['file_read']).toBeDefined();
            expect(allTools['file_read']?.description).toBe('MCP file reading tool');
            expect(allTools['session_info']).toBeDefined();
            expect(allTools['mcp_specific']).toBeDefined();

            // Verify total count
            expect(Object.keys(allTools)).toHaveLength(5); // 2 internal + 2 non-conflicting MCP + 1 prefixed conflict
        });

        it('should execute tools correctly with conflict resolution', async () => {
            const mcpTools = {
                search: { description: 'MCP search tool' },
            };

            const internalTools = {
                search: { description: 'Internal search tool' },
            };

            const mcpManager = new RealisticMCPManager(mcpTools);
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);
            const internalProvider = new RealisticInternalToolsProvider(internalTools as any);

            await toolManager.initializeInternalTools(internalProvider as any);

            // Execute unqualified tool name (should route to internal)
            const internalResult = await toolManager.executeTool('search', { query: 'test' });
            expect(internalResult.data).toContain('Internal tool');

            // Execute prefixed MCP tool
            const mcpResult = await toolManager.executeTool('mcp--search', { query: 'test' });
            expect(mcpResult.content[0].text).toContain('MCP tool');
        });
    });

    describe('End-to-end tool execution flows', () => {
        it('should handle session context properly in internal tools', async () => {
            const internalTools = {
                session_tool: { description: 'Tool that uses session context' },
            };

            const mcpManager = new RealisticMCPManager();
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);
            const internalProvider = new RealisticInternalToolsProvider(internalTools as any);

            await toolManager.initializeInternalTools(internalProvider as any);

            const result = await toolManager.executeTool(
                'session_tool',
                { data: 'test' },
                'session-123'
            );

            expect(result.success).toBe(true);
            expect(result.metadata.sessionId).toBe('session-123');
        });

        it('should maintain tool caching behavior', async () => {
            const mcpTools = {
                cached_tool: { description: 'Tool for cache testing' },
            };

            const mcpManager = new RealisticMCPManager(mcpTools);
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);

            // First call to build cache
            const tools1 = await toolManager.getAllTools();
            expect(Object.keys(tools1)).toHaveLength(1);

            // Second call should use cache
            const tools2 = await toolManager.getAllTools();
            expect(tools2).toBe(tools1); // Should be same reference due to caching
        });

        it('should refresh cache when refresh() is called', async () => {
            const mcpManager = new RealisticMCPManager({
                initial_tool: { description: 'Initial tool' },
            });
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);

            // Get initial tools
            const initialTools = await toolManager.getAllTools();
            expect(Object.keys(initialTools)).toHaveLength(1);

            // Simulate MCP servers changing
            (mcpManager as any).tools = {
                initial_tool: { description: 'Initial tool' },
                new_tool: { description: 'New tool' },
            };

            // Refresh should invalidate cache
            await toolManager.refresh();

            const refreshedTools = await toolManager.getAllTools();
            expect(Object.keys(refreshedTools)).toHaveLength(2);
            expect(refreshedTools['new_tool']).toBeDefined();
        });
    });

    describe('Error handling and edge cases', () => {
        it('should handle tool execution errors gracefully', async () => {
            const mcpManager = new RealisticMCPManager();
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);

            await expect(toolManager.executeTool('nonexistent_tool', {})).rejects.toThrow(
                'Tool not found: nonexistent_tool'
            );
        });

        it('should handle internal tools provider errors during initialization', async () => {
            const mcpManager = new RealisticMCPManager();
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);

            // Mock a failing internal tools provider
            const failingProvider = {
                initialize: vi.fn().mockRejectedValue(new Error('Internal tools failed')),
                hasTool: vi.fn().mockReturnValue(false),
                executeTool: vi.fn(),
                getAllTools: vi.fn().mockReturnValue({}),
                getToolNames: vi.fn().mockReturnValue([]),
            };

            await expect(
                toolManager.initializeInternalTools(failingProvider as any)
            ).rejects.toThrow('Internal tools failed');
        });

        it('should provide accurate tool statistics even with complex scenarios', async () => {
            const mcpTools = {
                tool_a: { description: 'MCP tool A' },
                tool_b: { description: 'MCP tool B' },
                shared_tool: { description: 'MCP shared tool' },
            };

            const internalTools = {
                tool_c: { description: 'Internal tool C' },
                shared_tool: { description: 'Internal shared tool' },
            };

            const mcpManager = new RealisticMCPManager(mcpTools);
            const toolManager = new ToolManager(mcpManager as any, confirmationProvider);
            const internalProvider = new RealisticInternalToolsProvider(internalTools as any);

            await toolManager.initializeInternalTools(internalProvider as any);

            const stats = await toolManager.getToolStats();

            expect(stats.mcp).toBe(3);
            expect(stats.internal).toBe(2);
            expect(stats.conflicts).toBe(1); // shared_tool
            expect(stats.total).toBe(5); // 3 MCP + 2 internal
        });
    });
});
