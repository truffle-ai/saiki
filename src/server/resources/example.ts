import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

export function setupExampleResource(server: McpServer) {
  // Example dynamic resource
  server.resource(
    'greeting',
    new ResourceTemplate('greeting://{name}', { list: undefined }),
    async (uri, { name }) => ({
      contents: [{ uri: uri.href, text: `Hello, ${name}!` }]
    })
  );
}