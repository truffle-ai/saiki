import type { InternalMessage } from '../ai/llm/messages/types.js';

// Re-export the storage provider config from schemas for convenience
export type { StorageProviderConfig } from '../config/schemas.js';

// Data types for each storage area
export interface SessionData {
    id: string;
    createdAt: number;
    lastActivity: number;
    messageCount: number;
    metadata?: Record<string, any>;
}

export interface UserPreferences {
    theme?: string;
    language?: string;
    notifications?: {
        email: boolean;
        push: boolean;
    };
    [key: string]: any;
}

export interface ToolResult {
    result: any;
    timestamp: number;
    ttl?: number;
}

// Storage interfaces - each storage area defines what it needs
export interface HistoryStorage {
    addMessage(sessionId: string, message: InternalMessage): Promise<void>;
    getMessages(sessionId: string): Promise<InternalMessage[]>;
    clearSession(sessionId: string): Promise<void>;
    getSessions(): Promise<string[]>;

    // Optional TTL support for automatic cleanup
    cleanupExpiredSessions?(ttlMs: number): Promise<number>;

    close(): Promise<void>;
}

export interface SessionStorage {
    saveSession(session: SessionData): Promise<void>;
    getSession(sessionId: string): Promise<SessionData | undefined>;
    deleteSession(sessionId: string): Promise<void>;
    getAllSessions(): Promise<SessionData[]>;

    // TTL and session management methods
    setSessionWithTTL(sessionId: string, session: SessionData, ttlMs?: number): Promise<void>;
    getActiveSessions(): Promise<string[]>;
    cleanupExpiredSessions(): Promise<number>;

    close(): Promise<void>;
}

export interface UserInfoStorage {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
    has(key: string): Promise<boolean>;
    keys(): Promise<string[]>;
    clear(): Promise<void>;
    close(): Promise<void>;
}

export interface ToolCacheStorage {
    cacheResult(key: string, result: ToolResult, ttl?: number): Promise<void>;
    getCachedResult(key: string): Promise<ToolResult | undefined>;
    deleteCachedResult(key: string): Promise<void>;
    clearExpired(): Promise<void>;
    close(): Promise<void>;
}

export interface AllowedToolsStorage {
    setAllowedTools(userId: string, tools: string[]): Promise<void>;
    getAllowedTools(userId: string): Promise<string[]>;
    deleteAllowedTools(userId: string): Promise<void>;
    close(): Promise<void>;
}

// Storage configuration
export interface StorageContext {
    isDevelopment: boolean;
    projectRoot?: string;
    workingDirectory?: string;
    storageRoot?: string;
    forceGlobal?: boolean;
    customRoot?: string;
    connectionString?: string;
    connectionOptions?: Record<string, any>;
}

// Storage instances - what gets created by our factories
export interface StorageInstances {
    history: HistoryStorage;
    sessions: SessionStorage;
    userInfo: UserInfoStorage;
}

// Main storage interface (for future expansion)
export interface Storage {
    history: HistoryStorage;
    sessions: SessionStorage;
    userInfo: UserInfoStorage;
    toolCache: ToolCacheStorage;
    allowedTools: AllowedToolsStorage;
}
