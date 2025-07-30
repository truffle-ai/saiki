import { describe, it, expect, beforeEach } from 'vitest';
import { InternalToolsProvider, type InternalToolsConfig } from './internal-tools-provider.js';
import { NoOpConfirmationProvider } from '../client/tool-confirmation/noop-confirmation-provider.js';
import { SearchService } from '../ai/search/search-service.js';

/**
 * Tests for internal tools configuration functionality
 */
describe('InternalToolsProvider Configuration', () => {
    let confirmationProvider: NoOpConfirmationProvider;
    let mockSearchService: SearchService;

    beforeEach(() => {
        confirmationProvider = new NoOpConfirmationProvider();
        // Create a minimal mock SearchService for testing
        mockSearchService = {
            searchMessages: async () => ({ results: [], total: 0, hasMore: false }),
            searchSessions: async () => ({ sessions: [], total: 0 }),
        } as any; // Minimal mock for testing
    });

    describe('Configuration parsing and validation', () => {
        it('should use default configuration when none provided (disabled by default)', async () => {
            const provider = new InternalToolsProvider(
                { searchService: mockSearchService },
                confirmationProvider
            );

            await provider.initialize();

            // Should have no tools with default config (empty array)
            const tools = provider.getAllTools();
            expect(Object.keys(tools)).toHaveLength(0);
        });

        it('should disable all internal tools when config is empty array', async () => {
            const config: InternalToolsConfig = [];

            const provider = new InternalToolsProvider(
                { searchService: mockSearchService },
                confirmationProvider,
                config
            );

            await provider.initialize();

            const tools = provider.getAllTools();
            expect(Object.keys(tools)).toHaveLength(0);
        });

        it('should disable all tools when config is empty array', async () => {
            const config: InternalToolsConfig = [];

            const provider = new InternalToolsProvider(
                { searchService: mockSearchService },
                confirmationProvider,
                config
            );

            await provider.initialize();

            const tools = provider.getAllTools();
            expect(Object.keys(tools)).toHaveLength(0);
        });

        it('should enable specified tools when config contains them', async () => {
            const config: InternalToolsConfig = ['search_history'];

            const provider = new InternalToolsProvider(
                { searchService: mockSearchService },
                confirmationProvider,
                config
            );

            await provider.initialize();

            const tools = provider.getAllTools();
            expect(Object.keys(tools)).toContain('search_history');
        });

        it('should require explicit opt-in for internal tools', async () => {
            // Must specify tools explicitly in array
            const config: InternalToolsConfig = []; // No tools specified

            const provider = new InternalToolsProvider(
                { searchService: mockSearchService },
                confirmationProvider,
                config
            );

            await provider.initialize();

            const tools = provider.getAllTools();
            expect(Object.keys(tools)).toHaveLength(0); // No tools should be registered
        });

        it('should enable only specified tools when config contains them', async () => {
            const config: InternalToolsConfig = ['search_history'];

            const provider = new InternalToolsProvider(
                { searchService: mockSearchService },
                confirmationProvider,
                config
            );

            await provider.initialize();

            const tools = provider.getAllTools();
            expect(Object.keys(tools)).toContain('search_history');
            expect(Object.keys(tools)).toHaveLength(1);
        });

        it('should not register tools not in config array', async () => {
            const config: InternalToolsConfig = []; // search_history not included

            const provider = new InternalToolsProvider(
                { searchService: mockSearchService },
                confirmationProvider,
                config
            );

            await provider.initialize();

            const tools = provider.getAllTools();
            expect(Object.keys(tools)).not.toContain('search_history');
            expect(Object.keys(tools)).toHaveLength(0);
        });
    });

    describe('Service dependency handling with configuration', () => {
        it('should not register search_history when searchService is not available', async () => {
            const config: InternalToolsConfig = ['search_history'];

            const provider = new InternalToolsProvider(
                {}, // No services provided
                confirmationProvider,
                config
            );

            await provider.initialize();

            const tools = provider.getAllTools();
            expect(Object.keys(tools)).not.toContain('search_history');
            expect(Object.keys(tools)).toHaveLength(0);
        });

        it('should register search_history only when both service and config allow it', async () => {
            const config: InternalToolsConfig = ['search_history'];

            const provider = new InternalToolsProvider(
                { searchService: mockSearchService },
                confirmationProvider,
                config
            );

            await provider.initialize();

            const tools = provider.getAllTools();
            expect(Object.keys(tools)).toContain('search_history');
            expect(Object.keys(tools)).toHaveLength(1);
        });
    });

    describe('Tool execution with configuration', () => {
        it('should allow tool execution when tool is enabled', async () => {
            const config: InternalToolsConfig = ['search_history'];

            const provider = new InternalToolsProvider(
                { searchService: mockSearchService },
                confirmationProvider,
                config
            );

            await provider.initialize();

            // Should be able to execute the enabled tool with proper arguments
            const result = await provider.executeTool('search_history', {
                query: 'test',
                mode: 'messages',
                limit: 5,
            });
            expect(result).toBeDefined();
            expect(result.results).toBeDefined(); // Search results format
            expect(result.total).toBe(0); // Mock returns 0 results
        });

        it('should throw error when trying to execute disabled tool', async () => {
            const config: InternalToolsConfig = []; // search_history not enabled

            const provider = new InternalToolsProvider(
                { searchService: mockSearchService },
                confirmationProvider,
                config
            );

            await provider.initialize();

            // Should throw error for disabled tool
            await expect(provider.executeTool('search_history', { limit: 5 })).rejects.toThrow(
                'Internal tool not found: search_history'
            );
        });
    });
});
