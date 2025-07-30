import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CustomToolsProvider } from './custom-tools-provider.js';
import { NoOpConfirmationProvider } from '../client/tool-confirmation/noop-confirmation-provider.js';
import { createTool } from './tool-factory.js';
import { z } from 'zod';

// Mock the global registry
vi.mock('./tool-registry.js', async () => {
    const actual = await vi.importActual('./tool-registry.js');
    return {
        ...actual,
        globalToolRegistry: {
            getAll: vi.fn(),
            register: vi.fn(),
        },
    };
});

// Mock the tool discovery to prevent loading tools from filesystem
vi.mock('./tool-discovery.js', () => {
    return {
        ToolDiscovery: vi.fn(() => ({
            discoverTools: vi.fn().mockResolvedValue({
                tools: [],
                errors: [],
            }),
        })),
    };
});

describe('CustomToolsProvider', () => {
    let provider: CustomToolsProvider;
    let confirmationProvider: NoOpConfirmationProvider;

    // Create test tools
    const mathAddTool = createTool({
        id: 'math_add',
        description: 'Add two numbers',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: async ({ a, b }) => ({ result: a + b }),
    });

    const mathMultiplyTool = createTool({
        id: 'math_multiply',
        description: 'Multiply two numbers',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: async ({ a, b }) => ({ result: a * b }),
    });

    const stringReverseTool = createTool({
        id: 'string_reverse',
        description: 'Reverse a string',
        inputSchema: z.object({ text: z.string() }),
        execute: async ({ text }) => ({ result: text.split('').reverse().join('') }),
    });

    const dangerousDeleteTool = createTool({
        id: 'dangerous_delete',
        description: 'Delete files (dangerous)',
        inputSchema: z.object({ path: z.string() }),
        execute: async ({ path }) => ({ deleted: path }),
    });

    const adminRebootTool = createTool({
        id: 'admin_reboot',
        description: 'Reboot system (admin only)',
        inputSchema: z.object({ force: z.boolean() }),
        execute: async ({ force }) => ({ rebooted: force }),
    });

    beforeEach(() => {
        confirmationProvider = new NoOpConfirmationProvider();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with default configuration', async () => {
            // Mock the global registry to return empty array for this test
            const { globalToolRegistry } = await import('./tool-registry.js');
            (globalToolRegistry.getAll as any).mockReturnValue([]);

            provider = new CustomToolsProvider(
                {
                    enabledTools: 'all',
                    globalSettings: {},
                },
                confirmationProvider
            );

            await provider.initialize();

            expect(provider).toBeDefined();
            const toolNames = provider.getToolNames();
            expect(toolNames).toHaveLength(0); // Should load all registered tools (empty in this test)
        });

        it('should initialize with custom configuration', async () => {
            const config = {
                enabledTools: ['math_add', 'math_multiply'],
                globalSettings: {
                    requiresConfirmation: true,
                    timeout: 5000,
                },
            };

            provider = new CustomToolsProvider(config, confirmationProvider);

            expect(provider).toBeDefined();
        });
    });

    describe('Tool Loading and Filtering', () => {
        beforeEach(async () => {
            // Mock the global registry to return our test tools
            const { globalToolRegistry } = await import('./tool-registry.js');
            (globalToolRegistry.getAll as any).mockReturnValue([
                mathAddTool,
                mathMultiplyTool,
                stringReverseTool,
                dangerousDeleteTool,
                adminRebootTool,
            ]);
        });

        it('should load all tools when enabledTools is "all"', async () => {
            provider = new CustomToolsProvider(
                {
                    enabledTools: 'all',
                    globalSettings: {},
                },
                confirmationProvider
            );

            await provider.initialize();

            const toolNames = provider.getToolNames();
            expect(toolNames).toHaveLength(5);
            expect(toolNames).toContain('math_add');
            expect(toolNames).toContain('math_multiply');
            expect(toolNames).toContain('string_reverse');
            expect(toolNames).toContain('dangerous_delete');
            expect(toolNames).toContain('admin_reboot');
        });

        it('should load only specified tools when enabledTools is an array', async () => {
            provider = new CustomToolsProvider(
                {
                    enabledTools: ['math_add', 'string_reverse'],
                    globalSettings: {},
                },
                confirmationProvider
            );

            await provider.initialize();

            const toolNames = provider.getToolNames();
            expect(toolNames).toHaveLength(2);
            expect(toolNames).toContain('math_add');
            expect(toolNames).toContain('string_reverse');
            expect(toolNames).not.toContain('math_multiply');
            expect(toolNames).not.toContain('dangerous_delete');
            expect(toolNames).not.toContain('admin_reboot');
        });

        it('should handle empty enabledTools array', async () => {
            provider = new CustomToolsProvider(
                {
                    enabledTools: [],
                    globalSettings: {},
                },
                confirmationProvider
            );

            await provider.initialize();

            const toolNames = provider.getToolNames();
            expect(toolNames).toHaveLength(0);
        });

        it('should throw error for non-existent tool IDs in enabledTools', async () => {
            provider = new CustomToolsProvider(
                {
                    enabledTools: ['math_add', 'non_existent_tool'],
                    globalSettings: {},
                },
                confirmationProvider
            );

            await expect(provider.initialize()).rejects.toThrow(
                'Invalid tool IDs specified in enabledTools: non_existent_tool'
            );
        });
    });

    describe('Tool Execution', () => {
        beforeEach(async () => {
            const { globalToolRegistry } = await import('./tool-registry.js');
            (globalToolRegistry.getAll as any).mockReturnValue([
                mathAddTool,
                mathMultiplyTool,
                stringReverseTool,
            ]);

            provider = new CustomToolsProvider(
                {
                    enabledTools: 'all',
                    globalSettings: {},
                },
                confirmationProvider
            );

            await provider.initialize();
        });

        it('should execute tools successfully', async () => {
            const result = await provider.executeTool('math_add', { a: 5, b: 3 });
            expect(result.success).toBe(true);
            expect(result.data?.result).toBe(8);
        });

        it('should handle tool execution errors', async () => {
            const result = await provider.executeTool('math_add', { a: 'invalid', b: 3 });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Expected number, received string');
        });

        it('should throw error for non-existent tools', async () => {
            await expect(provider.executeTool('non_existent', {})).rejects.toThrow(
                'Tool not found'
            );
        });

        it('should apply configuration precedence correctly', async () => {
            // Test with a tool that has settings
            const toolWithSettings = createTool({
                id: 'test_tool',
                description: 'Test tool with settings',
                inputSchema: z.object({ value: z.number() }),
                execute: async ({ value }) => ({ result: value * 2 }),
                settings: {
                    requiresConfirmation: true,
                    timeout: 15000,
                },
            });

            const { globalToolRegistry } = await import('./tool-registry.js');
            (globalToolRegistry.getAll as any).mockReturnValue([toolWithSettings]);

            provider = new CustomToolsProvider(
                {
                    enabledTools: 'all',
                    toolConfigs: {
                        test_tool: {
                            requiresConfirmation: false, // Override tool code setting
                        },
                    },
                    globalSettings: {
                        requiresConfirmation: true, // Should be overridden by tool-specific config
                    },
                },
                confirmationProvider
            );

            await provider.initialize();

            // Should not require confirmation due to tool-specific config
            const result = await provider.executeTool('test_tool', { value: 5 });
            expect(result.success).toBe(true);
            expect(result.data?.result).toBe(10);
        });
    });

    describe('Error Handling', () => {
        it('should handle initialization errors gracefully', async () => {
            const { globalToolRegistry } = await import('./tool-registry.js');
            (globalToolRegistry.getAll as any).mockImplementation(() => {
                throw new Error('Registry error');
            });

            provider = new CustomToolsProvider(
                {
                    enabledTools: 'all',
                    globalSettings: {},
                },
                confirmationProvider
            );

            await expect(provider.initialize()).rejects.toThrow('Registry error');
        });

        it('should handle empty registry gracefully', async () => {
            const { globalToolRegistry } = await import('./tool-registry.js');
            (globalToolRegistry.getAll as any).mockReturnValue([]);

            provider = new CustomToolsProvider(
                {
                    enabledTools: 'all',
                    globalSettings: {},
                },
                confirmationProvider
            );

            await provider.initialize();

            const toolNames = provider.getToolNames();
            expect(toolNames).toHaveLength(0);
        });
    });

    describe('Configuration Handling', () => {
        it('should handle incomplete configuration', async () => {
            provider = new CustomToolsProvider({} as any, confirmationProvider);

            expect(provider).toBeDefined();
            // Should use defaults
            expect(provider.getToolNames()).toEqual([]);
        });

        it('should handle undefined configuration', async () => {
            provider = new CustomToolsProvider(undefined as any, confirmationProvider);

            expect(provider).toBeDefined();
            // Should use defaults
            expect(provider.getToolNames()).toEqual([]);
        });
    });
});
