'use client';

import React, { createContext, useContext, ReactNode, useEffect, useState, useCallback } from 'react';
import { useChat, Message } from './useChat';

interface ChatContextType {
  messages: Message[];
  sendMessage: (content: string, imageData?: { base64: string; mimeType: string }) => void;
  status: 'connecting' | 'open' | 'closed';
  reset: () => void;
  currentSessionId: string;
  switchSession: (sessionId: string) => void;
  loadSessionHistory: (sessionId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  // Determine WebSocket URL; replace localhost for network access
  let wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
  if (typeof window !== 'undefined') {
    try {
      const urlObj = new URL(wsUrl);
      if (urlObj.hostname === 'localhost') {
        urlObj.hostname = window.location.hostname;
        wsUrl = urlObj.toString();
      }
    } catch (e) {
      console.warn('Invalid WS URL:', wsUrl);
    }
  }

  const [currentSessionId, setCurrentSessionId] = useState<string>('default');
  const { messages, sendMessage: originalSendMessage, status, reset: originalReset, setMessages } = useChat(wsUrl);

  // Enhanced sendMessage with session support
  const sendMessage = useCallback((content: string, imageData?: { base64: string; mimeType: string }) => {
    originalSendMessage(content, imageData, currentSessionId);
  }, [originalSendMessage, currentSessionId]);

  // Enhanced reset with session support
  const reset = useCallback(() => {
    originalReset(currentSessionId);
  }, [originalReset, currentSessionId]);

  // Load session history when switching sessions
  const loadSessionHistory = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/history`);
      if (!response.ok) {
        if (response.status === 404) {
          // Session doesn't exist, create it
          const createResponse = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });
          if (!createResponse.ok) {
            throw new Error('Failed to create session');
          }
          // New session has no history
          setMessages([]);
          return;
        }
        throw new Error('Failed to load session history');
      }
      
      const data = await response.json();
      const history = data.history || [];
      
      // Convert API history to UI messages
      const uiMessages: Message[] = history.map((msg: any, index: number) => ({
        id: `session-${sessionId}-${index}`,
        role: msg.role,
        content: msg.content,
        createdAt: Date.now() - (history.length - index) * 1000, // Approximate timestamps
        sessionId: sessionId,
        ...(msg.role === 'tool' && {
          toolName: msg.toolName,
          toolArgs: msg.toolArgs,
          toolResult: msg.toolResult,
        }),
      }));
      
      setMessages(uiMessages);
    } catch (error) {
      console.error('Error loading session history:', error);
      // On error, just clear messages and continue
      setMessages([]);
    }
  }, [setMessages]);

  // Switch to a different session
  const switchSession = useCallback(async (sessionId: string) => {
    if (sessionId === currentSessionId) return;
    
    setCurrentSessionId(sessionId);
    await loadSessionHistory(sessionId);
  }, [currentSessionId, loadSessionHistory]);

  // Load default session history on mount
  useEffect(() => {
    loadSessionHistory('default');
  }, [loadSessionHistory]);

  // Listen for config-related WebSocket events via DOM events
  useEffect(() => {
    const handleConfigChange = (event: any) => {
      console.log('Config changed:', event.detail);
      // Here you could trigger UI updates, but for now just log
    };

    const handleServersChange = (event: any) => {
      console.log('Servers changed:', event.detail);
      // Here you could trigger UI updates, but for now just log
    };

    const handleSessionReset = (event: any) => {
      const { sessionId } = event.detail || {};
      if (sessionId === currentSessionId) {
        setMessages([]);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('saiki:configChanged', handleConfigChange);
      window.addEventListener('saiki:serversChanged', handleServersChange);
      window.addEventListener('saiki:conversationReset', handleSessionReset);
      
      return () => {
        window.removeEventListener('saiki:configChanged', handleConfigChange);
        window.removeEventListener('saiki:serversChanged', handleServersChange);
        window.removeEventListener('saiki:conversationReset', handleSessionReset);
      };
    }
  }, [currentSessionId, setMessages]);

  return (
    <ChatContext.Provider value={{ 
      messages, 
      sendMessage, 
      status, 
      reset,
      currentSessionId,
      switchSession,
      loadSessionHistory
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextType {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
} 