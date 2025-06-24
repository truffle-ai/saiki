import React from 'react';
import { Box, Text, Newline } from 'ink';
import { Message } from '../hooks/useMessages.js';
import { ToolExecutionDetails } from '@core/client/tool-confirmation/types.js';

interface ChatAreaProps {
  messages: Message[];
  streamingText: string;
  isStreaming: boolean;
  isThinking: boolean;
  error: Error | null;
  pendingTool: ToolExecutionDetails | null;
}

export function ChatArea({ 
  messages, 
  streamingText, 
  isStreaming, 
  isThinking, 
  error,
  pendingTool 
}: ChatAreaProps) {
  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getMessageColor = (type: Message['type']) => {
    switch (type) {
      case 'user': return 'cyan';
      case 'assistant': return 'white';
      case 'system': return 'yellow';
      case 'tool': return 'magenta';
      default: return 'gray';
    }
  };

  const getMessagePrefix = (type: Message['type']) => {
    switch (type) {
      case 'user': return '> ';
      case 'assistant': return '🤖 ';
      case 'system': return '⚡ ';
      case 'tool': return '🔧 ';
      default: return '';
    }
  };

  return (
    <Box flexDirection="column" flexGrow={1} padding={1}>
      {/* Message history */}
      {messages.map((message, index) => (
        <Box key={message.id} flexDirection="column" marginBottom={1}>
          <Box>
            <Text dimColor>[{formatTimestamp(message.timestamp)}]</Text>
            <Text> </Text>
            <Text color={getMessageColor(message.type)}>
              {getMessagePrefix(message.type)}{message.content}
            </Text>
          </Box>
          
          {/* Add spacing between messages */}
          {index < messages.length - 1 && <Newline />}
        </Box>
      ))}

      {/* Thinking indicator */}
      {isThinking && (
        <Box marginTop={1}>
          <Text color="yellow">🤔 AI thinking...</Text>
        </Box>
      )}

      {/* Tool execution indicator */}
      {pendingTool && (
        <Box marginTop={1} flexDirection="column">
          <Text color="magenta">🔧 Calling tool: {pendingTool.toolName}</Text>
          {pendingTool.args && (
            <Text dimColor>   Args: {JSON.stringify(pendingTool.args, null, 2)}</Text>
          )}
        </Box>
      )}

      {/* Streaming response */}
      {isStreaming && streamingText && (
        <Box 
          marginTop={1}
          flexDirection="column"
          borderStyle="single" 
          borderColor="yellow" 
          padding={1}
        >
          <Text color="yellow" bold>🤖 AI Response (streaming...)</Text>
          <Newline />
          <Text wrap="wrap">{streamingText}</Text>
        </Box>
      )}

      {/* Error display */}
      {error && (
        <Box 
          marginTop={1}
          borderStyle="single" 
          borderColor="red" 
          padding={1}
        >
          <Text color="red" bold>❌ Error</Text>
          <Newline />
          <Text color="red">{error.message}</Text>
        </Box>
      )}

      {/* Empty state */}
      {messages.length === 0 && !isThinking && !isStreaming && !error && (
        <Box justifyContent="center" alignItems="center" flexGrow={1}>
          <Text dimColor>Welcome to Saiki! Type a message to get started.</Text>
        </Box>
      )}
    </Box>
  );
} 