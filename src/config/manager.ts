import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { agentConfigSchema, llmConfigSchema } from './schemas.js';
import type { AgentConfig } from './schemas.js';
import type { CLIConfigOverrides, LLMProvenance } from './types.js';

declare function structuredClone<T>(value: T): T;

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

    constructor(fileConfig: any) {
        // Note: structuredClone requires Node.js v17.0.0+. For older versions, use a polyfill or lodash.cloneDeep.
        this.resolved = structuredClone(fileConfig);
        this.provenance = {
            llm: { provider: 'file', model: 'file', router: 'default', apiKey: 'file' },
        };
        // Initial validation can happen here or be deferred, but constructor should ensure a valid state.
        // Let's parse here to ensure this.resolved is always a valid AgentConfig from the start if possible.
        try {
            this.resolved = agentConfigSchema.parse(this.resolved);
        } catch (err) {
            this.printStateForError('Initial config parsing failed');
            this.handleZodError(err, 'agent'); // Re-throw consistently
        }
    }

    /** Apply CLI overrides and record provenance */
    overrideCLI(cliArgs: CLIConfigOverrides) {
        logger.debug('Applying CLI overrides to LLM config');
        // Ensure llm object exists before overriding its properties
        if (!this.resolved.llm) {
            this.resolved.llm = {} as any; // Or minimal valid structure
        }
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
        if (cliArgs.apiKey) {
            this.resolved.llm.apiKey = cliArgs.apiKey;
            this.provenance.llm.apiKey = 'cli';
        }
        // Re-apply defaults and validate after overrides
        this.validate();
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
        logger.info('Resolved configuration (current state):');
        logger.info(JSON.stringify(this.resolved, null, 2));
        logger.info('Configuration sources (LLM):');
        if (this.provenance && this.provenance.llm) {
            for (const [field, src] of Object.entries(this.provenance.llm)) {
                logger.info(`  • ${field}: ${src}`);
            }
        }
    }

    private printStateForError(contextMessage: string): void {
        logger.error(contextMessage);
        logger.error('Current configuration state before error:');
        logger.error(JSON.stringify(this.resolved, null, 2));
        logger.error('LLM Provenance state:');
        if (this.provenance && this.provenance.llm) {
            logger.error(JSON.stringify(this.provenance.llm, null, 2));
        }
    }

    private handleZodError(err: any, configSectionName: string): never {
        if (err instanceof z.ZodError) {
            const issues = err.errors.map((e) => {
                const p = e.path.join('.') || configSectionName;
                return `  • ${p}: ${e.message}`;
            });
            throw new Error(`Invalid ${configSectionName} configuration:\n${issues.join('\n')}`);
        }
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Unexpected error during ${configSectionName} config validation: ${msg}`);
    }

    /**
     * Validate the current resolved config. Throws Error with both schema issues and provenance.
     */
    validate(): void {
        try {
            // Parse the entire resolved config. This will also validate mcpServers and llm internally.
            // The parsed result will be strictly typed and will have stripped any unknown keys (by default).
            this.resolved = agentConfigSchema.parse(this.resolved);
            logger.debug('Agent configuration validation successful', 'green');
        } catch (err) {
            this.printStateForError('Validation failed for agent configuration');
            this.handleZodError(err, 'agent');
        }
    }
}
