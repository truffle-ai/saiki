/**
 * Test fixtures for storage system testing
 *
 * These represent real data structures that Saiki's storage system handles.
 */

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    sessionId: string;
}

export interface UserSettings {
    theme: 'light' | 'dark';
    language: string;
    autoSave: boolean;
}

export interface ToolPermission {
    toolName: string;
    allowed: boolean;
    timestamp: number;
}

// Sample chat messages for testing
export const sampleMessages: ChatMessage[] = [
    {
        id: 'msg1',
        role: 'user',
        content: 'Hello, how are you?',
        timestamp: 1640995200000,
        sessionId: 'session1',
    },
    {
        id: 'msg2',
        role: 'assistant',
        content: 'I am doing well, thank you for asking!',
        timestamp: 1640995201000,
        sessionId: 'session1',
    },
    {
        id: 'msg3',
        role: 'user',
        content: 'What can you help me with?',
        timestamp: 1640995202000,
        sessionId: 'session1',
    },
];

// Sample user settings
export const sampleUserSettings: UserSettings = {
    theme: 'dark',
    language: 'en',
    autoSave: true,
};

// Sample tool permissions
export const sampleToolPermissions: ToolPermission[] = [
    {
        toolName: 'file_read',
        allowed: true,
        timestamp: 1640995200000,
    },
    {
        toolName: 'web_search',
        allowed: false,
        timestamp: 1640995201000,
    },
];

// Test storage contexts
export const testContexts = {
    development: {
        isDevelopment: true,
        projectRoot: '/tmp/test-project',
        storageRoot: '/tmp/test-storage',
        forceGlobal: false,
    },
    production: {
        isDevelopment: false,
        projectRoot: '/tmp/test-project',
        storageRoot: '/tmp/test-global',
        forceGlobal: true,
    },
};
