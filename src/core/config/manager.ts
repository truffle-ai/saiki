import { z } from 'zod';
import { logger } from '../logger/index.js';
import { AgentConfigSchema } from './schemas.js';
import type { AgentConfig } from './schemas.js';
import type { CLIConfigOverrides, LLMProvenance, LLMOverrideKey } from './types.js';
import { loadConfigFile } from './loader.js';

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

    constructor(fileConfig: AgentConfig) {
        this.initFromConfig(fileConfig);
    }

    /**
     * Initializes the agent configuration from a configuration object
     * This will re-validate the entire configuration and apply Zod schema defaults.
     * Existing CLI overrides are NOT automatically re-applied.
     * Call overrideCLI separately after loading if CLI overrides should persist.
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
     * Reloads the agent configuration directly from a config file
     * This effectively hot reloads the configuration.
     * @param configPath The path to the configuration file.
     */
    public async hotReloadFromFile(configPath: string): Promise<void> {
        logger.debug(`Attempting to hot reload configuration from: ${configPath}`);
        try {
            const newFileConfig: AgentConfig = await loadConfigFile(configPath);
            this.initFromConfig(newFileConfig); // Use the existing loadConfig to update the instance state
            logger.info(`Successfully hot reloaded configuration from: ${configPath}`);
        } catch (error) {
            logger.error(`Failed to hot reload configuration from ${configPath}: ${error.message}`);
            // Re-throw or handle as appropriate for your application
            // For now, re-throwing to make the caller aware of the failure.
            throw error;
        }
    }

    /** Apply CLI overrides and record provenance */
    overrideCLI(cliArgs: CLIConfigOverrides) {
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

    /**
     * Updates the LLM configuration safely and validates the changes.
     * @param newLLMConfig The new LLM configuration to apply.
     */
    updateLLMConfig(newLLMConfig: Partial<AgentConfig['llm']>): void {
        logger.debug('Updating LLM configuration...');

        if (!this.resolved.llm) {
            throw new Error('LLM config is not initialized');
        }

        // Merge the new config with existing config
        this.resolved.llm = { ...this.resolved.llm, ...newLLMConfig };

        // Update provenance for any fields that were changed
        // Only update provenance for keys that are actually tracked in LLMProvenance
        Object.keys(newLLMConfig).forEach((key) => {
            if (this.isTrackableKey(key)) {
                this.provenance.llm[key] = 'runtime';
            }
        });

        // Validate the updated configuration
        this.validate();
        logger.debug('LLM configuration updated successfully');
    }

    /**
     * Adds or updates an MCP server configuration.
     * @param serverName The name of the MCP server.
     * @param serverConfig The server configuration.
     */
    addMcpServer(serverName: string, serverConfig: AgentConfig['mcpServers'][string]): void {
        logger.debug(`Adding/updating MCP server: ${serverName}`);

        if (!this.resolved.mcpServers) {
            this.resolved.mcpServers = {};
        }

        this.resolved.mcpServers[serverName] = serverConfig;

        // Validate the updated configuration
        this.validate();
        logger.debug(`MCP server '${serverName}' added/updated successfully`);
    }

    /**
     * Removes an MCP server configuration.
     * @param serverName The name of the MCP server to remove.
     */
    removeMcpServer(serverName: string): void {
        logger.debug(`Removing MCP server: ${serverName}`);

        if (this.resolved.mcpServers && this.resolved.mcpServers[serverName]) {
            delete this.resolved.mcpServers[serverName];
            logger.debug(`MCP server '${serverName}' removed successfully`);
        } else {
            logger.warn(`MCP server '${serverName}' not found for removal`);
        }
    }

    /** Pretty-print the resolved config and provenance */
    print(): void {
        logger.info('Resolved configuration (current state):');
        logger.info(JSON.stringify(this.resolved, null, 2));
        logger.info('Configuration sources (LLM):');
        for (const [field, src] of Object.entries(this.provenance?.llm ?? {})) {
            logger.info(`  • ${field}: ${src}`);
        }
    }

    /**
     * Type guard to check if a key is trackable in LLM provenance.
     * @param key The key to check.
     * @returns True if the key is a valid LLMOverrideKey that can be tracked in provenance.
     */
    private isTrackableKey(key: string): key is LLMOverrideKey {
        const trackableKeys: LLMOverrideKey[] = ['provider', 'model', 'router', 'apiKey'];
        return trackableKeys.includes(key as LLMOverrideKey);
    }

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
    validate(): void {
        try {
            // Parse the entire resolved config. This will validate the entire agent config.
            // The parsed result will be strictly typed and will have stripped any unknown keys (by default).
            this.resolved = AgentConfigSchema.parse(this.resolved);
            logger.debug('Agent configuration validation successful', 'green');
        } catch (err) {
            this.printStateForError('Validation failed for agent configuration');
            this.handleZodError(err, 'agent');
        }
    }
}
