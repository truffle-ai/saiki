import { promises as fs } from 'fs';
import path from 'path';
import type { ConversationHistoryProvider } from './types.js';
import type { InternalMessage } from '../types.js';

export class FileHistoryProvider implements ConversationHistoryProvider {
    private dir: string;

    constructor(dir: string) {
        this.dir = dir;
    }

    private filePath(sessionId: string): string {
        return path.join(this.dir, `${sessionId}.json`);
    }

    async getHistory(sessionId: string): Promise<InternalMessage[]> {
        const fp = this.filePath(sessionId);
        try {
            const data = await fs.readFile(fp, 'utf-8');
            return JSON.parse(data) as InternalMessage[];
        } catch (e: any) {
            if (e.code === 'ENOENT') {
                // No file yet
                return [];
            }
            throw e;
        }
    }

    async saveMessage(sessionId: string, message: InternalMessage): Promise<void> {
        const fp = this.filePath(sessionId);
        const history = await this.getHistory(sessionId);
        history.push(message);
        await fs.mkdir(path.dirname(fp), { recursive: true });
        // Write atomically to avoid partial or corrupt JSON and ensure a trailing newline
        const tmpPath = `${fp}.tmp`;
        let data: string;
        try {
            data = JSON.stringify(history, null, 2) + '\n';
        } catch (e) {
            throw new Error(`Failed to serialize history: ${e}`);
        }
        await fs.writeFile(tmpPath, data, 'utf-8');
        await fs.rename(tmpPath, fp);
    }

    async clearHistory(sessionId: string): Promise<void> {
        const fp = this.filePath(sessionId);
        try {
            await fs.unlink(fp);
        } catch (e: any) {
            if (e.code !== 'ENOENT') {
                throw e;
            }
            // ignore if file does not exist
        }
    }
}
