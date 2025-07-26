import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CustomToolProvider } from './custom-tool-provider.js';
import { ToolRegistry } from './tool-registry.js';
import { ToolExecutor } from './tool-executor.js';
import { ToolDiscovery } from './tool-discovery.js';
import { NoOpConfirmationProvider } from '../client/tool-confirmation/noop-confirmation-provider.js';
import type { Tool, ToolExecutionContext, ToolSet } from './types.js';

// Mock the service classes
vi.mock('./tool-registry.js');
vi.mock('./tool-executor.js');
vi.mock('./tool-discovery.js');

describe('CustomToolProvider', () => {
    let customToolProvider: CustomToolProvider;
    let mockRegistry: any;
    let mockExecutor: any;
    let mockDiscovery: any;
    let confirmationProvider: NoOpConfirmationProvider;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        confirmationProvider = new NoOpConfirmationProvider();

        // Create mock registry
        mockRegistry = {
            getToolIds: vi.fn().mockReturnValue(['tool1', 'tool2']),
            clear: vi.fn(),
        };

        // Create mock executor
        mockExecutor = {
            hasTool: vi.fn(),
            executeTool: vi.fn(),
            getAllTools: vi.fn().mockReturnValue({}),
            getToolNames: vi.fn().mockReturnValue(['tool1', 'tool2']),
            getToolsByCategory: vi.fn().mockReturnValue({}),
            getToolsByTags: vi.fn().mockReturnValue({}),
            getStats: vi.fn().mockReturnValue({
                totalTools: 2,
                categories: { test: 1 },
                tags: { example: 1 },
            }),
        };

        // Create mock discovery
        mockDiscovery = {
            loadRegisteredTools: vi.fn().mockResolvedValue(undefined),
            discoverTools: vi.fn().mockResolvedValue({
                tools: [],
                errors: [],
                warnings: [],
            }),
            validateToolsDirectory: vi.fn().mockResolvedValue({
                validFiles: [],
                invalidFiles: [],
            }),
        };

        // Mock the constructors
        (ToolRegistry as any).mockImplementation(() => mockRegistry);
        (ToolExecutor as any).mockImplementation(() => mockExecutor);
        (ToolDiscovery as any).mockImplementation(() => mockDiscovery);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with default configuration', () => {
            customToolProvider = new CustomToolProvider();

            expect(ToolRegistry).toHaveBeenCalled();
            expect(ToolExecutor).toHaveBeenCalledWith(
                mockRegistry,
                expect.objectContaining({
                    toolsDirectory: './tools',
                    autoDiscover: true,
                    toolConfigs: {},
                    globalSettings: {
                        requiresConfirmation: false,
                        timeout: 30000,
                        enableCaching: false,
                    },
                }),
                undefined
            );
            expect(ToolDiscovery).toHaveBeenCalledWith(mockRegistry);
        });

        it('should initialize with custom configuration', () => {
            const customConfig = {
                toolsDirectory: './custom-tools',
                autoDiscover: false,
                toolConfigs: { tool1: { timeout: 5000 } },
                globalSettings: {
                    requiresConfirmation: true,
                    timeout: 60000,
                    enableCaching: true,
                },
            };

            customToolProvider = new CustomToolProvider(customConfig, confirmationProvider);

            expect(ToolExecutor).toHaveBeenCalledWith(
                mockRegistry,
                customConfig,
                confirmationProvider
            );
        });

        it('should handle partial configuration', () => {
            const partialConfig = {
                toolsDirectory: './partial-tools',
                // Missing other fields
            };

            customToolProvider = new CustomToolProvider(partialConfig as any);

            expect(ToolExecutor).toHaveBeenCalledWith(
                mockRegistry,
                expect.objectContaining({
                    toolsDirectory: './partial-tools',
                    autoDiscover: true, // Should use default
                    toolConfigs: {}, // Should use default
                    globalSettings: expect.any(Object), // Should use default
                }),
                undefined
            );
        });
    });

    describe('Provider Initialization', () => {
        beforeEach(() => {
            customToolProvider = new CustomToolProvider();
        });

        it('should initialize successfully with auto-discovery enabled', async () => {
            await customToolProvider.initialize();

            expect(mockDiscovery.loadRegisteredTools).toHaveBeenCalled();
            expect(mockDiscovery.discoverTools).toHaveBeenCalledWith('./tools');
        });

        it('should initialize without auto-discovery when disabled', async () => {
            const config = {
                toolsDirectory: './tools',
                autoDiscover: false,
                toolConfigs: {},
                globalSettings: {
                    requiresConfirmation: false,
                    timeout: 30000,
                    enableCaching: false,
                },
            };

            customToolProvider = new CustomToolProvider(config);
            await customToolProvider.initialize();

            expect(mockDiscovery.loadRegisteredTools).toHaveBeenCalled();
            expect(mockDiscovery.discoverTools).not.toHaveBeenCalled();
        });

        it('should handle initialization errors', async () => {
            mockDiscovery.loadRegisteredTools.mockRejectedValue(new Error('Discovery failed'));

            await expect(customToolProvider.initialize()).rejects.toThrow('Discovery failed');
        });

        it('should log initialization progress', async () => {
            const logSpy = vi.spyOn(console, 'log').mockImplementation();

            await customToolProvider.initialize();

            expect(mockRegistry.getToolIds).toHaveBeenCalled();
            logSpy.mockRestore();
        });
    });

    describe('Tool Discovery', () => {
        beforeEach(() => {
            customToolProvider = new CustomToolProvider();
        });

        it('should delegate tool discovery to ToolDiscovery service', async () => {
            const mockResult = {
                tools: [{ id: 'discovered_tool' } as Tool],
                errors: [],
                warnings: [],
            };
            mockDiscovery.discoverTools.mockResolvedValue(mockResult);

            const result = await customToolProvider.discoverTools('./test-tools');

            expect(mockDiscovery.discoverTools).toHaveBeenCalledWith('./test-tools');
            expect(result).toBe(mockResult);
        });

        it('should validate tools directory', async () => {
            const mockValidation = {
                validFiles: ['tool1.js', 'tool2.ts'],
                invalidFiles: [{ filePath: 'bad.js', error: 'Invalid syntax' }],
            };
            mockDiscovery.validateToolsDirectory.mockResolvedValue(mockValidation);

            const result = await customToolProvider.validateToolsDirectory('./validate-tools');

            expect(mockDiscovery.validateToolsDirectory).toHaveBeenCalledWith('./validate-tools');
            expect(result).toBe(mockValidation);
        });
    });

    describe('Tool Execution', () => {
        beforeEach(() => {
            customToolProvider = new CustomToolProvider();
        });

        it('should check tool existence', () => {
            mockExecutor.hasTool.mockReturnValue(true);

            const result = customToolProvider.hasTool('test_tool');

            expect(mockExecutor.hasTool).toHaveBeenCalledWith('test_tool');
            expect(result).toBe(true);
        });

        it('should execute tools with arguments', async () => {
            const mockResult = { success: true, data: 'result' };
            mockExecutor.executeTool.mockResolvedValue(mockResult);

            const args = { param1: 'value1' };
            const context: ToolExecutionContext = { sessionId: 'session123' };

            const result = await customToolProvider.executeTool('test_tool', args, context);

            expect(mockExecutor.executeTool).toHaveBeenCalledWith('test_tool', args, context);
            expect(result).toBe(mockResult);
        });

        it('should execute tools without context', async () => {
            const mockResult = { success: true, data: 'result' };
            mockExecutor.executeTool.mockResolvedValue(mockResult);

            const result = await customToolProvider.executeTool('test_tool', {});

            expect(mockExecutor.executeTool).toHaveBeenCalledWith('test_tool', {}, undefined);
            expect(result).toBe(mockResult);
        });
    });

    describe('Tool Retrieval', () => {
        beforeEach(() => {
            customToolProvider = new CustomToolProvider();
        });

        it('should get all tools', () => {
            const mockTools: ToolSet = {
                tool1: { description: 'Tool 1' },
                tool2: { description: 'Tool 2' },
            };
            mockExecutor.getAllTools.mockReturnValue(mockTools);

            const result = customToolProvider.getAllTools();

            expect(mockExecutor.getAllTools).toHaveBeenCalled();
            expect(result).toBe(mockTools);
        });

        it('should get tool names', () => {
            const mockNames = ['tool1', 'tool2', 'tool3'];
            mockExecutor.getToolNames.mockReturnValue(mockNames);

            const result = customToolProvider.getToolNames();

            expect(mockExecutor.getToolNames).toHaveBeenCalled();
            expect(result).toBe(mockNames);
        });

        it('should get tools by category', () => {
            const mockTools: ToolSet = {
                category_tool: { description: 'Tool in category' },
            };
            mockExecutor.getToolsByCategory.mockReturnValue(mockTools);

            const result = customToolProvider.getToolsByCategory('test_category');

            expect(mockExecutor.getToolsByCategory).toHaveBeenCalledWith('test_category');
            expect(result).toBe(mockTools);
        });

        it('should get tools by tags', () => {
            const mockTools: ToolSet = {
                tagged_tool: { description: 'Tool with tags' },
            };
            mockExecutor.getToolsByTags.mockReturnValue(mockTools);

            const tags = ['tag1', 'tag2'];
            const result = customToolProvider.getToolsByTags(tags);

            expect(mockExecutor.getToolsByTags).toHaveBeenCalledWith(tags);
            expect(result).toBe(mockTools);
        });
    });

    describe('Statistics and Management', () => {
        beforeEach(() => {
            customToolProvider = new CustomToolProvider();
        });

        it('should get execution statistics', () => {
            const mockStats = {
                totalTools: 5,
                categories: { utility: 3, test: 2 },
                tags: { example: 2, demo: 3 },
            };
            mockExecutor.getStats.mockReturnValue(mockStats);

            const result = customToolProvider.getStats();

            expect(mockExecutor.getStats).toHaveBeenCalled();
            expect(result).toBe(mockStats);
        });

        it('should clear all tools', () => {
            customToolProvider.clear();

            expect(mockRegistry.clear).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            customToolProvider = new CustomToolProvider();
        });

        it('should handle executor errors during tool execution', async () => {
            const error = new Error('Execution failed');
            mockExecutor.executeTool.mockRejectedValue(error);

            await expect(customToolProvider.executeTool('failing_tool', {})).rejects.toThrow(
                'Execution failed'
            );
        });

        it('should handle discovery errors during tool discovery', async () => {
            const error = new Error('Discovery failed');
            mockDiscovery.discoverTools.mockRejectedValue(error);

            await expect(customToolProvider.discoverTools('./bad-tools')).rejects.toThrow(
                'Discovery failed'
            );
        });

        it('should handle validation errors during directory validation', async () => {
            const error = new Error('Validation failed');
            mockDiscovery.validateToolsDirectory.mockRejectedValue(error);

            await expect(
                customToolProvider.validateToolsDirectory('./bad-directory')
            ).rejects.toThrow('Validation failed');
        });
    });

    describe('Service Delegation', () => {
        beforeEach(() => {
            customToolProvider = new CustomToolProvider();
        });

        it('should properly delegate to ToolRegistry', () => {
            customToolProvider.clear();
            expect(mockRegistry.clear).toHaveBeenCalled();
        });

        it('should properly delegate to ToolExecutor for all tool operations', () => {
            customToolProvider.hasTool('test');
            customToolProvider.getAllTools();
            customToolProvider.getToolNames();
            customToolProvider.getToolsByCategory('cat');
            customToolProvider.getToolsByTags(['tag']);
            customToolProvider.getStats();

            expect(mockExecutor.hasTool).toHaveBeenCalledWith('test');
            expect(mockExecutor.getAllTools).toHaveBeenCalled();
            expect(mockExecutor.getToolNames).toHaveBeenCalled();
            expect(mockExecutor.getToolsByCategory).toHaveBeenCalledWith('cat');
            expect(mockExecutor.getToolsByTags).toHaveBeenCalledWith(['tag']);
            expect(mockExecutor.getStats).toHaveBeenCalled();
        });

        it('should properly delegate to ToolDiscovery for discovery operations', async () => {
            await customToolProvider.discoverTools('./tools');
            await customToolProvider.validateToolsDirectory('./validate');

            expect(mockDiscovery.discoverTools).toHaveBeenCalledWith('./tools');
            expect(mockDiscovery.validateToolsDirectory).toHaveBeenCalledWith('./validate');
        });
    });
});
