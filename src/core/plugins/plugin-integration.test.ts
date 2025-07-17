import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
// import { VercelLLMService } from '../ai/llm/services/vercel.js';
import { PluginManager } from './manager.js';
// import { PluginState } from './types.js';
import type { PluginContext } from './types.js';
import type { MCPManager } from '../client/manager.js';
import type { ContextManager } from '../ai/llm/messages/manager.js';
import type { SessionEventBus } from '../events/index.js';

// Mock dependencies
vi.mock('../logger/index.js', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../ai/llm/services/vercel.js');
vi.mock('../client/manager.js');
vi.mock('../ai/llm/messages/manager.js');
vi.mock('../events/index.js');

// Test plugin that modifies tool arguments
const createArgumentModifierPlugin = () => `
export default class ArgumentModifierPlugin {
    constructor() {
        this.name = 'argument-modifier';
        this.version = '1.0.0';
        this.description = 'Modifies tool arguments for testing';
        this.hooks = {
            beforeToolCall: this.beforeToolCall.bind(this),
        };
    }

    async initialize(context, config) {
        this.context = context;
        this.config = config || {};
    }

    async cleanup() {}

    async beforeToolCall(context) {
        const modifiedArgs = {
            ...context.args,
            modifiedBy: 'plugin',
            originalValue: context.args.value,
            value: context.args.value + '_modified'
        };

        return {
            continue: true,
            modifiedData: modifiedArgs,
            message: 'Arguments modified by plugin'
        };
    }
}
`;

// Test plugin that blocks certain tools
const createToolBlockerPlugin = () => `
export default class ToolBlockerPlugin {
    constructor() {
        this.name = 'tool-blocker';
        this.version = '1.0.0';
        this.description = 'Blocks certain tools for testing';
        this.hooks = {
            beforeToolCall: this.beforeToolCall.bind(this),
        };
    }

    async initialize(context, config) {
        this.context = context;
        this.config = config || {};
        this.blockedTools = this.config.blockedTools || [];
    }

    async cleanup() {}

    async beforeToolCall(context) {
        if (this.blockedTools.includes(context.toolName)) {
            return {
                continue: false,
                error: new Error(\`Tool '\${context.toolName}' is blocked by policy\`),
                message: \`Blocked tool: \${context.toolName}\`
            };
        }

        return {
            continue: true,
            message: \`Allowed tool: \${context.toolName}\`
        };
    }
}
`;

// Test plugin that logs tool results
const createResultLoggerPlugin = () => `
export default class ResultLoggerPlugin {
    constructor() {
        this.name = 'result-logger';
        this.version = '1.0.0';
        this.description = 'Logs tool results for testing';
        this.hooks = {
            afterToolCall: this.afterToolCall.bind(this),
        };
        this.loggedResults = [];
    }

    async initialize(context, config) {
        this.context = context;
        this.config = config || {};
    }

    async cleanup() {}

    async afterToolCall(context) {
        const logEntry = {
            toolName: context.toolName,
            args: context.args,
            result: context.result,
            success: context.success,
            timestamp: new Date().toISOString()
        };

        this.loggedResults.push(logEntry);

        return {
            continue: true,
            message: \`Logged result for: \${context.toolName}\`
        };
    }

    getLoggedResults() {
        return this.loggedResults;
    }
}
`;

describe('Plugin Integration Tests', () => {
    let pluginManager: PluginManager;
    let mockMCPManager: MCPManager;
    let _mockContextManager: ContextManager;
    let mockSessionEventBus: SessionEventBus;
    let mockContext: Omit<PluginContext, 'sessionId' | 'sessionEventBus'>;
    let testDir: string;
    let pluginsDir: string;

    beforeEach(async () => {
        // Create mock dependencies
        mockMCPManager = {
            executeTool: vi.fn(),
            getAllTools: vi.fn(),
            agentEventBus: {} as any,
        } as any;

        _mockContextManager = {
            promptManager: {} as any,
            stateManager: {} as any,
        } as any;

        mockSessionEventBus = {} as any;

        mockContext = {
            agentEventBus: {} as any,
            logger: {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            } as any,
            mcpManager: mockMCPManager,
            promptManager: {} as any,
            stateManager: {} as any,
        };

        // Set up test directory
        testDir = join(process.cwd(), 'test-temp', `plugin-integration-${Date.now()}`);
        pluginsDir = join(testDir, 'plugins');
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

    describe('Tool execution with plugins', () => {
        it('should modify tool arguments through plugins', async () => {
            // Create and load argument modifier plugin
            const pluginPath = join(pluginsDir, 'arg-modifier.js');
            await writeFile(pluginPath, createArgumentModifierPlugin());

            const config = {
                name: 'argument-modifier',
                path: './plugins/arg-modifier.js',
                enabled: true,
            };

            await pluginManager.loadPlugin(config);
            await pluginManager.initializePlugins();

            // Test hook execution
            const sessionId = 'test-session';
            const context = {
                toolName: 'test-tool',
                args: { value: 'original' },
                sessionId,
                sessionEventBus: mockSessionEventBus,
                ...mockContext,
            } as any;

            const result = await pluginManager.executeHook(
                'beforeToolCall',
                sessionId,
                mockSessionEventBus,
                context,
                { value: 'original' }
            );

            expect(result.success).toBe(true);
            expect(result.result).toEqual({
                value: 'original_modified',
                modifiedBy: 'plugin',
                originalValue: 'original',
            });
            expect(result.messages).toContain('argument-modifier: Arguments modified by plugin');
        });

        it('should block tools through plugins', async () => {
            // Create and load tool blocker plugin
            const pluginPath = join(pluginsDir, 'tool-blocker.js');
            await writeFile(pluginPath, createToolBlockerPlugin());

            const config = {
                name: 'tool-blocker',
                path: './plugins/tool-blocker.js',
                enabled: true,
                config: {
                    blockedTools: ['dangerous-tool', 'blocked-tool'],
                },
            };

            await pluginManager.loadPlugin(config);
            await pluginManager.initializePlugins();

            // Test blocking a dangerous tool
            const sessionId = 'test-session';
            const blockedContext = {
                toolName: 'dangerous-tool',
                args: {},
                sessionId,
                sessionEventBus: mockSessionEventBus,
                ...mockContext,
            } as any;

            const blockedResult = await pluginManager.executeHook(
                'beforeToolCall',
                sessionId,
                mockSessionEventBus,
                blockedContext
            );

            expect(blockedResult.success).toBe(false);
            expect(blockedResult.error?.message).toContain("dangerous-tool' is blocked by policy");

            // Test allowing a safe tool
            const allowedContext = {
                toolName: 'safe-tool',
                args: {},
                sessionId,
                sessionEventBus: mockSessionEventBus,
                ...mockContext,
            } as any;

            const allowedResult = await pluginManager.executeHook(
                'beforeToolCall',
                sessionId,
                mockSessionEventBus,
                allowedContext
            );

            expect(allowedResult.success).toBe(true);
            expect(allowedResult.messages).toContain('tool-blocker: Allowed tool: safe-tool');
        });

        it('should log tool results through plugins', async () => {
            // Create and load result logger plugin
            const pluginPath = join(pluginsDir, 'result-logger.js');
            await writeFile(pluginPath, createResultLoggerPlugin());

            const config = {
                name: 'result-logger',
                path: './plugins/result-logger.js',
                enabled: true,
            };

            await pluginManager.loadPlugin(config);
            await pluginManager.initializePlugins();

            // Get the plugin instance to access logged results
            const plugin = pluginManager.getPlugin('result-logger');
            expect(plugin).toBeDefined();

            // Test hook execution for successful tool call
            const sessionId = 'test-session';
            const successContext = {
                toolName: 'test-tool',
                args: { input: 'test' },
                result: { output: 'success' },
                success: true,
                sessionId,
                sessionEventBus: mockSessionEventBus,
                ...mockContext,
            } as any;

            const successResult = await pluginManager.executeHook(
                'afterToolCall',
                sessionId,
                mockSessionEventBus,
                successContext
            );

            expect(successResult.success).toBe(true);
            expect(successResult.messages).toContain('result-logger: Logged result for: test-tool');

            // Check that result was logged
            const loggedResults = (plugin as any).getLoggedResults();
            expect(loggedResults).toHaveLength(1);
            expect(loggedResults[0]).toMatchObject({
                toolName: 'test-tool',
                args: { input: 'test' },
                result: { output: 'success' },
                success: true,
            });

            // Test hook execution for failed tool call
            const failureContext = {
                toolName: 'failing-tool',
                args: { input: 'test' },
                result: new Error('Tool failed'),
                success: false,
                sessionId,
                sessionEventBus: mockSessionEventBus,
                ...mockContext,
            } as any;

            await pluginManager.executeHook(
                'afterToolCall',
                sessionId,
                mockSessionEventBus,
                failureContext
            );

            // Check that failure was also logged
            const updatedResults = (plugin as any).getLoggedResults();
            expect(updatedResults).toHaveLength(2);
            expect(updatedResults[1]).toMatchObject({
                toolName: 'failing-tool',
                success: false,
            });
        });
    });

    describe('Plugin execution order', () => {
        it('should execute plugins in priority order', async () => {
            // Create multiple plugins with different priorities
            const plugin1Path = join(pluginsDir, 'priority1.js');
            const plugin2Path = join(pluginsDir, 'priority2.js');
            const plugin3Path = join(pluginsDir, 'priority3.js');

            const createPriorityPlugin = (name: string, priority: number) => `
                export default class Priority${priority}Plugin {
                    constructor() {
                        this.name = '${name}';
                        this.version = '1.0.0';
                        this.hooks = {
                            beforeToolCall: this.beforeToolCall.bind(this),
                        };
                    }

                    async initialize(context, config) {
                        this.context = context;
                    }

                    async cleanup() {}

                    async beforeToolCall(context) {
                        return {
                            continue: true,
                            message: 'Plugin ${name} (priority ${priority}) executed'
                        };
                    }
                }
            `;

            await writeFile(plugin1Path, createPriorityPlugin('priority-high', 10));
            await writeFile(plugin2Path, createPriorityPlugin('priority-medium', 50));
            await writeFile(plugin3Path, createPriorityPlugin('priority-low', 90));

            const configs = [
                {
                    name: 'priority-medium',
                    path: './plugins/priority2.js',
                    enabled: true,
                    priority: 50,
                },
                {
                    name: 'priority-low',
                    path: './plugins/priority3.js',
                    enabled: true,
                    priority: 90,
                },
                {
                    name: 'priority-high',
                    path: './plugins/priority1.js',
                    enabled: true,
                    priority: 10,
                },
            ];

            await pluginManager.loadPlugins(configs);
            await pluginManager.initializePlugins();

            // Execute hook and verify order
            const sessionId = 'test-session';
            const context = {
                toolName: 'test-tool',
                args: {},
                sessionId,
                sessionEventBus: mockSessionEventBus,
                ...mockContext,
            } as any;

            const result = await pluginManager.executeHook(
                'beforeToolCall',
                sessionId,
                mockSessionEventBus,
                context
            );

            expect(result.success).toBe(true);
            expect(result.messages).toEqual([
                'priority-high: Plugin priority-high (priority 10) executed',
                'priority-medium: Plugin priority-medium (priority 50) executed',
                'priority-low: Plugin priority-low (priority 90) executed',
            ]);
        });

        it('should stop execution when a plugin returns continue: false', async () => {
            // Create plugins where one stops execution
            const plugin1Path = join(pluginsDir, 'first.js');
            const plugin2Path = join(pluginsDir, 'stopping.js');
            const plugin3Path = join(pluginsDir, 'last.js');

            const createExecutionPlugin = (name: string, shouldStop: boolean) => `
                export default class ${name}Plugin {
                    constructor() {
                        this.name = '${name}';
                        this.version = '1.0.0';
                        this.hooks = {
                            beforeToolCall: this.beforeToolCall.bind(this),
                        };
                    }

                    async initialize(context, config) {}
                    async cleanup() {}

                    async beforeToolCall(context) {
                        return {
                            continue: ${!shouldStop},
                            message: 'Plugin ${name} executed'
                        };
                    }
                }
            `;

            await writeFile(plugin1Path, createExecutionPlugin('first', false));
            await writeFile(plugin2Path, createExecutionPlugin('stopping', true));
            await writeFile(plugin3Path, createExecutionPlugin('last', false));

            const configs = [
                {
                    name: 'first',
                    path: './plugins/first.js',
                    enabled: true,
                    priority: 10,
                },
                {
                    name: 'stopping',
                    path: './plugins/stopping.js',
                    enabled: true,
                    priority: 20,
                },
                {
                    name: 'last',
                    path: './plugins/last.js',
                    enabled: true,
                    priority: 30,
                },
            ];

            await pluginManager.loadPlugins(configs);
            await pluginManager.initializePlugins();

            // Execute hook and verify execution stopped
            const sessionId = 'test-session';
            const context = {
                toolName: 'test-tool',
                args: {},
                sessionId,
                sessionEventBus: mockSessionEventBus,
                ...mockContext,
            } as any;

            const result = await pluginManager.executeHook(
                'beforeToolCall',
                sessionId,
                mockSessionEventBus,
                context
            );

            expect(result.success).toBe(true);
            // Only first two plugins should have executed
            expect(result.messages).toEqual([
                'first: Plugin first executed',
                'stopping: Plugin stopping executed',
            ]);
            // Last plugin should not have executed
            expect(result.messages).not.toContain('last: Plugin last executed');
        });
    });

    describe('Error handling in plugin execution', () => {
        it('should handle plugin errors gracefully', async () => {
            // Create plugin that throws an error
            const errorPluginContent = `
                export default class ErrorPlugin {
                    constructor() {
                        this.name = 'error-plugin';
                        this.version = '1.0.0';
                        this.hooks = {
                            beforeToolCall: this.beforeToolCall.bind(this),
                        };
                    }

                    async initialize(context, config) {}
                    async cleanup() {}

                    async beforeToolCall(context) {
                        throw new Error('Plugin execution failed');
                    }
                }
            `;

            const pluginPath = join(pluginsDir, 'error-plugin.js');
            await writeFile(pluginPath, errorPluginContent);

            const config = {
                name: 'error-plugin',
                path: './plugins/error-plugin.js',
                enabled: true,
            };

            await pluginManager.loadPlugin(config);
            await pluginManager.initializePlugins();

            // Execute hook and verify error handling
            const sessionId = 'test-session';
            const context = {
                toolName: 'test-tool',
                args: {},
                sessionId,
                sessionEventBus: mockSessionEventBus,
                ...mockContext,
            } as any;

            const result = await pluginManager.executeHook(
                'beforeToolCall',
                sessionId,
                mockSessionEventBus,
                context
            );

            expect(result.success).toBe(false);
            expect(result.error?.message).toBe('Plugin execution failed');
        });
    });
});
