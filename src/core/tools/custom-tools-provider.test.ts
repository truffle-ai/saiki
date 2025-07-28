import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomToolsProvider } from './custom-tools-provider.js';
import { createTool } from './tool-factory.js';
import { NoOpConfirmationProvider } from '../client/tool-confirmation/noop-confirmation-provider.js';
import { z } from 'zod';

// Create test tools for filtering tests
const testTools = [
    createTool({
        id: 'math_add',
        description: 'Add numbers',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: async ({ a, b }) => ({ result: a + b }),
        metadata: { category: 'math', tags: ['arithmetic'] },
    }),
    createTool({
        id: 'math_multiply',
        description: 'Multiply numbers',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: async ({ a, b }) => ({ result: a * b }),
        metadata: { category: 'math', tags: ['arithmetic'] },
    }),
    createTool({
        id: 'string_reverse',
        description: 'Reverse string',
        inputSchema: z.object({ text: z.string() }),
        execute: async ({ text }) => ({ result: text.split('').reverse().join('') }),
        metadata: { category: 'string', tags: ['text'] },
    }),
    createTool({
        id: 'dangerous_delete',
        description: 'Delete files',
        inputSchema: z.object({ path: z.string() }),
        execute: async ({ path }) => ({ deleted: path }),
        metadata: { category: 'file', tags: ['dangerous'] },
    }),
    createTool({
        id: 'admin_reboot',
        description: 'Reboot system',
        inputSchema: z.object({}),
        execute: async () => ({ status: 'rebooting' }),
        metadata: { category: 'system', tags: ['admin', 'dangerous'] },
    }),
];

describe('CustomToolsProvider', () => {
    let provider: CustomToolsProvider;
    let confirmationProvider: NoOpConfirmationProvider;

    beforeEach(() => {
        confirmationProvider = new NoOpConfirmationProvider();

        // Mock the global registry to return our test tools
        vi.doMock('./tool-registry.js', () => ({
            globalToolRegistry: {
                getAll: () => testTools,
            },
        }));
    });

    describe('Tool Filtering', () => {
        describe('enabledTools: "all"', () => {
            it('should enable all tools by default', async () => {
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

            it('should enable all tools with default configuration', async () => {
                provider = new CustomToolsProvider({}, confirmationProvider);

                await provider.initialize();

                const toolNames = provider.getToolNames();
                expect(toolNames).toHaveLength(5);
            });
        });

        describe('enabledTools: array', () => {
            it('should only enable explicitly listed tools', async () => {
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

            it('should handle empty enabled tools array', async () => {
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

            it('should handle non-existent tool IDs in enabled list', async () => {
                provider = new CustomToolsProvider(
                    {
                        enabledTools: ['math_add', 'non_existent_tool', 'string_reverse'],
                        globalSettings: {},
                    },
                    confirmationProvider
                );

                await provider.initialize();

                const toolNames = provider.getToolNames();
                expect(toolNames).toHaveLength(2);
                expect(toolNames).toContain('math_add');
                expect(toolNames).toContain('string_reverse');
                expect(toolNames).not.toContain('non_existent_tool');
            });
        });

        describe('disabledTools', () => {
            it('should exclude disabled tools from all enabled tools', async () => {
                provider = new CustomToolsProvider(
                    {
                        enabledTools: 'all',
                        disabledTools: ['dangerous_delete', 'admin_reboot'],
                        globalSettings: {},
                    },
                    confirmationProvider
                );

                await provider.initialize();

                const toolNames = provider.getToolNames();
                expect(toolNames).toHaveLength(3);
                expect(toolNames).toContain('math_add');
                expect(toolNames).toContain('math_multiply');
                expect(toolNames).toContain('string_reverse');
                expect(toolNames).not.toContain('dangerous_delete');
                expect(toolNames).not.toContain('admin_reboot');
            });

            it('should exclude disabled tools from explicitly enabled tools', async () => {
                provider = new CustomToolsProvider(
                    {
                        enabledTools: ['math_add', 'math_multiply', 'dangerous_delete'],
                        disabledTools: ['dangerous_delete'],
                        globalSettings: {},
                    },
                    confirmationProvider
                );

                await provider.initialize();

                const toolNames = provider.getToolNames();
                expect(toolNames).toHaveLength(2);
                expect(toolNames).toContain('math_add');
                expect(toolNames).toContain('math_multiply');
                expect(toolNames).not.toContain('dangerous_delete');
            });

            it('should handle non-existent tool IDs in disabled list', async () => {
                provider = new CustomToolsProvider(
                    {
                        enabledTools: 'all',
                        disabledTools: ['non_existent_tool', 'dangerous_delete'],
                        globalSettings: {},
                    },
                    confirmationProvider
                );

                await provider.initialize();

                const toolNames = provider.getToolNames();
                expect(toolNames).toHaveLength(4);
                expect(toolNames).not.toContain('dangerous_delete');
            });

            it('should handle empty disabled tools array', async () => {
                provider = new CustomToolsProvider(
                    {
                        enabledTools: 'all',
                        disabledTools: [],
                        globalSettings: {},
                    },
                    confirmationProvider
                );

                await provider.initialize();

                const toolNames = provider.getToolNames();
                expect(toolNames).toHaveLength(5);
            });
        });

        describe('Filtering Precedence', () => {
            it('should apply disabledTools after enabledTools filtering', async () => {
                provider = new CustomToolsProvider(
                    {
                        enabledTools: ['math_add', 'math_multiply', 'dangerous_delete'],
                        disabledTools: ['dangerous_delete', 'admin_reboot'], // admin_reboot not in enabled, dangerous_delete is
                        globalSettings: {},
                    },
                    confirmationProvider
                );

                await provider.initialize();

                const toolNames = provider.getToolNames();
                expect(toolNames).toHaveLength(2);
                expect(toolNames).toContain('math_add');
                expect(toolNames).toContain('math_multiply');
                expect(toolNames).not.toContain('dangerous_delete'); // Excluded by disabledTools
                expect(toolNames).not.toContain('admin_reboot'); // Not in enabledTools anyway
            });
        });

        describe('Real-world Scenarios', () => {
            it('should support security-focused configuration', async () => {
                provider = new CustomToolsProvider(
                    {
                        enabledTools: ['math_add', 'math_multiply', 'string_reverse'], // Only safe tools
                        disabledTools: ['dangerous_delete', 'admin_reboot'], // Belt and suspenders
                        globalSettings: {
                            requiresConfirmation: true, // Extra safety
                        },
                    },
                    confirmationProvider
                );

                await provider.initialize();

                const toolNames = provider.getToolNames();
                expect(toolNames).toHaveLength(3);
                expect(toolNames).not.toContain('dangerous_delete');
                expect(toolNames).not.toContain('admin_reboot');
            });

            it('should support development configuration', async () => {
                provider = new CustomToolsProvider(
                    {
                        enabledTools: 'all', // All tools available
                        disabledTools: ['admin_reboot'], // Just exclude the really dangerous one
                        globalSettings: {
                            requiresConfirmation: false, // Fast development
                        },
                    },
                    confirmationProvider
                );

                await provider.initialize();

                const toolNames = provider.getToolNames();
                expect(toolNames).toHaveLength(4);
                expect(toolNames).toContain('dangerous_delete'); // Available but needs caution
                expect(toolNames).not.toContain('admin_reboot');
            });
        });
    });

    describe('Tool Execution with Filtering', () => {
        it('should execute enabled tools', async () => {
            provider = new CustomToolsProvider(
                {
                    enabledTools: ['math_add'],
                    globalSettings: {},
                },
                confirmationProvider
            );

            await provider.initialize();

            expect(provider.hasTool('math_add')).toBe(true);
            const result = await provider.executeTool('math_add', { a: 2, b: 3 });
            expect(result.result).toBe(5);
        });

        it('should not execute disabled tools', async () => {
            provider = new CustomToolsProvider(
                {
                    enabledTools: 'all',
                    disabledTools: ['dangerous_delete'],
                    globalSettings: {},
                },
                confirmationProvider
            );

            await provider.initialize();

            expect(provider.hasTool('dangerous_delete')).toBe(false);
            await expect(
                provider.executeTool('dangerous_delete', { path: '/etc' })
            ).rejects.toThrow('Tool not found');
        });

        it('should not execute tools not in enabled list', async () => {
            provider = new CustomToolsProvider(
                {
                    enabledTools: ['math_add'],
                    globalSettings: {},
                },
                confirmationProvider
            );

            await provider.initialize();

            expect(provider.hasTool('math_multiply')).toBe(false);
            await expect(provider.executeTool('math_multiply', { a: 2, b: 3 })).rejects.toThrow(
                'Tool not found'
            );
        });
    });

    describe('Configuration Validation', () => {
        it('should handle undefined config gracefully', async () => {
            provider = new CustomToolsProvider(undefined as any, confirmationProvider);

            await provider.initialize();

            // Should default to enabling all tools
            const toolNames = provider.getToolNames();
            expect(toolNames).toHaveLength(5);
        });

        it('should handle partial config', async () => {
            provider = new CustomToolsProvider(
                {
                    enabledTools: ['math_add'],
                    // Missing other properties
                } as any,
                confirmationProvider
            );

            await provider.initialize();

            const toolNames = provider.getToolNames();
            expect(toolNames).toHaveLength(1);
            expect(toolNames).toContain('math_add');
        });
    });
});
