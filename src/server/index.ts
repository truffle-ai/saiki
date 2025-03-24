import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import { z } from 'zod';

/**
 * Create and configure an MCP server
 */
export function createServer() {
  // Create a new MCP server
  const server = new McpServer({
    name: 'MCP-Example-Server',
    version: '1.0.0'
  });

  // Add a simple calculation tool
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
  
  // Add a simple weather tool (mock implementation)
  server.tool(
    'get_weather',
    {
      location: z.string().describe('City name or coordinates'),
      units: z.enum(['metric', 'imperial']).default('metric').describe('Temperature units')
    },
    async ({ location, units }) => {
      const mockWeatherData = {
        location,
        temperature: Math.floor(Math.random() * 30) + (units === 'imperial' ? 50 : 10),
        units: units === 'imperial' ? 'F' : 'C',
        conditions: ['Sunny', 'Cloudy', 'Rainy', 'Snowy'][Math.floor(Math.random() * 4)],
        humidity: Math.floor(Math.random() * 100),
        windSpeed: Math.floor(Math.random() * 30),
        timestamp: new Date().toISOString()
      };
      
      return {
        content: [
          {
            type: 'text',
            text: `Weather for ${mockWeatherData.location}: ${mockWeatherData.temperature}°${mockWeatherData.units}, ${mockWeatherData.conditions}, Humidity: ${mockWeatherData.humidity}%, Wind Speed: ${mockWeatherData.windSpeed} km/h`
          }
        ]
      };
    }
  );

  return server;
}

/**
 * Start an MCP server with stdio transport
 */
export async function startStdioHost() {
  // Log server start
  console.error(`\n==========================================`);
  console.error(`SERVER STARTING: MCP Host with stdio transport`);
  console.error(`PID: ${process.pid}`);
  console.error(`Time: ${new Date().toISOString()}`);
  console.error(`==========================================\n`);
  
  const server = createServer();

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  
  console.error('MCP server ready with stdio transport');
  await server.connect(transport);
}

/**
 * Start an MCP server with SSE transport
 */
export async function startSSEHost(port = 3001) {
  // Log server start
  console.error(`\n==========================================`);
  console.error(`SERVER STARTING: MCP Host with SSE transport`);
  console.error(`PID: ${process.pid}`);
  console.error(`Port: ${port}`);
  console.error(`Time: ${new Date().toISOString()}`);
  console.error(`==========================================\n`);
  
  const server = createServer();
  const app = express();

  // Use a Map to store connections
  const connections = new Map();

  app.get('/sse', async (req, res) => {
    const id = Date.now().toString();
    console.error(`New SSE connection: ${id}`);
    
    // Create a new transport for this connection
    const transport = new SSEServerTransport('/messages', res);
    connections.set(id, transport);
    
    // Handle connection close
    req.on('close', () => {
      console.error(`Connection closed: ${id}`);
      connections.delete(id);
    });
    
    // Connect the server to this transport
    await server.connect(transport);
  });

  app.post('/messages', express.json(), async (req, res) => {
    const connectionId = req.query.connectionId;
    
    if (typeof connectionId !== 'string' || !connections.has(connectionId)) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    const transport = connections.get(connectionId);
    await transport.handlePostMessage(req, res);
  });

  app.listen(port, () => {
    console.error(`MCP server with SSE transport listening on port ${port}`);
  });
}