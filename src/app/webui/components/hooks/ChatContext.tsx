'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useChat, Message } from './useChat';

interface ChatContextValue {
  messages: Message[];
  sendMessage: (content: string, imageData?: { base64: string; mimeType: string }) => void;
  reset: () => void;
  status: 'connecting' | 'open' | 'closed';
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

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

  return (
    <ChatContext.Provider value={{ messages, sendMessage, status, reset }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
} 