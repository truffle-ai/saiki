'use client';

import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useChat, Message } from './useChat';

interface ChatContextType {
  messages: Message[];
  sendMessage: (content: string, imageData?: { base64: string; mimeType: string }) => void;
  status: 'connecting' | 'open' | 'closed';
  reset: () => void;
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
  const { messages, sendMessage, status, reset } = useChat(wsUrl);

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

    if (typeof window !== 'undefined') {
      window.addEventListener('saiki:configChanged', handleConfigChange);
      window.addEventListener('saiki:serversChanged', handleServersChange);
      
      return () => {
        window.removeEventListener('saiki:configChanged', handleConfigChange);
        window.removeEventListener('saiki:serversChanged', handleServersChange);
      };
    }
  }, []);

  return (
    <ChatContext.Provider value={{ messages, sendMessage, status, reset }}>
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