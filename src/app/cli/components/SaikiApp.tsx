import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { SaikiAgent } from '@core/index.js';
import { Header } from './Header.js';
import { ChatArea } from './ChatArea.js';
import { InputArea } from './InputArea.js';
import { HelpModal } from './HelpModal.js';
import { useAgentEvents } from '../hooks/useAgentEvents.js';
import { useMessages } from '../hooks/useMessages.js';

interface SaikiAppProps {
  agent: SaikiAgent;
  headless?: boolean;
  prompt?: string;
}

type AppMode = 'chat' | 'help' | 'tool-confirmation';

export function SaikiApp({ agent, headless = false, prompt }: SaikiAppProps) {
  const { exit } = useApp();
  const [mode, setMode] = useState<AppMode>('chat');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [toolCount, setToolCount] = useState(0);
  
  const eventState = useAgentEvents(agent);
  const { messages, addMessage, clearMessages } = useMessages();

  // Initialize the CLI
  useEffect(() => {
    const initCli = async () => {
      try {
        // Check connection status
        const clients = agent.clientManager.getClients();
        const failedConnections = agent.clientManager.getFailedConnections();
        
        if (clients.size > 0) {
          setConnectionStatus('connected');
        } else if (Object.keys(failedConnections).length > 0) {
          setConnectionStatus('error');
        }

        // Load tools
        const tools = await agent.clientManager.getAllTools();
        setToolCount(Object.keys(tools).length);

        // If headless, run the prompt immediately
        if (headless && prompt) {
          await agent.run(prompt);
          exit();
        }
      } catch (error) {
        setConnectionStatus('error');
        addMessage({
          id: Date.now().toString(),
          type: 'system',
          content: `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date()
        });
      }
    };

    initCli();
  }, [agent, headless, prompt, exit, addMessage]);

  // Handle keyboard shortcuts
  useInput((input, key) => {
    if (key.ctrl) {
      switch (input) {
        case 'c':
          exit();
          break;
        case 'l':
          clearMessages();
          break;
        case 'h':
          setMode(mode === 'help' ? 'chat' : 'help');
          break;
      }
    }

    if (key.escape) {
      setMode('chat');
    }
  });

  const handleUserInput = useCallback(async (input: string) => {
    const trimmedInput = input.trim();
    
    if (!trimmedInput) return;

    // Add user message to history
    addMessage({
      id: Date.now().toString(),
      type: 'user',
      content: trimmedInput,
      timestamp: new Date()
    });

    // Handle special commands
    const lowerInput = trimmedInput.toLowerCase();
    
    if (lowerInput === 'exit' || lowerInput === 'quit') {
      exit();
      return;
    }

    if (lowerInput === 'clear') {
      await agent.resetConversation();
      clearMessages();
      addMessage({
        id: Date.now().toString(),
        type: 'system',
        content: 'Conversation history cleared.',
        timestamp: new Date()
      });
      return;
    }

    if (lowerInput === 'help') {
      setMode('help');
      return;
    }

    // Check for log level commands
    const validLogLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
    if (validLogLevels.includes(lowerInput)) {
      // @ts-ignore - logger.setLevel exists but isn't typed properly
      agent.logger?.setLevel?.(lowerInput);
      addMessage({
        id: Date.now().toString(),
        type: 'system',
        content: `Log level set to ${lowerInput}`,
        timestamp: new Date()
      });
      return;
    }

    // Send to agent
    try {
      await agent.run(trimmedInput);
    } catch (error) {
      addMessage({
        id: Date.now().toString(),
        type: 'system',
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      });
    }
  }, [agent, addMessage, clearMessages, exit]);

  // Add assistant messages when responses come in
  useEffect(() => {
    if (eventState.finalResponse) {
      addMessage({
        id: Date.now().toString(),
        type: 'assistant',
        content: eventState.finalResponse,
        timestamp: new Date()
      });
    }
  }, [eventState.finalResponse, addMessage]);

  // Handle conversation reset
  useEffect(() => {
    if (eventState.conversationReset) {
      clearMessages();
      addMessage({
        id: Date.now().toString(),
        type: 'system',
        content: 'Conversation history cleared.',
        timestamp: new Date()
      });
    }
  }, [eventState.conversationReset, clearMessages, addMessage]);

  if (headless) {
    // For headless mode, just show minimal output
    return (
      <Box flexDirection="column">
        {eventState.error && (
          <Text color="red">Error: {eventState.error.message}</Text>
        )}
        {eventState.isThinking && (
          <Text color="yellow">AI thinking...</Text>
        )}
        {eventState.streamingText && (
          <Text>{eventState.streamingText}</Text>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      <Header 
        connectionStatus={connectionStatus}
        toolCount={toolCount}
        agentName="Saiki"
      />
      
      <Box flexGrow={1}>
        {mode === 'chat' ? (
          <ChatArea 
            messages={messages}
            streamingText={eventState.streamingText}
            isStreaming={eventState.isStreaming}
            isThinking={eventState.isThinking}
            error={eventState.error}
            pendingTool={eventState.pendingTool}
          />
        ) : mode === 'help' ? (
          <HelpModal onClose={() => setMode('chat')} />
        ) : null}
      </Box>
      
      {mode === 'chat' && (
        <InputArea 
          onSubmit={handleUserInput}
          disabled={eventState.isStreaming}
          placeholder="What would you like to do? (type 'help' for commands)"
        />
      )}
    </Box>
  );
} 