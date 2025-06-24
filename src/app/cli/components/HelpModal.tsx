import React from 'react';
import { Box, Text, useInput } from 'ink';

interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: HelpModalProps) {
  // Handle escape key to close
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
    }
  });

  return (
    <Box 
      flexDirection="column" 
      borderStyle="double" 
      borderColor="cyan" 
      padding={2}
      margin={2}
    >
      <Text bold color="cyan">🚀 Saiki CLI Help</Text>
      <Text> </Text>
      
      <Text bold color="white">Commands:</Text>
      <Text>  help                 - Show this help screen</Text>
      <Text>  clear                - Clear conversation history</Text>
      <Text>  exit, quit           - Exit the application</Text>
      <Text>  error/warn/info/...  - Set logging level</Text>
      <Text> </Text>
      
      <Text bold color="white">Keyboard Shortcuts:</Text>
      <Text>  Ctrl+C               - Exit application</Text>
      <Text>  Ctrl+L               - Clear messages</Text>
      <Text>  Ctrl+H               - Toggle help screen</Text>
      <Text>  Escape               - Close help/modals</Text>
      <Text> </Text>
      
      <Text bold color="white">Features:</Text>
      <Text>  • Real-time AI responses with streaming</Text>
      <Text>  • Interactive tool confirmation</Text>
      <Text>  • Connection status monitoring</Text>
      <Text>  • Message history with timestamps</Text>
      <Text>  • Responsive terminal layout</Text>
      <Text> </Text>
      
      <Text bold color="white">Getting Started:</Text>
      <Text>  1. Type any message to chat with the AI</Text>
      <Text>  2. Use 'clear' to reset conversation</Text>
      <Text>  3. Press Ctrl+C or type 'exit' to quit</Text>
      <Text> </Text>
      
      <Box justifyContent="center">
        <Text dimColor>Press Escape or 'q' to close this help</Text>
      </Box>
    </Box>
  );
} 