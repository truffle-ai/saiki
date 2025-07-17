import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    BasePlugin,
    HookExecutor,
    CONTINUE_HOOK_RESULT,
    stopHookExecution,
    modifyHookData,
} from './base.js';
import { PluginState, HookPriority } from './types.js';
import type { IPlugin, PluginContext } from './types.js';

// Mock logger
vi.mock('../logger/index.js', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Test plugin implementation
class TestPlugin extends BasePlugin {
    public override readonly name = 'test-plugin';
    public override readonly version = '1.0.0';
    public override readonly description = 'Test plugin for unit tests';
    public override readonly hooks = {
        beforeToolCall: vi.fn().mockResolvedValue({ continue: true }),
        afterToolCall: vi.fn().mockResolvedValue({ continue: true }),
    };

    protected override async onInitialize(): Promise<void> {
        // Test initialization logic
    }

    protected override async onCleanup(): Promise<void> {
        // Test cleanup logic
    }
}

// Mock plugin context
const createMockContext = (): PluginContext => ({
    sessionId: 'test-session',
    sessionEventBus: {} as any,
    agentEventBus: {} as any,
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    } as any,
    mcpManager: {} as any,
    promptManager: {} as any,
    stateManager: {} as any,
});

describe('BasePlugin', () => {
    let plugin: TestPlugin;
    let mockContext: PluginContext;

    beforeEach(() => {
        plugin = new TestPlugin();
        mockContext = createMockContext();
        vi.clearAllMocks();
    });

    describe('initialization', () => {
        it('should initialize plugin with context and config', async () => {
            const config = { testKey: 'testValue' };

            await plugin.initialize(mockContext, config);

            expect(plugin.getState()).toBe(PluginState.ACTIVE);
            expect((plugin as any).getConfig()).toEqual(config);
            expect((plugin as any).getContext()).toBe(mockContext);
        });

        it('should handle initialization errors', async () => {
            const errorPlugin = new (class extends BasePlugin {
                public override readonly name = 'error-plugin';
                public override readonly version = '1.0.0';
                public override readonly hooks = {};

                protected override async onInitialize(): Promise<void> {
                    throw new Error('Initialization failed');
                }
            })();

            await expect(errorPlugin.initialize(mockContext)).rejects.toThrow(
                'Initialization failed'
            );
            expect(errorPlugin.getState()).toBe(PluginState.ERROR);
        });
    });

    describe('cleanup', () => {
        it('should cleanup plugin successfully', async () => {
            await plugin.initialize(mockContext);
            await plugin.cleanup();

            expect(plugin.getState()).toBe(PluginState.UNLOADED);
        });

        it('should handle cleanup errors', async () => {
            const errorPlugin = new (class extends BasePlugin {
                public readonly name = 'error-plugin';
                public readonly version = '1.0.0';
                public readonly hooks = {};

                protected override async onCleanup(): Promise<void> {
                    throw new Error('Cleanup failed');
                }
            })();

            await errorPlugin.initialize(mockContext);

            await expect(errorPlugin.cleanup()).rejects.toThrow('Cleanup failed');
        });
    });

    describe('state management', () => {
        it('should track plugin state correctly', async () => {
            expect(plugin.getState()).toBe(PluginState.UNLOADED);

            await plugin.initialize(mockContext);
            expect(plugin.getState()).toBe(PluginState.ACTIVE);

            await plugin.cleanup();
            expect(plugin.getState()).toBe(PluginState.UNLOADED);
        });
    });

    describe('helper methods', () => {
        beforeEach(async () => {
            await plugin.initialize(mockContext);
        });

        it('should create hook results correctly', () => {
            const result = plugin['createHookResult'](
                true,
                { test: 'data' },
                undefined,
                'test message'
            );

            expect(result).toEqual({
                continue: true,
                modifiedData: { test: 'data' },
                error: undefined,
                message: 'test message',
            });
        });

        it('should throw error when accessing context before initialization', () => {
            const uninitializedPlugin = new TestPlugin();

            expect(() => uninitializedPlugin['getContext']()).toThrow('has not been initialized');
        });
    });
});

describe('HookExecutor', () => {
    let executor: HookExecutor;
    let mockPlugin1: IPlugin;
    let mockPlugin2: IPlugin;

    beforeEach(() => {
        executor = new HookExecutor();

        mockPlugin1 = {
            name: 'plugin1',
            version: '1.0.0',
            hooks: {
                beforeToolCall: vi
                    .fn()
                    .mockResolvedValue({ continue: true, message: 'Plugin 1 executed' }),
            },
            initialize: vi.fn(),
            cleanup: vi.fn(),
        };

        mockPlugin2 = {
            name: 'plugin2',
            version: '1.0.0',
            hooks: {
                beforeToolCall: vi
                    .fn()
                    .mockResolvedValue({ continue: true, message: 'Plugin 2 executed' }),
            },
            initialize: vi.fn(),
            cleanup: vi.fn(),
        };
    });

    describe('plugin registration', () => {
        it('should register plugins correctly', () => {
            executor.registerPlugin(mockPlugin1, HookPriority.HIGH);
            executor.registerPlugin(mockPlugin2, HookPriority.LOW);

            expect(executor.getPluginCount()).toBe(2);
            expect(executor.getRegisteredPlugins()).toEqual(['plugin1', 'plugin2']);
        });

        it('should unregister plugins correctly', () => {
            executor.registerPlugin(mockPlugin1);
            executor.unregisterPlugin('plugin1');

            expect(executor.getPluginCount()).toBe(0);
            expect(executor.getRegisteredPlugins()).toEqual([]);
        });
    });

    describe('hook execution', () => {
        it('should execute hooks in priority order', async () => {
            // Register plugins with different priorities
            executor.registerPlugin(mockPlugin1, HookPriority.LOW); // 75
            executor.registerPlugin(mockPlugin2, HookPriority.HIGH); // 25

            const context = {
                toolName: 'test-tool',
                args: { test: 'value' },
                sessionId: 'test-session',
            } as any;

            const result = await executor.executeHook('beforeToolCall', context);

            expect(result.success).toBe(true);
            expect(result.messages).toEqual([
                'plugin2: Plugin 2 executed',
                'plugin1: Plugin 1 executed',
            ]);

            // Verify execution order (plugin2 first due to higher priority)
            expect(mockPlugin2.hooks.beforeToolCall).toHaveBeenCalled();
            expect(mockPlugin1.hooks.beforeToolCall).toHaveBeenCalled();
        });

        it('should handle hook execution errors', async () => {
            const errorPlugin: IPlugin = {
                name: 'error-plugin',
                version: '1.0.0',
                hooks: {
                    beforeToolCall: vi.fn().mockRejectedValue(new Error('Hook failed')),
                },
                initialize: vi.fn(),
                cleanup: vi.fn(),
            };

            executor.registerPlugin(errorPlugin);

            const context = { toolName: 'test-tool', args: {} } as any;
            const result = await executor.executeHook('beforeToolCall', context);

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error?.message).toBe('Hook failed');
        });

        it('should stop execution when plugin returns continue: false', async () => {
            const stoppingPlugin: IPlugin = {
                name: 'stopping-plugin',
                version: '1.0.0',
                hooks: {
                    beforeToolCall: vi
                        .fn()
                        .mockResolvedValue({ continue: false, message: 'Stopped' }),
                },
                initialize: vi.fn(),
                cleanup: vi.fn(),
            };

            executor.registerPlugin(stoppingPlugin, HookPriority.HIGH);
            executor.registerPlugin(mockPlugin1, HookPriority.LOW);

            const context = { toolName: 'test-tool', args: {} } as any;
            const result = await executor.executeHook('beforeToolCall', context);

            expect(result.success).toBe(true);
            expect(result.messages).toEqual(['stopping-plugin: Stopped']);

            // Second plugin should not have been called
            expect(mockPlugin1.hooks.beforeToolCall).not.toHaveBeenCalled();
        });

        it('should handle data modification', async () => {
            const modifyingPlugin: IPlugin = {
                name: 'modifying-plugin',
                version: '1.0.0',
                hooks: {
                    beforeToolCall: vi.fn().mockResolvedValue({
                        continue: true,
                        modifiedData: { modified: true },
                        message: 'Data modified',
                    }),
                },
                initialize: vi.fn(),
                cleanup: vi.fn(),
            };

            executor.registerPlugin(modifyingPlugin);

            const context = { toolName: 'test-tool', args: { original: true } } as any;
            const result = await executor.executeHook('beforeToolCall', context, {
                original: true,
            });

            expect(result.success).toBe(true);
            expect(result.result).toEqual({ modified: true });
        });

        it('should return early when no plugins implement the hook', async () => {
            const pluginWithoutHook: IPlugin = {
                name: 'no-hook-plugin',
                version: '1.0.0',
                hooks: {}, // No hooks implemented
                initialize: vi.fn(),
                cleanup: vi.fn(),
            };

            executor.registerPlugin(pluginWithoutHook);

            const context = { toolName: 'test-tool', args: {} } as any;
            const result = await executor.executeHook('beforeToolCall', context);

            expect(result.success).toBe(true);
            expect(result.messages).toEqual([]);
        });
    });

    describe('lifecycle hook execution', () => {
        it('should execute lifecycle hooks for all plugins', async () => {
            const lifecyclePlugin1: IPlugin = {
                name: 'lifecycle1',
                version: '1.0.0',
                hooks: {
                    onSessionStart: vi.fn().mockResolvedValue(undefined),
                },
                initialize: vi.fn(),
                cleanup: vi.fn(),
            };

            const lifecyclePlugin2: IPlugin = {
                name: 'lifecycle2',
                version: '1.0.0',
                hooks: {
                    onSessionStart: vi.fn().mockResolvedValue(undefined),
                },
                initialize: vi.fn(),
                cleanup: vi.fn(),
            };

            executor.registerPlugin(lifecyclePlugin1);
            executor.registerPlugin(lifecyclePlugin2);

            const context = { sessionId: 'test-session' } as any;
            await executor.executeLifecycleHook('onSessionStart', context);

            expect(lifecyclePlugin1.hooks.onSessionStart).toHaveBeenCalledWith(context);
            expect(lifecyclePlugin2.hooks.onSessionStart).toHaveBeenCalledWith(context);
        });

        it('should continue execution even if some lifecycle hooks fail', async () => {
            const errorPlugin: IPlugin = {
                name: 'error-plugin',
                version: '1.0.0',
                hooks: {
                    onSessionStart: vi.fn().mockRejectedValue(new Error('Lifecycle failed')),
                },
                initialize: vi.fn(),
                cleanup: vi.fn(),
            };

            const successPlugin: IPlugin = {
                name: 'success-plugin',
                version: '1.0.0',
                hooks: {
                    onSessionStart: vi.fn().mockResolvedValue(undefined),
                },
                initialize: vi.fn(),
                cleanup: vi.fn(),
            };

            executor.registerPlugin(errorPlugin);
            executor.registerPlugin(successPlugin);

            const context = { sessionId: 'test-session' } as any;

            // Should not throw, but continue execution
            await expect(
                executor.executeLifecycleHook('onSessionStart', context)
            ).resolves.not.toThrow();

            expect(errorPlugin.hooks.onSessionStart).toHaveBeenCalled();
            expect(successPlugin.hooks.onSessionStart).toHaveBeenCalled();
        });
    });

    describe('utility methods', () => {
        it('should clear all plugins', () => {
            executor.registerPlugin(mockPlugin1);
            executor.registerPlugin(mockPlugin2);

            executor.clear();

            expect(executor.getPluginCount()).toBe(0);
            expect(executor.getRegisteredPlugins()).toEqual([]);
        });
    });
});

describe('Utility functions', () => {
    describe('CONTINUE_HOOK_RESULT', () => {
        it('should provide default continue result', () => {
            expect(CONTINUE_HOOK_RESULT).toEqual({ continue: true });
        });
    });

    describe('stopHookExecution', () => {
        it('should create stop execution result', () => {
            const result = stopHookExecution('Test message', new Error('Test error'));

            expect(result).toEqual({
                continue: false,
                message: 'Test message',
                error: new Error('Test error'),
            });
        });

        it('should create stop execution result without parameters', () => {
            const result = stopHookExecution();

            expect(result).toEqual({
                continue: false,
                message: undefined,
                error: undefined,
            });
        });
    });

    describe('modifyHookData', () => {
        it('should create data modification result', () => {
            const data = { test: 'value' };
            const result = modifyHookData(data, 'Modified data');

            expect(result).toEqual({
                continue: true,
                modifiedData: data,
                message: 'Modified data',
            });
        });
    });
});
