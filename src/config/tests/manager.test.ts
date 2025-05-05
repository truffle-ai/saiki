import { describe, it, expect } from 'vitest';
import { ConfigManager } from '../manager.js';

// Helper to deep clone config
const clone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

const baseConfig = {
  mcpServers: {
    default: { type: 'stdio', command: 'node', args: [] },
  },
  llm: {
    provider: 'openai',
    model: 'o4-mini',
    systemPrompt: 'hi',
  },
};

describe('ConfigManager', () => {
  it('applies default router when missing', () => {
    const cm = new ConfigManager(clone(baseConfig) as any);
    const cfg = cm.getConfig();
    expect(cfg.llm.router).toBe('vercel');
  });

  it('records provenance of defaults', () => {
    const cm = new ConfigManager(clone(baseConfig) as any);
    const prov = cm.getProvenance();
    expect(prov.llm.router).toBe('default');
  });

  it('overrides CLI args and updates provenance', () => {
    const overrides = { provider: 'anthropic', model: 'claude-3-opus-20240229', router: 'foo', apiKey: '123' };
    const cm = new ConfigManager(clone(baseConfig) as any).overrideCLI(overrides as any);
    const cfg = cm.getConfig();
    expect(cfg.llm.provider).toBe('anthropic');
    expect(cfg.llm.model).toBe('claude-3-opus-20240229');
    expect(cfg.llm.router).toBe('foo');
    expect(cfg.llm.apiKey).toBe('123');
    const prov = cm.getProvenance();
    expect(prov.llm.provider).toBe('cli');
    expect(prov.llm.model).toBe('cli');
    expect(prov.llm.router).toBe('cli');
  });

  it('validate() passes for valid config', () => {
    const cm = new ConfigManager(clone(baseConfig) as any);
    expect(() => cm.validate()).not.toThrow();
  });

  it('throws when MCP server configs missing', () => {
    const bad = clone(baseConfig) as any;
    bad.mcpServers = {};
    expect(() => new ConfigManager(bad)).toThrow(/No MCP server configurations provided/);
  });

  it('throws when LLM config is missing', () => {
    const bad = clone(baseConfig);
    delete (bad as any).llm;
    expect(() => new ConfigManager(bad as any)).toThrow(/LLM configuration is missing in the resolved config|Cannot read properties of undefined/);
  });
}); 