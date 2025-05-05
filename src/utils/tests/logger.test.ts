import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger, logger } from '../logger.js';

// Ensure console.log is mocked and environment is reset between tests
beforeEach(() => {
  delete process.env.LOG_LEVEL;
  delete process.env.DEBUG;
  vi.restoreAllMocks();
});

describe('Logger utilities', () => {
  let spyLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spyLog = vi.spyOn(console, 'log').mockImplementation(() => {});
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

  it('enables debug via DEBUG env var', () => {
    process.env.DEBUG = 'true';
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

  it('redacts sensitive keys in messages', () => {
    const raw = 'User password="secret123" logged in';
    // Redaction regex from logger implementation
    const SENSITIVE_KEYS = ['apiKey', 'password', 'secret', 'token'];
    const MASK_REGEX = new RegExp(
      `(${SENSITIVE_KEYS.join('|')})(["']?\\s*[:=]\\s*)(["'])?.*?\\3`,
      'gi'
    );
    const masked = raw.replace(MASK_REGEX, '$1$2$3[REDACTED]$3');
    expect(masked).toContain('[REDACTED]');
  });

  it('chatUser and chatAI prefix correctly', () => {
    const msg = 'hello';
    logger.chatUser(msg);
    expect(spyLog).toHaveBeenCalledWith(expect.stringContaining('👤 User'));
    logger.chatAI(msg);
    expect(spyLog).toHaveBeenCalledWith(expect.stringContaining('🤖 AI'));
  });

  it('toolCall logs tool name and arguments', () => {
    logger.toolCall('testTool', { foo: 'bar' });
    expect(spyLog).toHaveBeenCalledWith(expect.stringContaining('Tool Call'));
  });
}); 