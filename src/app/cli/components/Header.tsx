import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  connectionStatus: 'connecting' | 'connected' | 'error';
  toolCount: number;
  agentName: string;
}

export function Header({ connectionStatus, toolCount, agentName }: HeaderProps) {
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'green';
      case 'connecting': return 'yellow';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return '●';
      case 'connecting': return '○';
      case 'error': return '✗';
      default: return '?';
    }
  };

  const getStatusMessage = () => {
    switch (connectionStatus) {
      case 'connected': return `Connected • ${toolCount} tools loaded`;
      case 'connecting': return 'Connecting...';
      case 'error': return 'Connection failed';
      default: return 'Unknown status';
    }
  };

  return (
    <Box 
      borderStyle="single" 
      borderColor="blue"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box>
        <Text bold color="blue">🤖 {agentName}</Text>
        <Text dimColor> • AI-powered CLI</Text>
      </Box>
      
      <Box alignItems="center">
        <Text color={getStatusColor()}>
          {getStatusText()}
        </Text>
        <Text dimColor> {getStatusMessage()}</Text>
      </Box>
    </Box>
  );
} 