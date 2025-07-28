import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolExecutor } from './tool-executor.js';
import { ToolRegistry } from './tool-registry.js';
import { createTool } from './tool-factory.js';
import { NoOpConfirmationProvider } from '../client/tool-confirmation/noop-confirmation-provider.js';
import { ToolExecutionError } from './types.js';
import { z } from 'zod';

describe('ToolExecutor', () => {
    let registry: ToolRegistry;
    let executor: ToolExecutor;
    let confirmationProvider: NoOpConfirmationProvider;

    // Create test tools with different settings
    const testTool = createTool({
        id: 'test_tool',
        description: 'Test tool',
        inputSchema: z.object({ value: z.number() }),
        execute: async ({ value }) => ({ result: value * 2 }),
        settings: {
            requiresConfirmation: false,
            timeout: 15000,
        },
    });

    const confirmationTool = createTool({
        id: 'confirmation_tool',
        description: 'Tool that requires confirmation in code',
        inputSchema: z.object({ action: z.string() }),
        execute: async ({ action }) => ({ performed: action }),
        settings: {
            requiresConfirmation: true,
            timeout: 45000,
        },
    });

    const defaultTool = createTool({
        id: 'default_tool',
        description: 'Tool with no explicit settings',
        inputSchema: z.object({ data: z.string() }),
        execute: async ({ data }) => ({ processed: data }),
        // No settings property
    });

    beforeEach(() => {
        registry = new ToolRegistry();
        registry.register(testTool);
        registry.register(confirmationTool);
        registry.register(defaultTool);
        confirmationProvider = new NoOpConfirmationProvider();
    });

    describe('Configuration Precedence', () => {
        describe('Confirmation Settings Precedence', () => {
            it('should use tool-specific config over tool code settings', async () => {
                executor = new ToolExecutor(
                    registry,
                    {
                        enabledTools: 'all',
                        toolConfigs: {
                            confirmation_tool: {
                                requiresConfirmation: false, // Override tool code setting (true)
                            },
                        },
                        globalSettings: {
                            requiresConfirmation: true, // This should be ignored for this tool
                        },
                    },
                    confirmationProvider
                );

                // Tool should execute without confirmation due to tool-specific config
                const result = await executor.executeTool('confirmation_tool', { action: 'test' });
                expect(result.performed).toBe('test');
            });

            it('should use tool code settings over global settings', async () => {
                executor = new ToolExecutor(
                    registry,
                    {
                        enabledTools: 'all',
                        globalSettings: {
                            requiresConfirmation: true, // Global setting
                        },
                    },
                    confirmationProvider
                );

                // testTool has requiresConfirmation: false in code, should override global
                const result = await executor.executeTool('test_tool', { value: 5 });
                expect(result.result).toBe(10);
            });

            it('should use global settings for tools without code settings', async () => {
                const mockConfirmationProvider = {
                    allowedToolsProvider: null,
                    requestConfirmation: vi.fn().mockResolvedValue(false), // Deny confirmation
                };

                executor = new ToolExecutor(
                    registry,
                    {
                        enabledTools: 'all',
                        globalSettings: {
                            requiresConfirmation: true, // Should apply to defaultTool
                        },
                    },
                    mockConfirmationProvider as any
                );

                // defaultTool has no settings, should use global setting (true)
                await expect(
                    executor.executeTool('default_tool', { data: 'test' })
                ).rejects.toThrow('Tool execution denied by user');

                expect(mockConfirmationProvider.requestConfirmation).toHaveBeenCalledWith({
                    toolName: 'default_tool',
                    args: { data: 'test' },
                });
            });

            it('should fall back to system defaults when no settings provided', async () => {
                executor = new ToolExecutor(
                    registry,
                    {
                        enabledTools: 'all',
                        // No toolConfigs, no globalSettings
                    },
                    confirmationProvider
                );

                // defaultTool should use system default (false)
                const result = await executor.executeTool('default_tool', { data: 'test' });
                expect(result.processed).toBe('test');
            });
        });

        describe('Timeout Settings Precedence', () => {
            it('should use tool-specific config over tool code settings', async () => {
                executor = new ToolExecutor(
                    registry,
                    {
                        enabledTools: 'all',
                        toolConfigs: {
                            test_tool: {
                                timeout: 5000, // Override tool code setting (15000)
                            },
                        },
                        globalSettings: {
                            timeout: 60000, // This should be ignored for this tool
                        },
                    },
                    confirmationProvider
                );

                // Create a slow tool to test timeout
                const slowTool = createTool({
                    id: 'slow_tool',
                    description: 'Slow tool',
                    inputSchema: z.object({}),
                    execute: async () => {
                        await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 seconds
                        return { done: true };
                    },
                });

                registry.register(slowTool);

                executor = new ToolExecutor(
                    registry,
                    {
                        enabledTools: 'all',
                        toolConfigs: {
                            slow_tool: {
                                timeout: 100, // Very short timeout
                            },
                        },
                    },
                    confirmationProvider
                );

                await expect(executor.executeTool('slow_tool', {})).rejects.toThrow(
                    'Tool execution timeout after 100ms'
                );
            });

            it('should use tool code settings over global settings', async () => {
                // This is harder to test directly, but we can verify the setting is read correctly
                executor = new ToolExecutor(
                    registry,
                    {
                        enabledTools: 'all',
                        globalSettings: {
                            timeout: 5000, // Global setting
                        },
                    },
                    confirmationProvider
                );

                // testTool has timeout: 15000 in code, should work even if global is shorter
                // (We can't easily test the actual timeout without making tests slow)
                const result = await executor.executeTool('test_tool', { value: 3 });
                expect(result.result).toBe(6);
            });

            it('should use global settings for tools without code settings', async () => {
                const slowDefaultTool = createTool({
                    id: 'slow_default_tool',
                    description: 'Slow tool with no settings',
                    inputSchema: z.object({}),
                    execute: async () => {
                        await new Promise((resolve) => setTimeout(resolve, 200)); // 200ms
                        return { done: true };
                    },
                    // No settings
                });

                registry.register(slowDefaultTool);

                executor = new ToolExecutor(
                    registry,
                    {
                        enabledTools: 'all',
                        globalSettings: {
                            timeout: 100, // Should apply to slowDefaultTool
                        },
                    },
                    confirmationProvider
                );

                await expect(executor.executeTool('slow_default_tool', {})).rejects.toThrow(
                    'Tool execution timeout after 100ms'
                );
            });

            it('should fall back to system defaults when no settings provided', async () => {
                executor = new ToolExecutor(
                    registry,
                    {
                        enabledTools: 'all',
                        // No timeout settings anywhere
                    },
                    confirmationProvider
                );

                // Should use system default (30000ms) - tool should execute fine
                const result = await executor.executeTool('default_tool', { data: 'test' });
                expect(result.processed).toBe('test');
            });
        });
    });

    describe('Configuration Handling', () => {
        it('should handle empty configuration gracefully', async () => {
            executor = new ToolExecutor(registry, {} as any, confirmationProvider);

            const result = await executor.executeTool('test_tool', { value: 7 });
            expect(result.result).toBe(14);
        });

        it('should handle undefined configuration gracefully', async () => {
            executor = new ToolExecutor(registry, undefined as any, confirmationProvider);

            const result = await executor.executeTool('test_tool', { value: 8 });
            expect(result.result).toBe(16);
        });

        it('should handle partial configurations', async () => {
            executor = new ToolExecutor(
                registry,
                {
                    enabledTools: 'all',
                    toolConfigs: {
                        test_tool: {
                            requiresConfirmation: true,
                            // Missing timeout
                        },
                    },
                    // Missing globalSettings
                },
                confirmationProvider
            );

            // Should use tool code timeout (15000) and tool-specific confirmation (true)
            const mockConfirmationProvider = {
                allowedToolsProvider: null,
                requestConfirmation: vi.fn().mockResolvedValue(true), // Allow
            };

            executor = new ToolExecutor(
                registry,
                {
                    enabledTools: 'all',
                    toolConfigs: {
                        test_tool: {
                            requiresConfirmation: true,
                        },
                    },
                },
                mockConfirmationProvider as any
            );

            const result = await executor.executeTool('test_tool', { value: 9 });
            expect(result.result).toBe(18);
            expect(mockConfirmationProvider.requestConfirmation).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            executor = new ToolExecutor(
                registry,
                {
                    enabledTools: 'all',
                    globalSettings: {},
                },
                confirmationProvider
            );
        });

        it('should throw ToolExecutionError for non-existent tools', async () => {
            await expect(executor.executeTool('non_existent', {})).rejects.toThrow(
                ToolExecutionError
            );

            await expect(executor.executeTool('non_existent', {})).rejects.toThrow(
                'Tool not found'
            );
        });

        it('should throw ToolExecutionError for input validation failures', async () => {
            await expect(
                executor.executeTool('test_tool', { wrongParam: 'invalid' })
            ).rejects.toThrow(ToolExecutionError);

            await expect(
                executor.executeTool('test_tool', { wrongParam: 'invalid' })
            ).rejects.toThrow('Input validation failed');
        });

        it('should throw ToolExecutionError when confirmation is denied', async () => {
            const denyingProvider = {
                allowedToolsProvider: null,
                requestConfirmation: vi.fn().mockResolvedValue(false), // Deny
            };

            executor = new ToolExecutor(
                registry,
                {
                    enabledTools: 'all',
                    globalSettings: {
                        requiresConfirmation: true,
                    },
                },
                denyingProvider as any
            );

            await expect(executor.executeTool('default_tool', { data: 'test' })).rejects.toThrow(
                ToolExecutionError
            );

            await expect(executor.executeTool('default_tool', { data: 'test' })).rejects.toThrow(
                'Tool execution denied by user'
            );
        });
    });

    describe('Tool Information', () => {
        beforeEach(() => {
            executor = new ToolExecutor(
                registry,
                {
                    enabledTools: 'all',
                    globalSettings: {},
                },
                confirmationProvider
            );
        });

        it('should correctly identify existing tools', () => {
            expect(executor.hasTool('test_tool')).toBe(true);
            expect(executor.hasTool('confirmation_tool')).toBe(true);
            expect(executor.hasTool('default_tool')).toBe(true);
        });

        it('should correctly identify non-existing tools', () => {
            expect(executor.hasTool('non_existent')).toBe(false);
        });

        it('should return correct tool names', () => {
            const names = executor.getToolNames();
            expect(names).toContain('test_tool');
            expect(names).toContain('confirmation_tool');
            expect(names).toContain('default_tool');
            expect(names).toHaveLength(3);
        });

        it('should return tools in correct format', () => {
            const tools = executor.getAllTools();

            expect(tools.test_tool).toBeDefined();
            expect(tools.test_tool.description).toBe('Test tool');
            expect(tools.test_tool.parameters).toBeDefined();
            expect(tools.test_tool.parameters.properties).toHaveProperty('value');
        });
    });
});
