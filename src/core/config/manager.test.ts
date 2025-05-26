import { describe, it, expect } from 'vitest';
import { ConfigManager } from './manager.js';
import type { AgentConfig } from './schemas.js';
import { CLIConfigOverrides } from './types.js';

// Helper to deep clone config
const clone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

// Use AgentConfig type for baseConfig
const baseConfig: AgentConfig = {
    mcpServers: {
        default: { type: 'stdio', command: 'node', args: [] },
    },
    llm: {
        provider: 'openai',
        model: 'o4-mini',
        systemPrompt: 'hi',
        apiKey: '123',
    },
};

describe('ConfigManager', () => {
    it('applies default router when missing', () => {
        const cm = new ConfigManager(clone(baseConfig));
        const cfg = cm.getConfig();
        expect(cfg.llm.router).toBe('vercel');
    });

    it('records provenance of defaults', () => {
        const cm = new ConfigManager(clone(baseConfig));
        const prov = cm.getProvenance();
        expect(prov.llm.router).toBe('default');
    });

    it('overrides CLI args and updates provenance', () => {
        const overrides: CLIConfigOverrides = {
            provider: 'anthropic',
            model: 'claude-3-opus-20240229',
            router: 'in-built',
            apiKey: '123',
        };
        const cm = new ConfigManager(clone(baseConfig)).overrideCLI(overrides);
        const cfg = cm.getConfig();
        expect(cfg.llm.provider).toBe('anthropic');
        expect(cfg.llm.model).toBe('claude-3-opus-20240229');
        expect(cfg.llm.router).toBe('in-built');
        expect(cfg.llm.apiKey).toBe('123');
        const prov = cm.getProvenance();
        expect(prov.llm.provider).toBe('cli');
        expect(prov.llm.model).toBe('cli');
        expect(prov.llm.router).toBe('cli');
    });

    it('validate() passes for valid config', () => {
        const cm = new ConfigManager(clone(baseConfig));
        expect(() => cm.validate()).not.toThrow();
    });

    it('throws when MCP server configs missing', () => {
        const bad: AgentConfig = clone(baseConfig);
        bad.mcpServers = {};
        expect(() => new ConfigManager(bad)).toThrow();
    });

    it('throws when LLM config is missing', () => {
        const bad: AgentConfig = clone(baseConfig);
        bad.llm = undefined as any;
        expect(() => new ConfigManager(bad)).toThrow();
    });
});
