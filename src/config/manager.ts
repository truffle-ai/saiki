import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { llmConfigSchema } from './schemas.js';
import type { AgentConfig, CLIConfigOverrides, LLMConfig, LLMProvenance } from './types.js';

/**
 * ConfigManager encapsulates merging file-based configuration, CLI overrides,
 * default values, validation, and provenance tracking for all configuration
 * sections (e.g., LLM settings, MCP servers, and more).
 *
 * Provenance records the origin of each configuration field—whether the value
 * came from the configuration file, a CLI override, or a default.
 */
export class ConfigManager {
    private resolved: AgentConfig;
    private provenance: { llm: LLMProvenance };

    constructor(fileConfig: AgentConfig) {
        this.resolved = structuredClone(fileConfig);
        this.provenance = { llm: { provider: 'file', model: 'file', router: 'default' } };
        this.applyDefaults();
    }

    private applyDefaults() {
        if (!this.resolved.llm.router) {
            this.resolved.llm.router = 'vercel';
            this.provenance.llm.router = 'default';
        }
    }

    /** Apply CLI overrides and record provenance */
    overrideCLI(cliArgs: CLIConfigOverrides) {
        logger.debug('Applying CLI overrides to LLM config');
        if (cliArgs.provider) {
            this.resolved.llm.provider = cliArgs.provider;
            this.provenance.llm.provider = 'cli';
        }
        if (cliArgs.model) {
            this.resolved.llm.model = cliArgs.model;
            this.provenance.llm.model = 'cli';
        }
        if (cliArgs.router) {
            this.resolved.llm.router = cliArgs.router;
            this.provenance.llm.router = 'cli';
        }
        return this;
    }

    /** Returns the fully resolved AgentConfig */
    getConfig(): AgentConfig {
        return this.resolved;
    }

    /** Returns the provenance map for LLM settings */
    getProvenance(): { llm: LLMProvenance } {
        return this.provenance;
    }

    /** Pretty-print the resolved config and provenance */
    print(): void {
        logger.info('Resolved configuration:');
        logger.info(JSON.stringify(this.resolved, null, 2));
        logger.info('Configuration sources:');
        for (const [field, src] of Object.entries(this.provenance.llm)) {
            logger.info(`  • ${field}: ${src}`);
        }
    }

    /**
     * Validate the current resolved config. Throws Error with both schema issues and provenance.
     * Delegates to helper methods for each section of the config.
     */
    validate(): void {
        try {
            this.validateMcpServers();
            this.validateLlm();
            logger.debug('LLM config validation successful', 'green');
        } catch (err) {
            // On validation failure, dump resolved config and provenance for debugging
            this.print();
            throw err;
        }
    }

    /**
     * Validates the MCP servers configuration
     */
    private validateMcpServers(): void {
        if (!this.resolved.mcpServers || Object.keys(this.resolved.mcpServers).length === 0) {
            throw new Error('No MCP server configurations provided in the resolved config.');
        }
    }

    /**
     * Validates the LLM configuration
     */
    private validateLlm(): void {
        if (!this.resolved.llm) {
            throw new Error('LLM configuration is missing in the resolved config.');
        }
        try {
            llmConfigSchema.parse(this.resolved.llm);
        } catch (err) {
            if (err instanceof z.ZodError) {
                const issues = err.errors.map((e) => {
                    const p = e.path.join('.') || 'config';
                    return `  • ${p}: ${e.message}`;
                });
                throw new Error(`Invalid LLM configuration:\n${issues.join('\n')}`);
            }
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(`Unexpected error during LLM config validation: ${msg}`);
        }
    }
}
