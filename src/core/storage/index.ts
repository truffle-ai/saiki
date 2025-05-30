// Main storage interfaces and types
export * from './types.js';

// Main storage factory
export {
    createStorageInstances,
    createLocalStorageContext,
    createLocalStorageContextWithAutoDetection,
    createRemoteStorageContext,
} from './factory.js';

// Domain-specific factories (for direct use if needed)
export { createHistoryStorage } from './history/factory.js';
export { createSessionStorage } from './sessions/factory.js';
export { createUserInfoStorage } from './userInfo/factory.js';

// Domain implementations (for direct use if needed)
export * from './history/index.js';
export * from './sessions/index.js';
export * from './userInfo/index.js';

// Utilities
export { StoragePathResolver } from './path-resolver.js';
