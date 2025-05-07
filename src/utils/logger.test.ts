import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger, logger } from './logger.js';

// Ensure console.log is mocked and environment is reset between tests
beforeEach(() => {
    delete process.env.LOG_LEVEL;
    delete process.env.DEBUG;
    vi.restoreAllMocks();
});

describe('Logger utilities', () => {
    let spyLog: ReturnType<typeof vi.spyOn>;
    let spyStdErrWrite: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        spyLog = vi.spyOn(console, 'log').mockImplementation(() => {});
        spyStdErrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    it('getDefaultLogLevel falls back to "info"', () => {
        const l = new Logger();
        expect(l.getLevel()).toBe('info');
    });

    it('respects LOG_LEVEL env var', () => {
        process.env.LOG_LEVEL = 'debug';
        const l = new Logger();
        expect(l.getLevel()).toBe('debug');
    });

    it('setLevel updates level and rejects invalid levels', () => {
        const l = new Logger({ level: 'info' });
        l.setLevel('warn');
        expect(l.getLevel()).toBe('warn');
        // Invalid level should not change current level
        l.setLevel('invalid');
        expect(l.getLevel()).toBe('warn');
    });

    it('toolCall logs tool name and arguments', () => {
        logger.toolCall('testTool', { foo: 'bar' });
        // Expect toolCall output to go to stdout
        expect(spyLog).toHaveBeenCalledWith(expect.stringContaining('Tool Call'));
    });
});
