import { describe, it, expect } from 'vitest';
import { StaticConfigManager } from './static-config-manager.js';
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

describe('StaticConfigManager', () => {
    it('applies default router when missing', () => {
        const cm = new StaticConfigManager(clone(baseConfig));
        const cfg = cm.getConfig();
        expect(cfg.llm.router).toBe('vercel');
    });

    it('records provenance of defaults', () => {
        const cm = new StaticConfigManager(clone(baseConfig));
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
        const cm = new StaticConfigManager(clone(baseConfig), overrides);
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

    it('still supports method chaining for CLI overrides', () => {
        const overrides: CLIConfigOverrides = {
            provider: 'anthropic',
            model: 'claude-3-haiku-20240307',
        };
        const cm = new StaticConfigManager(clone(baseConfig)).overrideCLI(overrides);
        const cfg = cm.getConfig();
        expect(cfg.llm.provider).toBe('anthropic');
        expect(cfg.llm.model).toBe('claude-3-haiku-20240307');
    });

    it('validate() passes for valid config', () => {
        const cm = new StaticConfigManager(clone(baseConfig));
        expect(() => cm.validate()).not.toThrow();
    });

    it('allows empty MCP server configs since they are now optional', () => {
        const configWithNoServers: AgentConfig = clone(baseConfig);
        configWithNoServers.mcpServers = {};
        expect(() => new StaticConfigManager(configWithNoServers)).not.toThrow();
    });

    it('throws when LLM config is missing', () => {
        const bad: AgentConfig = clone(baseConfig);
        bad.llm = undefined as any;
        expect(() => new StaticConfigManager(bad)).toThrow();
    });

    it('returns readonly config to prevent external modifications', () => {
        const cm = new StaticConfigManager(clone(baseConfig));
        const cfg = cm.getConfig();

        // Should get a new instance each time (deep clone)
        const cfg2 = cm.getConfig();
        expect(cfg).not.toBe(cfg2);
        expect(cfg).toEqual(cfg2);
    });

    it('tracks CLI override summary correctly', () => {
        const overrides: CLIConfigOverrides = {
            provider: 'anthropic',
            model: 'claude-3-opus-20240229',
        };
        const cm = new StaticConfigManager(clone(baseConfig), overrides);

        expect(cm.hasCliOverrides()).toBe(true);

        const summary = cm.getCliOverridesSummary();
        expect(summary.hasOverrides).toBe(true);
        expect(summary.overriddenFields).toHaveLength(2);
        expect(summary.overriddenFields.map((f) => f.field)).toContain('provider');
        expect(summary.overriddenFields.map((f) => f.field)).toContain('model');
    });

    it('stores and returns original config separately from resolved config', () => {
        const cm = new StaticConfigManager(clone(baseConfig));

        const original = cm.getOriginalConfig();
        const resolved = cm.getConfig();

        // Original should match what we passed in (but router will be missing)
        expect(original.llm.provider).toBe('openai');
        expect(original.llm.model).toBe('o4-mini');
        expect(original.llm.router).toBeUndefined(); // Not in original

        // Resolved should have defaults applied
        expect(resolved.llm.provider).toBe('openai');
        expect(resolved.llm.model).toBe('o4-mini');
        expect(resolved.llm.router).toBe('vercel'); // Default applied

        // Should return different instances (deep clones)
        expect(original).not.toBe(resolved);
    });

    it('tracks config changes between original and resolved', () => {
        const cm = new StaticConfigManager(clone(baseConfig));
        const changes = cm.getConfigChanges();

        expect(changes.hasChanges).toBe(true);
        expect(changes.addedDefaults).toContain('router'); // Router was added as default
        expect(changes.llmChanges).toHaveLength(0); // No values changed, just defaults added
    });

    it('tracks config changes with CLI overrides', () => {
        const overrides: CLIConfigOverrides = {
            provider: 'anthropic',
            model: 'claude-3-opus-20240229',
        };
        const cm = new StaticConfigManager(clone(baseConfig), overrides);
        const changes = cm.getConfigChanges();

        expect(changes.hasChanges).toBe(true);
        expect(changes.addedDefaults).toContain('router'); // Router was added as default
        expect(changes.llmChanges).toHaveLength(2); // Provider and model changed

        const providerChange = changes.llmChanges.find((c) => c.field === 'provider');
        expect(providerChange?.original).toBe('openai');
        expect(providerChange?.resolved).toBe('anthropic');
        expect(providerChange?.source).toBe('cli');
    });

    // High-value tests for edge cases and error handling
    describe('validation and error handling', () => {
        it('validate throws meaningful errors for invalid configs', () => {
            const cm = new StaticConfigManager(clone(baseConfig));

            // Corrupt the internal state to test validation
            (cm as any).resolved.llm.provider = 'invalid-provider';

            expect(() => cm.validate()).toThrow(/Invalid agent configuration/);
        });

        it('constructor validation catches invalid configs immediately', () => {
            const invalidConfig = clone(baseConfig);
            invalidConfig.llm.provider = 'not-a-real-provider' as any;

            expect(() => new StaticConfigManager(invalidConfig)).toThrow();
        });

        it('overrideCLI throws when LLM config is uninitialized', () => {
            const cm = new StaticConfigManager(clone(baseConfig));

            // Corrupt internal state
            (cm as any).resolved.llm = undefined;

            expect(() => cm.overrideCLI({ provider: 'anthropic' })).toThrow(
                'LLM config is not initialized'
            );
        });
    });

    describe('immutability protection', () => {
        it('prevents external mutation of returned configs', () => {
            const cm = new StaticConfigManager(clone(baseConfig));

            const config = cm.getConfig();
            const original = cm.getOriginalConfig();
            const provenance = cm.getProvenance();

            // Attempt to mutate returned objects
            config.llm.provider = 'hacked' as any;
            original.llm.provider = 'hacked' as any;
            (provenance.llm as any).provider = 'hacked';

            // Internal state should be unchanged
            expect(cm.getConfig().llm.provider).toBe('openai');
            expect(cm.getOriginalConfig().llm.provider).toBe('openai');
            expect(cm.getProvenance().llm.provider).toBe('file');
        });

        it('returns new instances on each call to prevent reference sharing', () => {
            const cm = new StaticConfigManager(clone(baseConfig));

            const config1 = cm.getConfig();
            const config2 = cm.getConfig();
            const original1 = cm.getOriginalConfig();
            const original2 = cm.getOriginalConfig();

            // Should be equal but not the same reference
            expect(config1).toEqual(config2);
            expect(config1).not.toBe(config2);
            expect(original1).toEqual(original2);
            expect(original1).not.toBe(original2);
        });
    });
});
