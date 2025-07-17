import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { PluginManager } from './manager.js';
import { PluginState } from './types.js';
import type { PluginConfig, PluginContext } from './types.js';

// Mock logger
vi.mock('../logger/index.js', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Test plugin content
const createTestPluginContent = (name: string) => `
export default class ${name}Plugin {
    constructor() {
        this.name = '${name}';
        this.version = '1.0.0';
        this.description = 'Test plugin for unit tests';
        this.hooks = {
            beforeToolCall: this.beforeToolCall.bind(this),
        };
    }

    async initialize(context, config) {
        this.context = context;
        this.config = config || {};
    }

    async cleanup() {
        // Cleanup logic
    }

    async beforeToolCall(context) {
        return {
            continue: true,
            message: '${name} plugin executed'
        };
    }
}
`;

const createInvalidPluginContent = () => `
// Invalid plugin - doesn't export default class
export const notAPlugin = {};
`;

const createErrorPluginContent = () => `
export default class ErrorPlugin {
    constructor() {
        this.name = 'error-plugin';
        this.version = '1.0.0';
        this.hooks = {};
    }

    async initialize(context, config) {
        throw new Error('Plugin initialization failed');
    }

    async cleanup() {
        // Cleanup logic
    }
}
`;

// Mock plugin context
const createMockContext = (): Omit<PluginContext, 'sessionId' | 'sessionEventBus'> => ({
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

describe('PluginManager', () => {
    let pluginManager: PluginManager;
    let mockContext: Omit<PluginContext, 'sessionId' | 'sessionEventBus'>;
    let testDir: string;
    let pluginsDir: string;

    beforeEach(async () => {
        mockContext = createMockContext();
        testDir = join(process.cwd(), 'test-temp', `plugin-test-${Date.now()}`);
        pluginsDir = join(testDir, 'plugins');

        // Create test directory structure
        await mkdir(pluginsDir, { recursive: true });

        pluginManager = new PluginManager(mockContext, testDir);
        vi.clearAllMocks();
    });

    afterEach(async () => {
        try {
            await pluginManager.cleanup();
            await rm(testDir, { recursive: true, force: true });
        } catch (_error) {
            // Ignore cleanup errors
        }
    });

    describe('plugin loading', () => {
        it('should load a valid plugin successfully', async () => {
            // Create test plugin file
            const pluginPath = join(pluginsDir, 'test-plugin.js');
            await writeFile(pluginPath, createTestPluginContent('Test'));

            const config: PluginConfig = {
                name: 'Test',
                path: './plugins/test-plugin.js',
                enabled: true,
            };

            const result = await pluginManager.loadPlugin(config);

            expect(result.success).toBe(true);
            expect(result.plugin).toBeDefined();
            expect(result.plugin?.name).toBe('Test');
            expect(pluginManager.getActivePluginCount()).toBe(0); // Not initialized yet
        });

        it('should reject plugin with missing file', async () => {
            const config: PluginConfig = {
                name: 'NonExistent',
                path: './plugins/non-existent.js',
                enabled: true,
            };

            const result = await pluginManager.loadPlugin(config);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Plugin file not found');
        });

        it('should reject plugin with invalid export', async () => {
            // Create invalid plugin file
            const pluginPath = join(pluginsDir, 'invalid-plugin.js');
            await writeFile(pluginPath, createInvalidPluginContent());

            const config: PluginConfig = {
                name: 'Invalid',
                path: './plugins/invalid-plugin.js',
                enabled: true,
            };

            const result = await pluginManager.loadPlugin(config);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Plugin must export a default class');
        });

        it('should reject plugin with name mismatch', async () => {
            // Create plugin with different name
            const pluginPath = join(pluginsDir, 'mismatch-plugin.js');
            await writeFile(pluginPath, createTestPluginContent('WrongName'));

            const config: PluginConfig = {
                name: 'ExpectedName',
                path: './plugins/mismatch-plugin.js',
                enabled: true,
            };

            const result = await pluginManager.loadPlugin(config);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Plugin name mismatch');
        });

        it('should load multiple plugins with priority ordering', async () => {
            // Create multiple test plugins
            const plugin1Path = join(pluginsDir, 'plugin1.js');
            const plugin2Path = join(pluginsDir, 'plugin2.js');
            await writeFile(plugin1Path, createTestPluginContent('Plugin1'));
            await writeFile(plugin2Path, createTestPluginContent('Plugin2'));

            const configs: PluginConfig[] = [
                {
                    name: 'Plugin1',
                    path: './plugins/plugin1.js',
                    enabled: true,
                    priority: 100,
                },
                {
                    name: 'Plugin2',
                    path: './plugins/plugin2.js',
                    enabled: true,
                    priority: 50,
                },
            ];

            await pluginManager.loadPlugins(configs);

            const plugins = pluginManager.getPlugins();
            expect(plugins.size).toBe(2);
            expect(plugins.has('Plugin1')).toBe(true);
            expect(plugins.has('Plugin2')).toBe(true);
        });

        it('should skip disabled plugins', async () => {
            const pluginPath = join(pluginsDir, 'disabled-plugin.js');
            await writeFile(pluginPath, createTestPluginContent('Disabled'));

            const configs: PluginConfig[] = [
                {
                    name: 'Disabled',
                    path: './plugins/disabled-plugin.js',
                    enabled: false,
                },
            ];

            await pluginManager.loadPlugins(configs);

            expect(pluginManager.getPlugins().size).toBe(0);
        });
    });

    describe('plugin initialization', () => {
        beforeEach(async () => {
            // Create and load a test plugin
            const pluginPath = join(pluginsDir, 'init-test.js');
            await writeFile(pluginPath, createTestPluginContent('InitTest'));

            const config: PluginConfig = {
                name: 'InitTest',
                path: './plugins/init-test.js',
                enabled: true,
            };

            await pluginManager.loadPlugin(config);
        });

        it('should initialize loaded plugins', async () => {
            await pluginManager.initializePlugins();

            expect(pluginManager.getActivePluginCount()).toBe(1);
            expect(pluginManager.isPluginActive('InitTest')).toBe(true);
        });

        it('should handle plugin initialization errors', async () => {
            // Create error plugin
            const errorPluginPath = join(pluginsDir, 'error-plugin.js');
            await writeFile(errorPluginPath, createErrorPluginContent());

            const config: PluginConfig = {
                name: 'error-plugin',
                path: './plugins/error-plugin.js',
                enabled: true,
            };

            await pluginManager.loadPlugin(config);

            // Should not throw, but plugin should be in error state
            await pluginManager.initializePlugins();

            const plugins = pluginManager.getPlugins();
            const errorPlugin = plugins.get('error-plugin');
            expect(errorPlugin?.state).toBe(PluginState.ERROR);
        });
    });

    describe('plugin execution', () => {
        beforeEach(async () => {
            // Create and load test plugins
            const plugin1Path = join(pluginsDir, 'exec-test1.js');
            const plugin2Path = join(pluginsDir, 'exec-test2.js');
            await writeFile(plugin1Path, createTestPluginContent('ExecTest1'));
            await writeFile(plugin2Path, createTestPluginContent('ExecTest2'));

            const configs: PluginConfig[] = [
                {
                    name: 'ExecTest1',
                    path: './plugins/exec-test1.js',
                    enabled: true,
                    priority: 10,
                },
                {
                    name: 'ExecTest2',
                    path: './plugins/exec-test2.js',
                    enabled: true,
                    priority: 20,
                },
            ];

            await pluginManager.loadPlugins(configs);
            await pluginManager.initializePlugins();
        });

        it('should execute hooks across all active plugins', async () => {
            const sessionId = 'test-session';
            const sessionEventBus = {} as any;
            const context = {
                toolName: 'test-tool',
                args: { test: 'value' },
                sessionId,
                sessionEventBus,
                ...mockContext,
            } as any;

            const result = await pluginManager.executeHook(
                'beforeToolCall',
                sessionId,
                sessionEventBus,
                context
            );

            expect(result.success).toBe(true);
            expect(result.messages).toHaveLength(2);
            expect(result.messages).toContain('ExecTest1: ExecTest1 plugin executed');
            expect(result.messages).toContain('ExecTest2: ExecTest2 plugin executed');
        });

        it('should execute lifecycle hooks', async () => {
            const sessionId = 'test-session';
            const sessionEventBus = {} as any;
            const context = {
                sessionId,
                sessionEventBus,
                ...mockContext,
            } as any;

            // Should not throw for lifecycle hooks (even if not implemented)
            await expect(
                pluginManager.executeLifecycleHook(
                    'onSessionStart',
                    sessionId,
                    sessionEventBus,
                    context
                )
            ).resolves.not.toThrow();
        });
    });

    describe('plugin management', () => {
        beforeEach(async () => {
            // Create and load a test plugin
            const pluginPath = join(pluginsDir, 'mgmt-test.js');
            await writeFile(pluginPath, createTestPluginContent('MgmtTest'));

            const config: PluginConfig = {
                name: 'MgmtTest',
                path: './plugins/mgmt-test.js',
                enabled: true,
            };

            await pluginManager.loadPlugin(config);
            await pluginManager.initializePlugins();
        });

        it('should get plugin by name', () => {
            const plugin = pluginManager.getPlugin('MgmtTest');
            expect(plugin).toBeDefined();
            expect(plugin?.name).toBe('MgmtTest');
        });

        it('should get plugin states', () => {
            const states = pluginManager.getPluginStates();
            expect(states.get('MgmtTest')).toBe(PluginState.ACTIVE);
        });

        it('should unload plugins', async () => {
            await pluginManager.unloadPlugin('MgmtTest');

            expect(pluginManager.getPlugin('MgmtTest')).toBeUndefined();
            expect(pluginManager.getActivePluginCount()).toBe(0);
        });

        it('should handle unloading non-existent plugins', async () => {
            // Should not throw
            await expect(pluginManager.unloadPlugin('NonExistent')).resolves.not.toThrow();
        });
    });

    describe('configuration', () => {
        it('should get and set config base path', () => {
            const newPath = '/new/path';
            pluginManager.setConfigBasePath(newPath);
            expect(pluginManager.getConfigBasePath()).toBe(newPath);
        });

        it('should use config base path for plugin loading', () => {
            const currentPath = pluginManager.getConfigBasePath();
            expect(currentPath).toBe(testDir);
        });
    });

    describe('cleanup', () => {
        beforeEach(async () => {
            // Create and load test plugins
            const plugin1Path = join(pluginsDir, 'cleanup1.js');
            const plugin2Path = join(pluginsDir, 'cleanup2.js');
            await writeFile(plugin1Path, createTestPluginContent('Cleanup1'));
            await writeFile(plugin2Path, createTestPluginContent('Cleanup2'));

            const configs: PluginConfig[] = [
                {
                    name: 'Cleanup1',
                    path: './plugins/cleanup1.js',
                    enabled: true,
                },
                {
                    name: 'Cleanup2',
                    path: './plugins/cleanup2.js',
                    enabled: true,
                },
            ];

            await pluginManager.loadPlugins(configs);
            await pluginManager.initializePlugins();
        });

        it('should cleanup all plugins', async () => {
            expect(pluginManager.getActivePluginCount()).toBe(2);

            await pluginManager.cleanup();

            expect(pluginManager.getActivePluginCount()).toBe(0);
            expect(pluginManager.getPlugins().size).toBe(0);
        });
    });

    describe('error handling', () => {
        it('should handle plugin validation errors', async () => {
            // Create plugin with missing required properties
            const invalidPluginContent = `
                export default class InvalidPlugin {
                    constructor() {
                        // Missing required properties
                    }
                }
            `;

            const pluginPath = join(pluginsDir, 'validation-test.js');
            await writeFile(pluginPath, invalidPluginContent);

            const config: PluginConfig = {
                name: 'ValidationTest',
                path: './plugins/validation-test.js',
                enabled: true,
            };

            const result = await pluginManager.loadPlugin(config);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Plugin must have');
        });

        it('should continue loading other plugins when one fails', async () => {
            // Create one valid and one invalid plugin
            const validPluginPath = join(pluginsDir, 'valid.js');
            const invalidPluginPath = join(pluginsDir, 'invalid.js');
            await writeFile(validPluginPath, createTestPluginContent('Valid'));
            await writeFile(invalidPluginPath, createInvalidPluginContent());

            const configs: PluginConfig[] = [
                {
                    name: 'Valid',
                    path: './plugins/valid.js',
                    enabled: true,
                },
                {
                    name: 'Invalid',
                    path: './plugins/invalid.js',
                    enabled: true,
                },
            ];

            await pluginManager.loadPlugins(configs);

            // Should have loaded the valid plugin despite the invalid one
            expect(pluginManager.getPlugins().has('Valid')).toBe(true);
            expect(pluginManager.getPlugins().has('Invalid')).toBe(false);
        });
    });
});
