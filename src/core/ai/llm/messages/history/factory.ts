import { ConversationHistoryProvider } from './types.js';
import { InMemoryHistoryProvider } from './in-memory.js';
import { FileHistoryProvider } from './file.js';
import os from 'os';
import path from 'path';

export type HistoryConfig = {
    provider?: 'memory' | 'file';
    options?: Record<string, any>;
};

export function createHistoryProvider(cfg: HistoryConfig): ConversationHistoryProvider {
    const provider = cfg.provider ?? 'memory';
    switch (provider) {
        case 'memory':
            return new InMemoryHistoryProvider();
        case 'file': {
            const defaultDir = path.join(os.homedir(), '.saiki', 'history');
            const dir = cfg.options?.dir ?? defaultDir;
            return new FileHistoryProvider(dir);
        }
        default:
            throw new Error(`Unknown history provider: ${provider}`);
    }
}
