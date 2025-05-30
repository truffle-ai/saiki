import { z } from 'zod';
import { logger } from '../logger/index.js';
import { AgentConfigSchema } from './schemas.js';
import type { AgentConfig, LLMConfig } from './schemas.js';
import type { CLIConfigOverrides, LLMProvenance, LLMOverrideKey } from './types.js';

declare function structuredClone<T>(value: T): T;

/**
 * StaticConfigManager: Handles static configuration loading, CLI overrides, and provenance tracking.
 *
 * This class manages configuration that is set during initialization and doesn't change during runtime.
 * It tracks provenance (source) of each configuration field and applies CLI overrides.
 *
 * **What this handles (Static Operations):**
 * - Loading configuration from files (handled by caller, this class processes the loaded config)
 * - Applying CLI argument overrides once during initialization
 * - Provenance tracking (file, cli, default sources)
 * - Configuration validation
 * - Read-only access to processed configuration
 *
 * **What this does NOT handle (Runtime Operations - use AgentStateManager):**
 * - Runtime LLM configuration changes (updateLLMConfig)
 * - Dynamic MCP server management (addMcpServer, removeMcpServer)
 * - Session-specific overrides
 * - Runtime state changes during agent execution
 * - Hot reloading (config loading is handled by caller)
 *
 * **Provenance Tracking:**
 * Tracks the source of each configuration field:
 * - 'file': Value came from the configuration file
 * - 'cli': Value was overridden by CLI arguments
 * - 'default': Value came from schema defaults
 * - 'runtime': Value was changed during runtime (handled by AgentStateManager)
 */
export class StaticConfigManager {
    private resolved: AgentConfig;
    private provenance: { llm: LLMProvenance };
    private originalConfig: AgentConfig; // Store the original config file before processing

    constructor(fileConfig: AgentConfig, cliOverrides?: CLIConfigOverrides) {
        logger.debug('Loading agent configuration...');

        // Store the original config for reference (deep clone to prevent mutations)
        this.originalConfig =
            typeof globalThis.structuredClone === 'function'
                ? structuredClone(fileConfig)
                : JSON.parse(JSON.stringify(fileConfig));

        // Use native structuredClone when available, else fall back to JSON parse/stringify for deep cloning.
        // This fallback is generally fine for config objects but has limitations (e.g., Date objects, functions, undefined values).
        this.resolved =
            typeof globalThis.structuredClone === 'function'
                ? structuredClone(fileConfig)
                : JSON.parse(JSON.stringify(fileConfig));

        // Initialize provenance to track where each config value came from
        this.provenance = {
            llm: { provider: 'file', model: 'file', router: 'default', apiKey: 'file' },
        };

        this.validate(); // Parse, validate, and apply Zod defaults to this.resolved.
        logger.info('Agent configuration loaded and validated.');

        // Apply CLI overrides automatically if provided
        if (cliOverrides) {
            this.overrideCLI(cliOverrides);
        }
    }

    /**
     * Apply CLI overrides and record provenance.
     * This is a one-time operation during initialization.
     *
     * @param cliArgs CLI arguments containing LLM field overrides
     * @returns this for method chaining
     */
    public overrideCLI(cliArgs: CLIConfigOverrides): this {
        logger.debug('Applying CLI overrides to LLM config');

        // Ensure llm object exists before overriding its properties
        if (!this.resolved.llm) {
            throw new Error('LLM config is not initialized');
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
        logger.info('CLI overrides applied and validated successfully');
        return this;
    }

    /**
     * Returns the fully resolved AgentConfig (read-only).
     * This is the configuration that should be used to initialize AgentStateManager.
     */
    public getConfig(): Readonly<AgentConfig> {
        // Return a deep clone to prevent external modifications
        return typeof globalThis.structuredClone === 'function'
            ? structuredClone(this.resolved)
            : JSON.parse(JSON.stringify(this.resolved));
    }

    /**
     * Returns the original config file before any processing or CLI overrides (read-only).
     * This is useful for debugging, provenance tracking, and comparing with the resolved config.
     */
    public getOriginalConfig(): Readonly<AgentConfig> {
        // Return a deep clone to prevent external modifications
        return typeof globalThis.structuredClone === 'function'
            ? structuredClone(this.originalConfig)
            : JSON.parse(JSON.stringify(this.originalConfig));
    }

    /**
     * Returns the provenance map for LLM settings.
     * This shows where each LLM configuration field came from (file, cli, default).
     */
    public getProvenance(): Readonly<{ llm: LLMProvenance }> {
        return structuredClone(this.provenance);
    }

    /**
     * Check if any CLI overrides were applied.
     *
     * @returns true if any LLM fields have 'cli' provenance
     */
    public hasCliOverrides(): boolean {
        return Object.values(this.provenance.llm).includes('cli');
    }

    /**
     * Get a summary of CLI overrides that were applied.
     *
     * @returns Object describing which fields were overridden via CLI
     */
    public getCliOverridesSummary(): {
        hasOverrides: boolean;
        overriddenFields: Array<{ field: LLMOverrideKey; source: string }>;
    } {
        const overriddenFields: Array<{ field: LLMOverrideKey; source: string }> = [];

        for (const [field, source] of Object.entries(this.provenance.llm) as Array<
            [LLMOverrideKey, string]
        >) {
            if (source === 'cli') {
                overriddenFields.push({ field, source });
            }
        }

        return {
            hasOverrides: overriddenFields.length > 0,
            overriddenFields,
        };
    }

    /**
     * Get a summary of changes between original config and resolved config.
     * This includes both schema defaults that were applied and CLI overrides.
     *
     * @returns Object describing what changed from original to resolved
     */
    public getConfigChanges(): {
        hasChanges: boolean;
        llmChanges: Array<{
            field: keyof LLMConfig;
            original: LLMConfig[keyof LLMConfig];
            resolved: LLMConfig[keyof LLMConfig];
            source: string;
        }>;
        addedDefaults: Array<keyof LLMConfig>;
    } {
        const llmChanges: Array<{
            field: keyof LLMConfig;
            original: LLMConfig[keyof LLMConfig];
            resolved: LLMConfig[keyof LLMConfig];
            source: string;
        }> = [];
        const addedDefaults: Array<keyof LLMConfig> = [];

        // Compare LLM configs
        const originalLLM = this.originalConfig.llm || {};
        const resolvedLLM = this.resolved.llm || {};

        // Iterate through resolved LLM config fields with proper typing
        for (const field of Object.keys(resolvedLLM) as Array<keyof LLMConfig>) {
            const originalValue = originalLLM[field];
            const resolvedValue = resolvedLLM[field];
            const source = this.provenance.llm[field as LLMOverrideKey] || 'unknown';

            if (originalValue !== resolvedValue) {
                if (originalValue === undefined) {
                    addedDefaults.push(field);
                } else {
                    llmChanges.push({
                        field,
                        original: originalValue,
                        resolved: resolvedValue,
                        source,
                    });
                }
            }
        }

        return {
            hasChanges: llmChanges.length > 0 || addedDefaults.length > 0,
            llmChanges,
            addedDefaults,
        };
    }

    /**
     * Export configuration as YAML string (for API responses).
     *
     * @param sanitize Whether to remove sensitive information like API keys
     */
    public async exportAsYaml(sanitize: boolean = true): Promise<string> {
        const exportConfig = this.getConfig() as AgentConfig;

        if (sanitize && exportConfig.llm && 'apiKey' in exportConfig.llm) {
            exportConfig.llm.apiKey = 'SET_YOUR_API_KEY_HERE';
        }

        try {
            const { stringify } = await import('yaml');
            return stringify(exportConfig, { indent: 2 });
        } catch (error) {
            // Fallback to JSON if YAML is not available
            logger.warn('YAML not available, falling back to JSON export');
            return this.exportAsJson(sanitize);
        }
    }

    /**
     * Export configuration as JSON string (for API responses).
     *
     * @param sanitize Whether to remove sensitive information like API keys
     */
    public exportAsJson(sanitize: boolean = true): string {
        const exportConfig = this.getConfig() as AgentConfig;

        if (sanitize && exportConfig.llm && 'apiKey' in exportConfig.llm) {
            exportConfig.llm.apiKey = 'SET_YOUR_API_KEY_HERE';
        }

        return JSON.stringify(exportConfig, null, 2);
    }

    // ============= PRIVATE METHODS =============

    private printStateForError(contextMessage: string): void {
        logger.error(contextMessage);
        logger.error('Current configuration state before error:');
        // sanitize config and then print
        logger.error(JSON.stringify(this.exportAsJson(true), null, 2));
        logger.error('LLM Provenance state:');
        if (this.provenance?.llm) {
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
    public validate(): void {
        try {
            // Parse the entire resolved config. This will validate the entire agent config.
            // The parsed result will be strictly typed and will have stripped any unknown keys (by default).
            this.resolved = AgentConfigSchema.parse(this.resolved);
            logger.debug('Agent configuration validation successful');
        } catch (err) {
            this.printStateForError('Validation failed for agent configuration');
            this.handleZodError(err, 'agent');
        }
    }
}
