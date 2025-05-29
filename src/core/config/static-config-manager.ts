import { z } from 'zod';
import { logger } from '../logger/index.js';
import { AgentConfigSchema } from './schemas.js';
import type { AgentConfig } from './schemas.js';
import type { CLIConfigOverrides, LLMProvenance, LLMOverrideKey } from './types.js';
import { loadConfigFile } from './loader.js';

declare function structuredClone<T>(value: T): T;

/**
 * StaticConfigManager: Handles static configuration loading, CLI overrides, and provenance tracking.
 *
 * This class manages configuration that is set during initialization and doesn't change during runtime.
 * It tracks provenance (source) of each configuration field and applies CLI overrides.
 *
 * **What this handles (Static Operations):**
 * - Loading configuration from files (YAML/JSON)
 * - Applying CLI argument overrides once during initialization
 * - Provenance tracking (file, cli, default sources)
 * - Configuration validation
 * - Hot reloading from config files
 * - Read-only access to processed configuration
 *
 * **What this does NOT handle (Runtime Operations - use AgentStateManager):**
 * - Runtime LLM configuration changes (updateLLMConfig)
 * - Dynamic MCP server management (addMcpServer, removeMcpServer)
 * - Session-specific overrides
 * - Runtime state changes during agent execution
 *
 * **Provenance Tracking:**
 * Tracks the source of each configuration field:
 * - 'file': Value came from the configuration file
 * - 'cli': Value was overridden by CLI arguments
 * - 'default': Value came from schema defaults
 * - 'runtime': Value was changed during runtime (handled by AgentStateManager)
 */
export class StaticConfigManager {
    private resolved!: AgentConfig;
    private provenance!: { llm: LLMProvenance };

    constructor(fileConfig: AgentConfig) {
        this.initFromConfig(fileConfig);
    }

    /**
     * Initializes the agent configuration from a configuration object.
     * This will re-validate the entire configuration and apply Zod schema defaults.
     * Existing CLI overrides are NOT automatically re-applied.
     * Call overrideCLI separately after loading if CLI overrides should persist.
     *
     * @param newFileConfig The new configuration object (typically from a config file).
     */
    public initFromConfig(newFileConfig: AgentConfig): void {
        logger.debug('Loading new agent configuration...');

        // Use native structuredClone when available, else fall back to JSON parse/stringify for deep cloning.
        // This fallback is generally fine for config objects but has limitations (e.g., Date objects, functions, undefined values).
        this.resolved =
            typeof globalThis.structuredClone === 'function'
                ? structuredClone(newFileConfig)
                : JSON.parse(JSON.stringify(newFileConfig));

        // Reset provenance to the initial state, as if loading from a file for the first time.
        // This assumes CLI overrides will be applied separately by calling overrideCLI if needed.
        this.provenance = {
            llm: { provider: 'file', model: 'file', router: 'default', apiKey: 'file' },
        };

        this.validate(); // Parse, validate, and apply Zod defaults to this.resolved.
        logger.info('New agent configuration loaded and validated.');
    }

    /**
     * Reloads the agent configuration directly from a config file.
     * This effectively hot reloads the configuration.
     *
     * @param configPath The path to the configuration file.
     */
    public async hotReloadFromFile(configPath: string): Promise<void> {
        logger.debug(`Attempting to hot reload configuration from: ${configPath}`);
        try {
            const newFileConfig: AgentConfig = await loadConfigFile(configPath);
            this.initFromConfig(newFileConfig); // Use the existing initFromConfig to update the instance state
            logger.info(`Successfully hot reloaded configuration from: ${configPath}`);
        } catch (error: any) {
            logger.error(`Failed to hot reload configuration from ${configPath}: ${error.message}`);
            // Re-throw or handle as appropriate for your application
            throw error;
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
     * Pretty-print the resolved config and provenance for debugging.
     */
    public print(): void {
        logger.info('Resolved configuration (current state):');
        logger.info(JSON.stringify(this.resolved, null, 2));
        logger.info('Configuration sources (LLM):');
        for (const [field, src] of Object.entries(this.provenance?.llm ?? {})) {
            logger.info(`  • ${field}: ${src}`);
        }
    }

    /**
     * Export configuration as YAML string (for API responses).
     *
     * @param sanitize Whether to remove sensitive information like API keys
     */
    public exportAsYaml(sanitize: boolean = true): string {
        const exportConfig = this.getConfig() as AgentConfig;

        if (sanitize && exportConfig.llm && 'apiKey' in exportConfig.llm) {
            exportConfig.llm.apiKey = 'SET_YOUR_API_KEY_HERE';
        }

        // Import YAML stringify dynamically since it might not be available in all environments
        try {
            const { stringify } = require('yaml');
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
        logger.error(JSON.stringify(this.resolved, null, 2));
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
