'use client';

import React, { createContext, useContext, ReactNode, useEffect, useState, useCallback } from 'react';
import { useChat, Message } from './useChat';

interface ChatContextType {
  messages: Message[];
  sendMessage: (content: string, imageData?: { base64: string; mimeType: string }) => void;
  status: 'connecting' | 'open' | 'closed';
  reset: () => void;
  currentSessionId: string | null;
  switchSession: (sessionId: string) => void;
  loadSessionHistory: (sessionId: string) => Promise<void>;
  isWelcomeState: boolean;
  returnToWelcome: () => void;
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

  // Start with no session - pure welcome state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isWelcomeState, setIsWelcomeState] = useState(true);
  const { messages, sendMessage: originalSendMessage, status, reset: originalReset, setMessages } = useChat(wsUrl);

  // Auto-create session on first message with random UUID
  const createAutoSession = useCallback(async (): Promise<string> => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Let server generate random UUID
      });
      
      if (!response.ok) {
        throw new Error('Failed to create session');
      }
      
      const data = await response.json();
      return data.session.id;
    } catch (error) {
      console.error('Error creating auto session:', error);
      // Fallback to a simple timestamp-based session ID
      return `chat-${Date.now()}`;
    }
  }, []);

  // Enhanced sendMessage with auto-session creation
  const sendMessage = useCallback(async (content: string, imageData?: { base64: string; mimeType: string }) => {
    let sessionId = currentSessionId;
    
    // Auto-create session on first message
    if (!sessionId && isWelcomeState) {
      sessionId = await createAutoSession();
      
      // Load the new session as the current working session
      try {
        await fetch(`/api/sessions/${sessionId}/load`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Error loading auto-created session:', error);
      }
      
      setCurrentSessionId(sessionId);
      setIsWelcomeState(false);
    }
    
    if (sessionId) {
      originalSendMessage(content, imageData, sessionId);
    } else {
      console.error('No session available for sending message');
    }
  }, [originalSendMessage, currentSessionId, isWelcomeState, createAutoSession]);

  // Enhanced reset with session support
  const reset = useCallback(() => {
    if (currentSessionId) {
      originalReset(currentSessionId);
    }
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

  // Switch to a different session and load it on the backend
  const switchSession = useCallback(async (sessionId: string) => {
    if (sessionId === currentSessionId) return;
    
    try {
      // Load the session as the current working session on the backend
      const loadResponse = await fetch(`/api/sessions/${sessionId}/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!loadResponse.ok) {
        throw new Error('Failed to load session on backend');
      }
      
      setCurrentSessionId(sessionId);
      setIsWelcomeState(false); // No longer in welcome state
      await loadSessionHistory(sessionId);
    } catch (error) {
      console.error('Error switching session:', error);
      throw error; // Re-throw so UI can handle the error
    }
  }, [currentSessionId, loadSessionHistory]);

  // Return to welcome state (no active session)
  const returnToWelcome = useCallback(() => {
    setCurrentSessionId(null);
    setIsWelcomeState(true);
    setMessages([]);
    
    // Reset the backend to no default session
    fetch('/api/sessions/null/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(error => {
      console.warn('Error resetting backend session:', error);
    });
  }, [setMessages]);

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
      loadSessionHistory,
      isWelcomeState,
      returnToWelcome
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