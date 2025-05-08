import type { Express } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { ILLMService } from '../ai/llm/services/types.js';
import type { AgentCard } from '../config/types.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';
import express from 'express';

/**
 * Initializes and sets up the MCP server, its tools, resources, and HTTP endpoints.
 */
export async function initializeMcpServerEndpoints(
    app: Express,
    llmService: ILLMService,
    agentName: string,
    agentVersion: string,
    agentCardData: AgentCard, // Used for the MCP resource
    mcpTransport: StreamableHTTPServerTransport
): Promise<void> {
    const mcpServer = new McpServer(
        { name: agentName, version: agentVersion },
        {
            capabilities: {
                resources: {}, // Declare resource capability
            },
        }
    );

    // Register the primary 'chat' tool with fixed details
    const toolName = 'chat_with_agent'; // Simplified tool name
    const toolDescription = 'Allows you to chat with the Saiki agent. Send a message to interact.';

    mcpServer.tool(
        toolName,
        toolDescription,
        { message: z.string() }, // Input schema for the tool
        async ({ message }: { message: string }) => {
            const text = await llmService.completeTask(message);
            return { content: [{ type: 'text', text }] }; // Output structure
        }
    );
    logger.info(
        `Registered MCP tool: '${toolName}' with description: "${toolDescription.substring(0, 70)}..."`
    );

    // Register Agent Card data as an MCP Resource
    const agentCardResourceProgrammaticName = 'agentCard';
    const agentCardResourceUri = 'saiki://agent/card';
    try {
        // @ts-ignore
        if (typeof mcpServer.resource === 'function') {
            // @ts-ignore
            mcpServer.resource(
                agentCardResourceProgrammaticName,
                agentCardResourceUri,
                async (uri: URL) => {
                    logger.info(`MCP client requesting resource at ${uri.href}`);
                    return {
                        contents: [
                            {
                                uri: uri.href,
                                type: 'application/json',
                                text: JSON.stringify(agentCardData, null, 2),
                            },
                        ],
                    };
                }
            );
            logger.info(
                `Registered MCP Resource: '${agentCardResourceProgrammaticName}' at URI '${agentCardResourceUri}'`
            );
        } else {
            logger.warn(
                `mcpServer.resource method not found. MCP resource '${agentCardResourceProgrammaticName}' may not be available. Check SDK.`
            );
        }
    } catch (e: any) {
        logger.warn(
            `Error attempting to register MCP Resource '${agentCardResourceProgrammaticName}': ${e.message}. Check SDK.`
        );
    }

    // Connect server to transport AFTER all registrations
    logger.info(`Initializing MCP protocol server connection...`);
    await mcpServer.connect(mcpTransport);
    logger.info(`✅ MCP server protocol connected via transport.`);

    // Mount /mcp for JSON-RPC and SSE handling
    app.post('/mcp', express.json(), (req, res) => {
        mcpTransport
            .handleRequest(req, res, req.body)
            .catch((err) => logger.error(`MCP POST error: ${JSON.stringify(err, null, 2)}`));
    });
    app.get('/mcp', (req, res) => {
        mcpTransport
            .handleRequest(req, res)
            .catch((err) => logger.error(`MCP GET error: ${JSON.stringify(err, null, 2)}`));
    });
    logger.info('Mounted MCP routes (/mcp for POST and GET).');
}
