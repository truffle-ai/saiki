import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function setupExampleTool(server: McpServer) {
  // Example simple calculation tool
  server.tool(
    'calculate',
    {
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.number(),
      b: z.number()
    },
    async ({ operation, a, b }) => {
      let result: number;
      
      switch (operation) {
        case 'add':
          result = a + b;
          break;
        case 'subtract':
          result = a - b;
          break;
        case 'multiply':
          result = a * b;
          break;
        case 'divide':
          if (b === 0) {
            throw new Error('Division by zero');
          }
          result = a / b;
          break;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Result of ${operation}(${a}, ${b}) = ${result}`
          }
        ]
      };
    }
  );
}