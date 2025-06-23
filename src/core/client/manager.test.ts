import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPManager } from './manager.js';
import type { ServerConfigs } from '../config/schemas.js';

// Mock the MCP client to avoid actual connections in tests
vi.mock('./mcp-client.js', () => ({
    MCPClient: vi.fn().mockImplementation(() => ({
        connect: vi.fn(),
        disconnect: vi.fn().mockResolvedValue(undefined),
        isConnected: vi.fn().mockReturnValue(true),
        getTools: vi.fn().mockResolvedValue([]),
        listResources: vi.fn().mockResolvedValue([]),
        readResource: vi.fn(),
        callTool: vi.fn(),
        listPrompts: vi.fn().mockResolvedValue([]),
        getPrompt: vi.fn(),
        getConnectedClient: vi.fn(),
    })),
}));

describe('MCPManager Connection Mode Tests', () => {
    let manager: MCPManager;

    beforeEach(() => {
        manager = new MCPManager();
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await manager.disconnectAll();
    });

    describe('initializeFromConfig with connectionMode', () => {
        it('should handle mixed connection modes correctly', async () => {
            const serverConfigs: ServerConfigs = {
                strictServer: {
                    type: 'stdio',
                    command: 'node',
                    args: ['strict-server.js'],
                    connectionMode: 'strict',
                },
                lenientServer: {
                    type: 'stdio',
                    command: 'node',
                    args: ['lenient-server.js'],
                    connectionMode: 'lenient',
                },
                defaultServer: {
                    type: 'stdio',
                    command: 'node',
                    args: ['default-server.js'],
                    // connectionMode defaults to 'lenient'
                },
            };

            // Mock connect to succeed for strict and default, fail for lenient
            const mockConnect = vi
                .fn()
                .mockResolvedValueOnce(undefined) // strictServer succeeds
                .mockRejectedValueOnce(new Error('Connection failed')) // lenientServer fails
                .mockResolvedValueOnce(undefined); // defaultServer succeeds

            const { MCPClient } = await import('./mcp-client.js');
            vi.mocked(MCPClient).mockImplementation(
                () =>
                    ({
                        connect: mockConnect,
                        disconnect: vi.fn().mockResolvedValue(undefined),
                        isConnected: vi.fn().mockReturnValue(true),
                        getTools: vi.fn().mockResolvedValue([]),
                        listResources: vi.fn().mockResolvedValue([]),
                        readResource: vi.fn(),
                        callTool: vi.fn(),
                        listPrompts: vi.fn().mockResolvedValue([]),
                        getPrompt: vi.fn(),
                        getConnectedClient: vi.fn(),
                    }) as any
            );

            // Should not throw since lenient server can fail
            await expect(manager.initializeFromConfig(serverConfigs)).resolves.not.toThrow();

            // Should have attempted to connect to all servers
            expect(mockConnect).toHaveBeenCalledTimes(3);
        });

        it('should fail when strict server cannot connect', async () => {
            const serverConfigs: ServerConfigs = {
                strictServer: {
                    type: 'stdio',
                    command: 'node',
                    args: ['strict-server.js'],
                    connectionMode: 'strict',
                },
            };

            // Mock connect to fail
            const mockConnect = vi.fn().mockRejectedValueOnce(new Error('Connection failed'));

            const { MCPClient } = await import('./mcp-client.js');
            vi.mocked(MCPClient).mockImplementation(
                () =>
                    ({
                        connect: mockConnect,
                        disconnect: vi.fn().mockResolvedValue(undefined),
                        isConnected: vi.fn().mockReturnValue(false),
                        getTools: vi.fn().mockResolvedValue([]),
                        listResources: vi.fn().mockResolvedValue([]),
                        readResource: vi.fn(),
                        callTool: vi.fn(),
                        listPrompts: vi.fn().mockResolvedValue([]),
                        getPrompt: vi.fn(),
                        getConnectedClient: vi.fn(),
                    }) as any
            );

            // Should throw since strict server failed to connect
            await expect(manager.initializeFromConfig(serverConfigs)).rejects.toThrow(
                'Failed to connect to required strict servers'
            );
        });

        it('should succeed when lenient server cannot connect', async () => {
            const serverConfigs: ServerConfigs = {
                lenientServer: {
                    type: 'stdio',
                    command: 'node',
                    args: ['lenient-server.js'],
                    connectionMode: 'lenient',
                },
            };

            // Mock connect to fail
            const mockConnect = vi.fn().mockRejectedValueOnce(new Error('Connection failed'));

            const { MCPClient } = await import('./mcp-client.js');
            vi.mocked(MCPClient).mockImplementation(
                () =>
                    ({
                        connect: mockConnect,
                        disconnect: vi.fn().mockResolvedValue(undefined),
                        isConnected: vi.fn().mockReturnValue(false),
                        getTools: vi.fn().mockResolvedValue([]),
                        listResources: vi.fn().mockResolvedValue([]),
                        readResource: vi.fn(),
                        callTool: vi.fn(),
                        listPrompts: vi.fn().mockResolvedValue([]),
                        getPrompt: vi.fn(),
                        getConnectedClient: vi.fn(),
                    }) as any
            );

            // Should not throw since lenient server can fail
            await expect(manager.initializeFromConfig(serverConfigs)).resolves.not.toThrow();
        });

        it('should use default connectionMode when not specified', async () => {
            const serverConfigs: ServerConfigs = {
                defaultServer: {
                    type: 'stdio',
                    command: 'node',
                    args: ['default-server.js'],
                    // connectionMode not specified, should default to 'lenient'
                },
            };

            // Mock connect to fail
            const mockConnect = vi.fn().mockRejectedValueOnce(new Error('Connection failed'));

            const { MCPClient } = await import('./mcp-client.js');
            vi.mocked(MCPClient).mockImplementation(
                () =>
                    ({
                        connect: mockConnect,
                        disconnect: vi.fn().mockResolvedValue(undefined),
                        isConnected: vi.fn().mockReturnValue(false),
                        getTools: vi.fn().mockResolvedValue([]),
                        listResources: vi.fn().mockResolvedValue([]),
                        readResource: vi.fn(),
                        callTool: vi.fn(),
                        listPrompts: vi.fn().mockResolvedValue([]),
                        getPrompt: vi.fn(),
                        getConnectedClient: vi.fn(),
                    }) as any
            );

            // Should not throw since default mode is lenient
            await expect(manager.initializeFromConfig(serverConfigs)).resolves.not.toThrow();
        });

        it('should handle all server types with connectionMode', async () => {
            const serverConfigs: ServerConfigs = {
                stdioServer: {
                    type: 'stdio',
                    command: 'node',
                    args: ['stdio-server.js'],
                    connectionMode: 'strict',
                },
                sseServer: {
                    type: 'sse',
                    url: 'http://localhost:8080/events',
                    connectionMode: 'lenient',
                },
                httpServer: {
                    type: 'http',
                    url: 'http://localhost:9000/api',
                    connectionMode: 'strict',
                },
            };

            const mockConnect = vi
                .fn()
                .mockResolvedValueOnce(undefined) // stdioServer succeeds
                .mockRejectedValueOnce(new Error('SSE failed')) // sseServer fails (lenient)
                .mockResolvedValueOnce(undefined); // httpServer succeeds

            const { MCPClient } = await import('./mcp-client.js');
            vi.mocked(MCPClient).mockImplementation(
                () =>
                    ({
                        connect: mockConnect,
                        disconnect: vi.fn().mockResolvedValue(undefined),
                        isConnected: vi.fn().mockReturnValue(true),
                        getTools: vi.fn().mockResolvedValue([]),
                        listResources: vi.fn().mockResolvedValue([]),
                        readResource: vi.fn(),
                        callTool: vi.fn(),
                        listPrompts: vi.fn().mockResolvedValue([]),
                        getPrompt: vi.fn(),
                        getConnectedClient: vi.fn(),
                    }) as any
            );

            // Should not throw since only sseServer (lenient) failed
            await expect(manager.initializeFromConfig(serverConfigs)).resolves.not.toThrow();
            expect(mockConnect).toHaveBeenCalledTimes(3);
        });
    });
});
