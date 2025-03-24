import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function setupWeatherTool(server: McpServer) {
  // Simple mock weather service tool
  server.tool(
    'get_weather',
    {
      location: z.string().describe('City name or coordinates'),
      units: z.enum(['metric', 'imperial']).default('metric').describe('Temperature units')
    },
    async ({ location, units }) => {
      // In a real implementation, you would call a weather API here
      // This is a mock implementation for demonstration purposes
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
}