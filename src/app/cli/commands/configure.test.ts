import { describe, test, expect } from 'vitest';
import {
    MCP_SERVER_REGISTRY,
    getMcpServersByCategory,
    getMcpServerCategories,
} from '../../../core/config/mcp-registry.js';

describe('Configure Command Core Functionality', () => {
    describe('MCP Server Registry', () => {
        test('should have valid registry entries', () => {
            // Check that registry is not empty
            expect(Object.keys(MCP_SERVER_REGISTRY).length).toBeGreaterThan(0);

            // Check each entry has required fields
            for (const [key, entry] of Object.entries(MCP_SERVER_REGISTRY)) {
                expect(entry.id).toBe(key);
                expect(entry.name).toBeDefined();
                expect(entry.description).toBeDefined();
                expect(entry.category).toBeDefined();
                expect(entry.config).toBeDefined();
                expect(entry.config.type).toMatch(/^(stdio|sse|http)$/);

                if (entry.config.type === 'stdio') {
                    expect(entry.config.command).toBeDefined();
                }
                if (entry.config.type === 'http') {
                    expect(entry.config.url).toBeDefined();
                }
            }
        });

        test('should categorize servers correctly', () => {
            const categories = getMcpServerCategories();

            // Should have multiple categories
            expect(categories.length).toBeGreaterThan(0);

            // Each category should have servers
            for (const categoryName of categories) {
                const servers = getMcpServersByCategory(categoryName);
                expect(Array.isArray(servers)).toBe(true);
                expect(servers.length).toBeGreaterThan(0);

                // Each server in category should have that category
                for (const server of servers) {
                    expect(server.category).toBe(categoryName);
                }
            }
        });

        test('should have essential MCP servers', () => {
            // Check for key servers that should be in the registry
            const essentialServers = ['filesystem', 'puppeteer', 'github', 'sqlite'];

            for (const serverId of essentialServers) {
                const server = MCP_SERVER_REGISTRY[serverId];
                expect(server).toBeDefined();
                expect(server?.name).toBeDefined();
            }
        });

        test('should have correct server categories', () => {
            const categories = getMcpServerCategories();
            const expectedCategories = ['Development', 'Web', 'Database', 'Productivity'];

            for (const category of expectedCategories) {
                expect(categories).toContain(category);
                const categoryServers = getMcpServersByCategory(category);
                expect(Array.isArray(categoryServers)).toBe(true);
                expect(categoryServers.length).toBeGreaterThan(0);
            }
        });

        test('should have valid server configurations', () => {
            // Test a few specific servers for correct structure
            const filesystem = MCP_SERVER_REGISTRY.filesystem;
            expect(filesystem).toBeDefined();
            expect(filesystem?.config.type).toBe('stdio');
            if (filesystem?.config.type === 'stdio') {
                expect(filesystem.config.command).toBe('npx');
                expect(Array.isArray(filesystem.config.args)).toBe(true);
            }

            const puppeteer = MCP_SERVER_REGISTRY.puppeteer;
            expect(puppeteer).toBeDefined();
            expect(puppeteer?.config.type).toBe('stdio');
            expect(puppeteer?.category).toBe('Web');

            const github = MCP_SERVER_REGISTRY.github;
            expect(github).toBeDefined();
            expect(github?.config.type).toBe('stdio');
            expect(github?.category).toBe('Development');
        });
    });
});
