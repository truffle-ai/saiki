import type { Express } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReadResourceCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { AgentCard } from '../../core/index.js';
import { logger } from '../../core/index.js';
import { z } from 'zod';
import express from 'express';
import { SaikiAgent } from '../../core/ai/agent/SaikiAgent.js';

/**
 * Initializes and sets up the MCP server, its tools, resources, and HTTP endpoints.
 */
export async function initializeMcpServerEndpoints(
    app: Express,
    agent: SaikiAgent,
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
    const toolDescription = 'Allows you to chat with the an AI agent. Send a message to interact.';

    mcpServer.tool(
        toolName,
        toolDescription,
        { message: z.string() }, // Input schema for the tool
        async ({ message }: { message: string }) => {
            const text = await agent.run(message);
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
        const readCallback: ReadResourceCallback = async (uri, extra) => {
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
        };
        mcpServer.resource(agentCardResourceProgrammaticName, agentCardResourceUri, readCallback);
        logger.info(
            `Registered MCP Resource: '${agentCardResourceProgrammaticName}' at URI '${agentCardResourceUri}'`
        );
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
