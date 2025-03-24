import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function setupTranslatorTool(server: McpServer) {
  // Simple mock translator tool
  server.tool(
    'translate',
    {
      text: z.string().describe('Text to translate'),
      sourceLanguage: z.string().default('auto').describe('Source language (or "auto" for auto-detection)'),
      targetLanguage: z.string().describe('Target language')
    },
    async ({ text, sourceLanguage, targetLanguage }) => {
      // In a real implementation, you would call a translation API here
      // This is a mock implementation for demonstration purposes
      
      // Simple mock function to generate a fake translation
      const mockTranslate = (text: string, target: string) => {
        if (target.toLowerCase() === 'spanish' || target.toLowerCase() === 'es') {
          // Just a simple mock - adding "o" or "a" to words
          return text.split(' ').map(word => word + (Math.random() > 0.5 ? 'o' : 'a')).join(' ');
        } else if (target.toLowerCase() === 'french' || target.toLowerCase() === 'fr') {
          // Just add "le" before every word
          return text.split(' ').map(word => 'le ' + word).join(' ');
        } else {
          // For any other language, just reverse the words
          return text.split(' ').reverse().join(' ');
        }
      };
      
      const translatedText = mockTranslate(text, targetLanguage);
      
      return {
        content: [
          {
            type: 'text',
            text: `Translated from ${sourceLanguage === 'auto' ? 'auto-detected language' : sourceLanguage} to ${targetLanguage}:\n${translatedText}`
          }
        ]
      };
    }
  );
}