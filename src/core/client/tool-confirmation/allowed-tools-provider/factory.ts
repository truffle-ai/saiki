import { AllowedToolsProvider } from './types.js';
import { InMemoryAllowedToolsProvider } from './in-memory.js';

export type AllowedToolsConfig = {
    provider?: 'memory';
    options?: Record<string, any>;
};

export function createAllowedToolsProvider(cfg: AllowedToolsConfig): AllowedToolsProvider {
    const provider = cfg.provider ?? 'memory';
    switch (provider) {
        case 'memory':
            return new InMemoryAllowedToolsProvider();
        default:
            throw new Error(`Unknown AllowedTools provider: ${provider}`);
    }
}
