# Saiki Storage System

The Saiki storage system provides a unified, flexible storage layer that abstracts different storage backends while offering three distinct storage patterns optimized for different use cases.

## Architecture Overview

### Core Design Principles

1. **Three Storage Patterns**: Different interfaces for different data access patterns
2. **Backend Abstraction**: Same API works with memory, file, SQLite, and future backends
3. **Smart Path Resolution**: Automatic `.saiki/` vs `~/.saiki/` selection based on context
4. **Type Safety**: Full TypeScript support with generics for compile-time validation
5. **Resource Management**: Centralized lifecycle management with proper cleanup
6. **Configuration-Driven**: Declarative configuration with sensible defaults
7. **Adapter Pattern**: Higher-level interfaces built on basic key-value storage

### Why Generic Types?

The storage system uses TypeScript generics (`<T>`) to provide **compile-time type safety** and **better developer experience**:

```typescript
// ✅ Type-safe: Knows you're storing UserSettings
const userStore = await storageManager.getProvider<UserSettings>('userInfo');
const settings = await userStore.get('theme'); // TypeScript knows this is UserSettings | undefined
await userStore.set('theme', { mode: 'dark' }); // TypeScript validates the object structure

// ✅ Type-safe: Knows you're storing Message objects in a collection  
const history = await storageManager.getCollectionProvider<Message>('history');
await history.add({ role: 'user', content: 'Hello' }); // TypeScript validates Message structure
const messages = await history.getAll(); // TypeScript knows this is Message[]

// ❌ Without generics, you'd lose type safety:
const anyStore = await storageManager.getProvider('userInfo'); // Returns any
const data = await anyStore.get('theme'); // No type checking, runtime errors possible
```

**Benefits of Generic Types:**
- **IntelliSense**: Auto-completion for your data structures
- **Compile-time validation**: Catch type errors before runtime
- **Refactoring safety**: TypeScript tracks type changes across codebase
- **Self-documenting**: Interface signatures show what data types are expected

### Why Adapters?

The adapter pattern allows us to **build complex storage interfaces on top of simple key-value storage**:

#### The Problem
All storage backends (memory, file, SQLite) only implement basic key-value operations:
```typescript
interface BasicStorage<T> {
    get(key: string): Promise<T | undefined>;
    set(key: string, value: T): Promise<void>;
    // ... other basic operations
}
```

#### The Solution: Adapters
We use adapters to **transform** basic key-value storage into specialized interfaces:

```typescript
// CollectionStorageAdapter wraps StorageProvider<T[]> 
// to provide array/list operations
class CollectionStorageAdapter<T> {
    constructor(private provider: StorageProvider<T[]>) {}
    
    async add(item: T): Promise<void> {
        const items = await this.provider.get('items') ?? [];
        items.push(item);
        await this.provider.set('items', items);
    }
    
    async getAll(): Promise<T[]> {
        return await this.provider.get('items') ?? [];
    }
}

// SessionStorageAdapter wraps StorageProvider<{data: T, expires?: number}>
// to provide TTL (time-to-live) functionality  
class SessionStorageAdapter<T> {
    constructor(private provider: StorageProvider<{data: T, expires?: number}>) {}
    
    async setSession(id: string, data: T, ttl?: number): Promise<void> {
        const expires = ttl ? Date.now() + ttl : undefined;
        await this.provider.set(id, { data, expires });
    }
    
    async getSession(id: string): Promise<T | undefined> {
        const stored = await this.provider.get(id);
        if (!stored) return undefined;
        
        // Check if expired
        if (stored.expires && Date.now() > stored.expires) {
            await this.provider.delete(id);
            return undefined;
        }
        
        return stored.data;
    }
}
```

**Benefits of Adapters:**
- **Code reuse**: One storage backend supports multiple interfaces
- **Separation of concerns**: Business logic (TTL, collections) separate from storage implementation
- **Consistency**: All backends provide the same high-level interfaces
- **Extensibility**: Easy to add new specialized interfaces (e.g., graph storage, queue storage)

### Storage Interfaces

#### 1. StorageProvider<T> - Key-Value Storage
```typescript
interface StorageProvider<T> {
    get(key: string): Promise<T | undefined>;
    set(key: string, value: T, ttl?: number): Promise<void>;
    has(key: string): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    keys(): Promise<string[]>;
    clear(): Promise<void>;
    close(): Promise<void>;
}
```

**Use Cases:**
- User preferences and settings
- API keys and configuration
- Simple caching
- Feature flags

**Example:**
```typescript
const settingsStore = await storageManager.getProvider<UserSettings>('user-settings');
await settingsStore.set('theme', { mode: 'dark', accent: 'blue' });
const theme = await settingsStore.get('theme');
```

#### 2. CollectionStorageProvider<T> - Collection/Array Storage
```typescript
interface CollectionStorageProvider<T> {
    add(item: T): Promise<void>;
    getAll(): Promise<T[]>;
    find(predicate: (item: T) => boolean): Promise<T[]>;
    remove(predicate: (item: T) => boolean): Promise<number>;
    count(): Promise<number>;
    clear(): Promise<void>;
    close(): Promise<void>;
}
```

**Use Cases:**
- Conversation history
- Audit logs
- Analytics events
- Lists of related items

**Example:**
```typescript
const chatHistory = await storageManager.getCollectionProvider<ChatMessage>('chat-history');
await chatHistory.add({ role: 'user', content: 'Hello', timestamp: Date.now() });
const userMessages = await chatHistory.find(msg => msg.role === 'user');
```

#### 3. SessionStorageProvider<T> - TTL-Aware Session Storage
```typescript
interface SessionStorageProvider<T> {
    setSession(sessionId: string, data: T, ttl?: number): Promise<void>;
    getSession(sessionId: string): Promise<T | undefined>;
    hasSession(sessionId: string): Promise<boolean>;
    deleteSession(sessionId: string): Promise<boolean>;
    getActiveSessions(): Promise<string[]>;
    cleanupExpired(): Promise<number>;
    clear(): Promise<void>;
    close(): Promise<void>;
}
```

**Use Cases:**
- User session data
- Temporary caches with expiration
- Rate limiting counters
- Time-sensitive data

**Example:**
```typescript
const sessions = await storageManager.getSessionProvider<SessionData>('user-sessions');
await sessions.setSession('user123', { preferences: {...} }, 3600000); // 1 hour TTL
const data = await sessions.getSession('user123');
await sessions.cleanupExpired(); // Remove expired sessions
```

## Backend Implementations

### Memory Provider
- **Performance**: Fastest access (in-memory Maps)
- **Persistence**: Data lost on restart
- **Use Cases**: Development, caching, temporary data
- **TTL Support**: Built-in with automatic cleanup

### File Provider
- **Performance**: Good for small datasets
- **Persistence**: Survives restarts
- **Formats**: JSON, JSONL, CSV
- **Features**: Backup files, compression, size limits
- **Use Cases**: Development, single-instance deployments

### SQLite Provider
- **Performance**: Excellent for complex queries
- **Persistence**: ACID transactions, robust
- **Features**: Tables, indexes, concurrent access
- **Use Cases**: Production single-instance, structured data

### Future Backends
The system is designed to support additional backends:
- **Redis**: Distributed caching, pub/sub
- **PostgreSQL/MySQL**: Full relational databases
- **S3**: Object storage for large datasets

## Smart Path Resolution & Backend Types

The storage system intelligently handles two different categories of storage backends:

### Local Storage Backends (Path-Based)
These backends store data locally and need file system paths:
- **Memory**: In-memory storage (no persistence)
- **File**: JSON/JSONL files in filesystem 
- **SQLite**: Local database files

For local backends, the `StoragePathResolver` automatically determines storage locations:

#### Development Mode (`isDevelopment: true`)
```
Project Root/
└── .saiki/
    ├── data/
    ├── sessions/
    └── logs/
```

- Each project gets isolated storage
- Good for development and testing
- Prevents data conflicts between projects

#### Production Mode (`isDevelopment: false`)
```
User Home/
└── .saiki/
    ├── data/
    ├── sessions/
    └── logs/
```

- Shared across all projects
- Persistent user data
- Centralized configuration

### Remote Storage Backends (Connection-Based)
These backends connect to external services and use connection strings:
- **Redis**: `redis://localhost:6379/0`
- **Database**: `postgres://user:pass@host:5432/database`
- **S3**: `s3://bucket-name/region` (future)

For remote backends, no path resolution is needed - they use connection strings instead.

### Automatic Detection

The storage system automatically detects which type of backend you're using:

```typescript
// Local storage - uses path resolution
const config = {
    default: { type: 'memory' },
    cache: { type: 'file' },
    data: { type: 'sqlite' }
};

// Remote storage - uses connection strings
const config = {
    cache: { type: 'redis', connectionString: 'redis://localhost:6379' },
    sessions: { type: 'database', connectionString: 'postgres://...' }
};

// Mixed - uses appropriate method for each backend
const config = {
    cache: { type: 'redis', connectionString: 'redis://localhost:6379' },
    data: { type: 'sqlite' }, // Uses local path resolution
};
```

### Override Options (Local Storage Only)
```typescript
const context = await StoragePathResolver.createLocalContext({
    forceGlobal: true,        // Always use ~/.saiki/
    customRoot: "/app/data",  // Use custom directory
    projectRoot: "/my/app"    // Override detected project root
});
```

### Remote Storage Context
```typescript
const context = StoragePathResolver.createRemoteContext(
    'redis://localhost:6379',
    {
        isDevelopment: true,
        connectionOptions: { db: 0, retryDelayOnFailover: 100 }
    }
);
```

## Configuration

### Simple String Configuration
```typescript
const config = {
    default: 'memory',        // Transforms to { type: 'memory' }
    sessions: 'file',         // Transforms to { type: 'file', path: './storage' }
    cache: 'sqlite'          // Transforms to { type: 'sqlite' }
};
```

### Object Configuration
```typescript
const config = {
    default: { type: 'memory', ttl: 3600 },
    history: { 
        type: 'sqlite', 
        table: 'chat_history',
        ttl: 1209600000  // 14 days
    },
    sessions: { 
        type: 'file', 
        format: 'json',
        backup: true 
    },
    custom: {
        metrics: { 
            type: 'sqlite', 
            table: 'metrics' 
        }
    }
};
```

### URL-Style Configuration
```typescript
const config = {
    default: 'redis://localhost:6379',
    database: 'postgres://user:pass@localhost:5432/saiki',
    files: 'file:./storage',
    s3: 's3:my-bucket:us-west-2'
};
```

## Usage Examples

### Basic Setup
```typescript
import { createStorageManager } from './storage/factory.js';

// Create storage manager
const storageManager = await createStorageManager({
    default: { type: 'memory' },
    history: { type: 'file', format: 'jsonl' },
    sessions: { type: 'sqlite' }
});

// Get different provider types
const settings = await storageManager.getProvider('user-settings');
const history = await storageManager.getCollectionProvider('chat-history');
const sessions = await storageManager.getSessionProvider('user-sessions');

// Use the providers
await settings.set('theme', 'dark');
await history.add({ message: 'Hello', timestamp: Date.now() });
await sessions.setSession('user123', { active: true }, 3600000);

// Cleanup
await storageManager.close();
```

### Service Integration Pattern

The storage system integrates with Saiki services through dependency injection. Services receive a `StorageManager` and request the specific storage types they need.

#### Pattern: Service Factories Accept StorageManager

```typescript
// Service factory pattern
export function createMyService(storageManager: StorageManager): MyService {
    return new MyService(storageManager);
}

// Service implementation
class MyService {
    private dataStore: StorageProvider<MyData>;
    private historyStore: CollectionStorageProvider<LogEntry>;

    constructor(private storageManager: StorageManager) {}

    async initialize() {
        // Request specific storage types
        this.dataStore = await this.storageManager.getProvider('my-service-data');
        this.historyStore = await this.storageManager.getCollectionProvider('my-service-logs');
    }

    async doWork(data: MyData) {
        await this.dataStore.set('current', data);
        await this.historyStore.add({ action: 'work-done', timestamp: Date.now() });
    }
}
```

#### Example: Allowed Tools Provider Integration

```typescript
// Tool confirmation service gets storage from manager
const allowedToolsProvider = createAllowedToolsProviderWithStorage(
    await storageManager.getProvider<boolean>('allowed-tools')
);

// Service uses storage for persistence
class AllowedToolsProvider {
    constructor(private storageProvider: StorageProvider<boolean>) {}

    async allowTool(toolName: string): Promise<void> {
        await this.storageProvider.set(toolName, true);
    }

    async isToolAllowed(toolName: string): Promise<boolean> {
        return (await this.storageProvider.get(toolName)) === true;
    }
}
```

#### Example: Chat Session with History Storage

```typescript
// Session gets storage manager and creates its own providers
class ChatSession {
    private messageHistory: CollectionStorageProvider<InternalMessage>;

    constructor(
        private services: {
            storageManager: StorageManager;
            // ... other services
        },
        private sessionId: string
    ) {}

    async initialize() {
        // Create session-specific history storage
        this.messageHistory = await this.services.storageManager
            .getCollectionProvider(`session-${this.sessionId}-history`);
    }

    async addMessage(message: InternalMessage) {
        await this.messageHistory.add(message);
    }
}
```

### Integration in Service Initializer

The main service initialization follows this pattern:

```typescript
export async function createAgentServices(agentConfig: AgentConfig): Promise<AgentServices> {
    // 1. Create storage manager first
    const storageManager = await createStorageManager(agentConfig.storage, {
        isDevelopment: process.env.NODE_ENV !== 'production',
        projectRoot: process.cwd(),
    });

    // 2. Pass storage manager to services that need it
    const allowedToolsProvider = createAllowedToolsProviderWithStorage(
        await storageManager.getProvider<boolean>('allowed-tools')
    );

    const sessionManager = new SessionManager({
        storageManager,  // Services get storage manager
        // ... other dependencies
    });

    // 3. Return all services including storage manager
    return {
        storageManager,
        sessionManager,
        // ... other services
    };
}
```

## Built-in Storage Keys

The system recognizes these built-in storage keys with automatic configuration:

- **`default`**: Fallback configuration for unspecified keys
- **`history`**: Conversation/chat history storage
- **`allowedTools`**: Tool permission storage
- **`userInfo`**: User profile and preferences
- **`toolCache`**: Tool response caching
- **`sessions`**: Session data storage
- **`custom.*`**: User-defined custom storage

## Best Practices

### 1. Choose the Right Interface
- **StorageProvider**: Settings, configuration, simple key-value data
- **CollectionStorageProvider**: Logs, history, lists of items
- **SessionStorageProvider**: Temporary data, rate limiting, TTL-based data

### 2. Namespace Your Data
```typescript
// Good: Use descriptive namespaces
const userSettings = await storageManager.getProvider('user-settings');
const chatHistory = await storageManager.getCollectionProvider('chat-history');

// Avoid: Generic names that might conflict
const data = await storageManager.getProvider('data');
```

### 3. Handle Cleanup
```typescript
// Always close storage manager when done
process.on('SIGINT', async () => {
    await storageManager.close();
    process.exit(0);
});
```

### 4. Use Appropriate Backends
- **Development**: Memory or file storage
- **Production**: SQLite for single-instance, Redis/PostgreSQL for distributed
- **Testing**: Memory storage for fast, isolated tests

### 5. Configure TTL Appropriately
```typescript
// Session data with reasonable TTL
await sessions.setSession('user123', data, 24 * 60 * 60 * 1000); // 24 hours

// Cache with shorter TTL
await cache.set('api-response', result, 5 * 60 * 1000); // 5 minutes
```

## Testing

The storage system is designed to be testable:

```typescript
// Use memory storage for tests
const testStorageManager = await createStorageManager({
    default: { type: 'memory' }
});

// Test your service
const service = createMyService(testStorageManager);
await service.doSomething();

// Verify storage interactions
const data = await testStorageManager.getProvider('my-service').get('key');
expect(data).toEqual(expectedValue);

// Cleanup
await testStorageManager.close();
```

## Migration and Versioning

When changing storage schemas:

```typescript
// Check for existing data version
const version = await settings.get('schema-version');
if (!version || version < CURRENT_VERSION) {
    await migrateData(settings, version, CURRENT_VERSION);
    await settings.set('schema-version', CURRENT_VERSION);
}
```

## Troubleshooting

### Common Issues

1. **"Unknown storage type" error**: Check your configuration object format
2. **Path resolution issues**: Verify project detection or use explicit paths
3. **Performance issues**: Consider appropriate backend for your use case
4. **Memory leaks**: Ensure `storageManager.close()` is called

### Debug Logging

Enable debug logging to see storage operations:

```bash
DEBUG=saiki:storage npm start
```

### Storage Info

Get information about current storage setup:

```typescript
const info = storageManager.getStorageInfo();
console.log('Storage type:', info.type);
console.log('Storage location:', info.location);
console.log('Storage context:', info.context);
```

## Contributing

When adding new storage backends:

1. Implement the `StorageProvider<T>` interface
2. Add factory support in `createStorageProvider()`
3. Update configuration schema
4. Add tests following existing patterns
5. Update this README

The storage system is designed to be extensible - new backends should integrate seamlessly with existing code.

## Frequently Asked Questions

### Q: How does file path logic work with remote databases like Redis?

**A:** It doesn't! This is a key architectural distinction:

- **Local storage backends** (`memory`, `file`, `sqlite`) use **path resolution** - the system creates directories like `.saiki/` or `~/.saiki/` and manages file paths
- **Remote storage backends** (`redis`, `database`, `s3`) use **connection strings** - no paths are involved, they connect to external services

The `StoragePathResolver.needsPathResolution(type)` method determines which approach to use:

```typescript
// These need path resolution (create .saiki directories)
StoragePathResolver.needsPathResolution('memory')  // true
StoragePathResolver.needsPathResolution('file')    // true  
StoragePathResolver.needsPathResolution('sqlite')  // true

// These use connection strings (no paths needed)
StoragePathResolver.needsPathResolution('redis')     // false
StoragePathResolver.needsPathResolution('database') // false
StoragePathResolver.needsPathResolution('s3')       // false
```

**Example configurations:**

```typescript
// Local storage config - paths resolved automatically
const localConfig = {
    default: { type: 'sqlite' }  // Will use .saiki/data.db
};

// Remote storage config - uses connection strings
const remoteConfig = {
    cache: { 
        type: 'redis', 
        connectionString: 'redis://localhost:6379/0' 
    },
    database: { 
        type: 'database', 
        connectionString: 'postgres://user:pass@host:5432/saiki' 
    }
};

// Mixed config - system handles both appropriately  
const mixedConfig = {
    cache: { type: 'redis', connectionString: 'redis://localhost:6379' },
    local: { type: 'sqlite' }  // Uses .saiki/ paths
};
```

The `StorageContext` type reflects this distinction with optional fields:
- `storageRoot`, `forceGlobal`, `customRoot` for local storage
- `connectionString`, `connectionOptions` for remote storage

### Q: What happens if I configure a remote backend incorrectly?

**A:** The system provides clear error messages:

```typescript
// ❌ Missing connection string for remote storage
const badConfig = { cache: { type: 'redis' } };
// Error: Remote storage type 'redis' requires connectionString

// ✅ Correct remote configuration
const goodConfig = { 
    cache: { 
        type: 'redis', 
        connectionString: 'redis://localhost:6379' 
    } 
};
```

## Integration Examples

### History Provider Integration

The storage system provides the foundation for Saiki's conversation history management:

```typescript
// src/core/ai/llm/messages/history/storage-based.ts
import { StorageManager } from '../../../storage/factory.js';
import type { CollectionStorageProvider } from '../../../storage/types.js';
import type { Message } from '../types.js';

export class StorageBasedHistoryProvider {
    private historyProvider!: CollectionStorageProvider<Message>;
    
    constructor(private storageManager: StorageManager) {}
    
    async initialize(): Promise<void> {
        // Get collection provider for conversation history
        this.historyProvider = await this.storageManager.getCollectionProvider<Message>('history');
    }
    
    async addMessage(message: Message): Promise<void> {
        await this.historyProvider.add(message);
    }
    
    async getHistory(sessionId?: string): Promise<Message[]> {
        if (sessionId) {
            return this.historyProvider.find(msg => msg.sessionId === sessionId);
        }
        return this.historyProvider.getAll();
    }
    
    async clearHistory(sessionId?: string): Promise<void> {
        if (sessionId) {
            await this.historyProvider.remove(msg => msg.sessionId === sessionId);
        } else {
            await this.historyProvider.clear();
        }
    }
}
```

### Tool Confirmation Storage

Store user preferences for tool confirmations:

```typescript
// src/core/client/tool-confirmation/allowed-tools-provider/storage-based.ts
import type { StorageProvider } from '../../../storage/types.js';
import { StorageManager } from '../../../storage/factory.js';

interface ToolPermission {
    toolName: string;
    allowed: boolean;
    timestamp: number;
    permanent: boolean;
}

export class StorageBasedAllowedToolsProvider {
    private provider!: StorageProvider<ToolPermission[]>;
    
    constructor(private storageManager: StorageManager) {}
    
    async initialize(): Promise<void> {
        this.provider = await this.storageManager.getProvider<ToolPermission[]>('allowedTools');
    }
    
    async isToolAllowed(toolName: string): Promise<boolean | undefined> {
        const permissions = await this.provider.get('permissions') || [];
        const permission = permissions.find(p => p.toolName === toolName);
        return permission?.allowed;
    }
    
    async setToolPermission(toolName: string, allowed: boolean, permanent = false): Promise<void> {
        const permissions = await this.provider.get('permissions') || [];
        const existingIndex = permissions.findIndex(p => p.toolName === toolName);
        
        const permission: ToolPermission = {
            toolName,
            allowed,
            timestamp: Date.now(),
            permanent
        };
        
        if (existingIndex >= 0) {
            permissions[existingIndex] = permission;
        } else {
            permissions.push(permission);
        }
        
        await this.provider.set('permissions', permissions);
    }
}
```

### Session Management

Use session storage for temporary data with TTL:

```typescript
// Example: User session management
import { StorageManager } from '../storage/factory.js';
import type { SessionStorageProvider } from '../storage/types.js';

interface UserSession {
    userId: string;
    preferences: Record<string, any>;
    lastActivity: number;
}

export class SessionManager {
    private sessionProvider!: SessionStorageProvider<UserSession>;
    
    constructor(private storageManager: StorageManager) {}
    
    async initialize(): Promise<void> {
        this.sessionProvider = await this.storageManager.getSessionProvider<UserSession>('sessions');
    }
    
    async createSession(userId: string, preferences: Record<string, any>): Promise<string> {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const session: UserSession = {
            userId,
            preferences,
            lastActivity: Date.now()
        };
        
        // Session expires in 24 hours
        await this.sessionProvider.setSession(sessionId, session, 24 * 60 * 60 * 1000);
        return sessionId;
    }
    
    async getSession(sessionId: string): Promise<UserSession | undefined> {
        return this.sessionProvider.getSession(sessionId);
    }
    
    async updateActivity(sessionId: string): Promise<void> {
        const session = await this.getSession(sessionId);
        if (session) {
            session.lastActivity = Date.now();
            await this.sessionProvider.setSession(sessionId, session);
        }
    }
}
```

### Application Initialization

How to set up storage in your Saiki application:

```typescript
// src/app/storage-setup.ts
import { createStorageManager } from '../core/storage/factory.js';
import type { StorageConfig } from '../core/config/schemas.js';

export async function setupStorage() {
    const config: StorageConfig = {
        // Default storage for general use
        default: { type: 'file', path: 'general' },
        
        // Conversation history stored in SQLite for durability
        history: { type: 'sqlite', database: 'conversations.db' },
        
        // Tool permissions in file storage
        allowedTools: { type: 'file', path: 'tool-permissions.json' },
        
        // User info in memory (cleared on restart)
        userInfo: { type: 'memory' },
        
        // Tool cache with TTL
        toolCache: { type: 'file', path: 'tool-cache' },
        
        // Sessions for temporary data
        sessions: { type: 'memory' },
        
        // Custom storage for specific features
        custom: {
            analytics: { type: 'file', path: 'analytics' },
            workspace: { type: 'sqlite', database: 'workspace.db' }
        }
    };
    
    const storageManager = await createStorageManager(config, {
        isDevelopment: process.env.NODE_ENV !== 'production',
        projectRoot: process.cwd()
    });
    
    // Initialize providers
    const historyProvider = new StorageBasedHistoryProvider(storageManager);
    await historyProvider.initialize();
    
    const toolsProvider = new StorageBasedAllowedToolsProvider(storageManager);
    await toolsProvider.initialize();
    
    const sessionManager = new SessionManager(storageManager);
    await sessionManager.initialize();
    
    return {
        storageManager,
        historyProvider,
        toolsProvider,
        sessionManager
    };
}
```

### Environment-Specific Configuration

Different storage setups for development vs production:

```typescript
// Development: Use local storage
const devConfig: StorageConfig = {
    default: { type: 'memory' },
    history: { type: 'file', path: 'dev-history.json' },
    allowedTools: { type: 'memory' },
    userInfo: { type: 'memory' },
    toolCache: { type: 'memory' },
    sessions: { type: 'memory' }
};

// Production: Use durable storage
const prodConfig: StorageConfig = {
    default: { type: 'sqlite', database: 'saiki.db' },
    history: { type: 'sqlite', database: 'conversations.db' },
    allowedTools: { type: 'file', path: 'tool-permissions.json' },
    userInfo: { type: 'file', path: 'user-info.json' },
    toolCache: { type: 'sqlite', database: 'cache.db' },
    sessions: { type: 'memory' } // Still use memory for sessions
};

// Use appropriate config based on environment
const config = process.env.NODE_ENV === 'production' ? prodConfig : devConfig;
```

## Type-Safe Storage Keys

The storage system now provides compile-time validation for storage keys to prevent typos and ensure consistency with the configured storage schema.

### Valid Storage Keys

Storage keys are automatically derived from your `StorageConfig` and include:

```typescript
// ✅ Predefined keys (from StorageConfig schema)
const userSettings = await storageManager.getProvider<UserSettings>('userInfo');
const chatHistory = await storageManager.getCollectionProvider<Message>('history');
const toolPermissions = await storageManager.getProvider<boolean>('allowedTools');
const cache = await storageManager.getProvider<any>('toolCache');
const sessions = await storageManager.getSessionProvider<SessionData>('sessions');

// ✅ Custom keys (extensible)
const customData = await storageManager.getProvider<MyData>('custom.myFeature');
const analytics = await storageManager.getCollectionProvider<Event>('custom.analytics');
```

### Compile-Time Validation

Invalid keys are caught at build time:

```typescript
// ❌ TypeScript Error: Argument of type '"user-settings"' is not assignable to parameter of type 'StorageKey'
const badKey1 = await storageManager.getProvider('user-settings'); // hyphen instead of camelCase

// ❌ TypeScript Error: Argument of type '"invalidKey"' is not assignable to parameter of type 'StorageKey'  
const badKey2 = await storageManager.getProvider('invalidKey'); // not in schema

// ❌ TypeScript Error: Must use 'custom.' prefix for extensions
const badKey3 = await storageManager.getProvider('myCustomKey'); // should be 'custom.myCustomKey'
```

### Adding New Storage Keys

To add new storage keys, update the `StorageSchema` in `src/core/config/schemas.ts`:

```typescript
export const StorageSchema = z.object({
    // ... existing keys ...
    myNewKey: StorageConfigSchema.optional().describe('My new storage type'),
});
```

The `StorageKey` type automatically includes any new keys you add to the schema.

## Integration Examples 