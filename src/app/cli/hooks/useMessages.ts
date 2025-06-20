import { useState, useCallback } from 'react';

export interface Message {
    id: string;
    type: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: Date;
    metadata?: any;
}

interface UseMessagesReturn {
    messages: Message[];
    addMessage: (message: Message) => void;
    clearMessages: () => void;
    removeMessage: (id: string) => void;
    updateMessage: (id: string, updates: Partial<Message>) => void;
}

export function useMessages(): UseMessagesReturn {
    const [messages, setMessages] = useState<Message[]>([]);

    const addMessage = useCallback((message: Message) => {
        setMessages((prev) => [...prev, message]);
    }, []);

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    const removeMessage = useCallback((id: string) => {
        setMessages((prev) => prev.filter((msg) => msg.id !== id));
    }, []);

    const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
        setMessages((prev) => prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg)));
    }, []);

    return {
        messages,
        addMessage,
        clearMessages,
        removeMessage,
        updateMessage,
    };
}
