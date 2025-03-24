import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock documents data
const documents: Record<string, { title: string; content: string }> = {
  '1': {
    title: 'Introduction to MCP',
    content: 'The Model Context Protocol (MCP) is an open protocol that enables seamless integration between LLM applications and external data sources and tools.'
  },
  '2': {
    title: 'MCP Architecture',
    content: 'MCP uses a client-server architecture with JSON-RPC 2.0 as its message format.'
  },
  '3': {
    title: 'Getting Started with MCP',
    content: 'To get started with MCP, you need to install the SDK and create a server that exposes tools or resources.'
  }
};

export function setupDocumentResource(server: McpServer) {
  // Create a document resource template with a document ID parameter
  try {
    server.resource(
      'document',
      new ResourceTemplate('document://{id}', { list: undefined }),
      async (uri, params) => {
        const id = params.id as string;
        
        // In a real implementation, you would fetch the document from a database or file system
        // This is a mock implementation for demonstration purposes
        if (id in documents) {
          const doc = documents[id];
          return {
            contents: [
              { 
                uri: uri.href, 
                text: `# ${doc.title}\n\n${doc.content}` 
              }
            ]
          };
        } else {
          throw new Error(`Document with ID ${id} not found`);
        }
      }
    );
  } catch (error) {
    console.error('Error setting up document resource:', error);
  }
}