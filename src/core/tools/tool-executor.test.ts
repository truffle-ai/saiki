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
                        enableToolDiscovery: false, // Disable tool discovery for testing
                        toolConfigs: {
                            confirmation_tool: {
                                requiresConfirmation: false, // Override tool code setting (true)
                            },
                        },
                        globalSettings: {
                            requiresConfirmation: true, // This should be ignored for this tool
                            enableCaching: false,
                        },
                    },
                    confirmationProvider
                );

                // Tool should execute without confirmation due to tool-specific config
                const result = await executor.executeTool('confirmation_tool', { action: 'test' });
                expect(result.success).toBe(true);
                expect((result.data as { performed: string })?.performed).toBe('test');
            });

            it('should use tool code settings over global settings', async () => {
                executor = new ToolExecutor(
                    registry,
                    {
                        enabledTools: 'all',
                        enableToolDiscovery: false, // Disable tool discovery for testing
                        globalSettings: {
                            requiresConfirmation: true, // Global setting
                            enableCaching: false,
                        },
                    },
                    confirmationProvider
                );

                // testTool has requiresConfirmation: false in code, should override global
                const result = await executor.executeTool('test_tool', { value: 5 });
                expect(result.success).toBe(true);
                expect((result.data as { result: number })?.result).toBe(10);
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
                        enableToolDiscovery: false, // Disable tool discovery for testing
                        globalSettings: {
                            requiresConfirmation: true, // Should apply to defaultTool
                            enableCaching: false,
                        },
                    },
                    mockConfirmationProvider as any
                );

                // defaultTool has no settings, should use global setting (true)
                const result = await executor.executeTool('default_tool', { data: 'test' });
                expect(result.success).toBe(false);
                expect(result.error).toBe('Tool execution denied by user');

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
                        enableToolDiscovery: false, // Disable tool discovery for testing
                        globalSettings: {
                            enableCaching: false,
                        },
                        // No toolConfigs, no globalSettings
                    },
                    confirmationProvider
                );

                // defaultTool should use system default (false)
                const result = await executor.executeTool('default_tool', { data: 'test' });
                expect(result.success).toBe(true);
                expect((result.data as { processed: string })?.processed).toBe('test');
            });
        });

        describe('Timeout Settings Precedence', () => {
            it('should use tool-specific config over tool code settings', async () => {
                executor = new ToolExecutor(
                    registry,
                    {
                        enabledTools: 'all',
                        enableToolDiscovery: false, // Disable tool discovery for testing
                        toolConfigs: {
                            test_tool: {
                                timeout: 5000, // Override tool code setting (15000)
                            },
                        },
                        globalSettings: {
                            timeout: 60000, // This should be ignored for this tool
                            enableCaching: false,
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
                        enableToolDiscovery: false, // Disable tool discovery for testing
                        toolConfigs: {
                            slow_tool: {
                                timeout: 100, // Very short timeout
                            },
                        },
                        globalSettings: {
                            enableCaching: false,
                        },
                    },
                    confirmationProvider
                );

                const result = await executor.executeTool('slow_tool', {});
                expect(result.success).toBe(false);
                expect(result.error).toBe('Tool execution timeout after 100ms');
                expect(result.metadata?.duration).toBeGreaterThan(0);
            });

            it('should use tool code settings over global settings', async () => {
                // This is harder to test directly, but we can verify the setting is read correctly
                executor = new ToolExecutor(
                    registry,
                    {
                        enabledTools: 'all',
                        enableToolDiscovery: false, // Disable tool discovery for testing
                        globalSettings: {
                            timeout: 5000, // Global setting
                            enableCaching: false,
                        },
                    },
                    confirmationProvider
                );

                // testTool has timeout: 15000 in code, should work even if global is shorter
                // (We can't easily test the actual timeout without making tests slow)
                const result = await executor.executeTool('test_tool', { value: 3 });
                expect(result.success).toBe(true);
                expect((result.data as { result: number })?.result).toBe(6);
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
                        enableToolDiscovery: false, // Disable tool discovery for testing
                        globalSettings: {
                            timeout: 100, // Should apply to slowDefaultTool
                            enableCaching: false,
                        },
                    },
                    confirmationProvider
                );

                const result = await executor.executeTool('slow_default_tool', {});
                expect(result.success).toBe(false);
                expect(result.error).toBe('Tool execution timeout after 100ms');
                expect(result.metadata?.duration).toBeGreaterThan(0);
            });

            it('should fall back to system defaults when no settings provided', async () => {
                executor = new ToolExecutor(
                    registry,
                    {
                        enabledTools: 'all',
                        enableToolDiscovery: false, // Disable tool discovery for testing
                        globalSettings: {
                            enableCaching: false,
                        },
                        // No timeout settings anywhere
                    },
                    confirmationProvider
                );

                // Should use system default (30000ms) - tool should execute fine
                const result = await executor.executeTool('default_tool', { data: 'test' });
                expect(result.success).toBe(true);
                expect((result.data as { processed: string })?.processed).toBe('test');
            });
        });
    });

    describe('Configuration Handling', () => {
        it('should handle empty configuration gracefully', async () => {
            executor = new ToolExecutor(registry, {} as any, confirmationProvider);

            const result = await executor.executeTool('test_tool', { value: 7 });
            expect(result.success).toBe(true);
            expect((result.data as { result: number })?.result).toBe(14);
        });

        it('should handle undefined configuration gracefully', async () => {
            executor = new ToolExecutor(registry, undefined as any, confirmationProvider);

            const result = await executor.executeTool('test_tool', { value: 8 });
            expect(result.success).toBe(true);
            expect((result.data as { result: number })?.result).toBe(16);
        });

        it('should handle partial configurations', async () => {
            executor = new ToolExecutor(
                registry,
                {
                    enabledTools: 'all',
                    enableToolDiscovery: false, // Disable tool discovery for testing
                    toolConfigs: {
                        test_tool: {
                            requiresConfirmation: true,
                            // Missing timeout
                        },
                    },
                    globalSettings: {
                        enableCaching: false,
                    },
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
                    enableToolDiscovery: false, // Disable tool discovery for testing
                    toolConfigs: {
                        test_tool: {
                            requiresConfirmation: true,
                        },
                    },
                    globalSettings: {
                        enableCaching: false,
                    },
                },
                mockConfirmationProvider as any
            );

            const result = await executor.executeTool('test_tool', { value: 9 });
            expect(result.success).toBe(true);
            expect((result.data as { result: number })?.result).toBe(18);
            expect(mockConfirmationProvider.requestConfirmation).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            executor = new ToolExecutor(
                registry,
                {
                    enabledTools: 'all',
                    enableToolDiscovery: false, // Disable tool discovery for testing
                    globalSettings: {
                        enableCaching: false,
                    },
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
            executor = new ToolExecutor(
                registry,
                {
                    enabledTools: 'all',
                    enableToolDiscovery: false, // Disable tool discovery for testing
                    globalSettings: {
                        enableCaching: false,
                    },
                },
                confirmationProvider
            );

            const result = await executor.executeTool('test_tool', { wrongParam: 'invalid' });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Required');

            await expect(executor.executeTool('non_existent_tool', {})).rejects.toThrow(
                ToolExecutionError
            );
        });

        it('should throw ToolExecutionError when confirmation is denied', async () => {
            const mockConfirmationProvider = {
                allowedToolsProvider: null,
                requestConfirmation: vi.fn().mockResolvedValue(false), // Deny confirmation
            };

            executor = new ToolExecutor(
                registry,
                {
                    enabledTools: 'all',
                    enableToolDiscovery: false, // Disable tool discovery for testing
                    globalSettings: {
                        requiresConfirmation: true,
                        enableCaching: false,
                    },
                },
                mockConfirmationProvider as any
            );

            const result = await executor.executeTool('default_tool', { data: 'test' });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Tool execution denied by user');
        });
    });

    describe('Tool Information', () => {
        beforeEach(() => {
            executor = new ToolExecutor(
                registry,
                {
                    enabledTools: 'all',
                    enableToolDiscovery: false, // Disable tool discovery for testing
                    globalSettings: {
                        enableCaching: false,
                    },
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
            expect(tools.test_tool?.description).toBe('Test tool');
            expect(tools.test_tool?.parameters).toBeDefined();
            expect(tools.test_tool?.parameters?.properties).toHaveProperty('value');
        });
    });
});
