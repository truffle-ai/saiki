import { z } from 'zod';
import { logger } from '../logger/index.js';
import { AgentConfigSchema } from './schemas.js';
import type { ValidatedAgentConfig, AgentConfig } from './schemas.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import * as YAML from 'yaml';

/**
 * ConfigManager: Handles pure configuration validation and access for the core layer.
 *
 * This class manages configuration that is already processed and focuses purely on
 * validation and read-only access to configuration.
 *
 * **What this handles:**
 * - Configuration validation using Zod schemas
 * - Read-only access to processed configuration
 * - Schema default application
 * - Immutability protection
 *
 * **What this does NOT handle (moved to app layer):**
 * - CLI argument processing
 * - Configuration merging logic
 */
export class ConfigManager {
    private readonly config: ValidatedAgentConfig;

    constructor(config: AgentConfig) {
        logger.debug('Loading agent configuration...');

        // Validate and apply schema defaults
        const validatedConfig = this.validateAndApplyDefaults(config);

        // Store immutable config
        this.config = Object.freeze(validatedConfig);

        logger.info('Agent configuration loaded and validated.');
    }

    /**
     * Validates the configuration against the schema and applies defaults.
     * @param config Raw configuration object
     * @returns Validated configuration with defaults applied
     */
    private validateAndApplyDefaults(config: AgentConfig): ValidatedAgentConfig {
        try {
            logger.debug('Agent configuration validation successful');
            return AgentConfigSchema.parse(config);
        } catch (error) {
            logger.error('Validation failed for agent configuration');

            if (error instanceof z.ZodError) {
                const issues = error.issues
                    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                    .join(', ');
                throw new Error(`Configuration validation failed: ${issues}`);
            }
            throw error;
        }
    }

    /**
     * Gets the validated configuration (read-only).
     * @returns Immutable configuration object
     */
    public getConfig(): Readonly<ValidatedAgentConfig> {
        return this.config;
    }
}

/**
 * Configuration Manager
 *
 * Handles saving, loading, and managing multiple agent configurations.
 * Provides functionality to create, store, and retrieve different agent setups.
 */

export interface SavedConfiguration {
    /** Unique identifier for the configuration */
    id: string;
    /** Display name for the configuration */
    name: string;
    /** Description of what this configuration does */
    description: string;
    /** When this configuration was created */
    createdAt: string;
    /** When this configuration was last modified */
    updatedAt: string;
    /** The agent configuration */
    config: AgentConfig;
    /** Tags for organizing configurations */
    tags: string[];
}

export interface ConfigurationManifest {
    /** Version of the manifest format */
    version: string;
    /** Map of configuration ID to metadata */
    configurations: Record<string, Omit<SavedConfiguration, 'config'>>;
}

/**
 * Configuration Manager for handling saved agent configurations
 */
export class ConfigurationManager {
    private configsDir: string;
    private manifestPath: string;

    constructor(configsDir?: string) {
        this.configsDir = configsDir || path.join(os.homedir(), '.saiki', 'configurations');
        this.manifestPath = path.join(this.configsDir, 'manifest.json');
    }

    /**
     * Initialize the configuration directory structure
     */
    async initialize(): Promise<void> {
        try {
            await fs.mkdir(this.configsDir, { recursive: true });

            // Create manifest if it doesn't exist
            try {
                await fs.access(this.manifestPath);
            } catch {
                await this.createManifest();
            }
        } catch (error) {
            logger.error(`Failed to initialize configuration manager: ${error}`);
            throw error;
        }
    }

    /**
     * Create a new manifest file
     */
    private async createManifest(): Promise<void> {
        const manifest: ConfigurationManifest = {
            version: '1.0.0',
            configurations: {},
        };
        await fs.writeFile(this.manifestPath, JSON.stringify(manifest, null, 2));
    }

    /**
     * Load the manifest file
     */
    private async loadManifest(): Promise<ConfigurationManifest> {
        try {
            const content = await fs.readFile(this.manifestPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            logger.warn(`Failed to load manifest, creating new one: ${error}`);
            await this.createManifest();
            return { version: '1.0.0', configurations: {} };
        }
    }

    /**
     * Save the manifest file
     */
    private async saveManifest(manifest: ConfigurationManifest): Promise<void> {
        await fs.writeFile(this.manifestPath, JSON.stringify(manifest, null, 2));
    }

    /**
     * Generate a unique ID for a configuration
     */
    private generateId(name: string): string {
        const base = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const timestamp = Date.now().toString(36);
        return `${base}-${timestamp}`;
    }

    /**
     * Save a new configuration
     */
    async saveConfiguration(
        name: string,
        description: string,
        config: AgentConfig,
        tags: string[] = []
    ): Promise<string> {
        await this.initialize();

        const id = this.generateId(name);
        const now = new Date().toISOString();
        const configPath = path.join(this.configsDir, `${id}.yml`);

        // Save the YAML configuration file
        const yamlContent = YAML.stringify(config, { lineWidth: -1 });
        await fs.writeFile(configPath, yamlContent);

        // Update manifest
        const manifest = await this.loadManifest();
        manifest.configurations[id] = {
            id,
            name,
            description,
            createdAt: now,
            updatedAt: now,
            tags,
        };
        await this.saveManifest(manifest);

        logger.info(`Configuration '${name}' saved with ID: ${id}`);
        return id;
    }

    /**
     * Load a configuration by ID
     */
    async loadConfiguration(id: string): Promise<SavedConfiguration | null> {
        await this.initialize();

        const manifest = await this.loadManifest();
        const configMeta = manifest.configurations[id];

        if (!configMeta) {
            return null;
        }

        const configPath = path.join(this.configsDir, `${id}.yml`);

        try {
            const yamlContent = await fs.readFile(configPath, 'utf-8');
            const config = YAML.parse(yamlContent) as AgentConfig;

            return {
                ...configMeta,
                config,
            };
        } catch (error) {
            logger.error(`Failed to load configuration ${id}: ${error}`);
            return null;
        }
    }

    /**
     * List all saved configurations
     */
    async listConfigurations(): Promise<Omit<SavedConfiguration, 'config'>[]> {
        await this.initialize();

        const manifest = await this.loadManifest();
        return Object.values(manifest.configurations).sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    }

    /**
     * Update an existing configuration
     */
    async updateConfiguration(
        id: string,
        updates: Partial<Pick<SavedConfiguration, 'name' | 'description' | 'config' | 'tags'>>
    ): Promise<boolean> {
        await this.initialize();

        const existing = await this.loadConfiguration(id);
        if (!existing) {
            return false;
        }

        const now = new Date().toISOString();
        const updated: SavedConfiguration = {
            ...existing,
            ...updates,
            updatedAt: now,
        };

        // Save the YAML configuration file if config was updated
        if (updates.config) {
            const configPath = path.join(this.configsDir, `${id}.yml`);
            const yamlContent = YAML.stringify(updated.config, { lineWidth: -1 });
            await fs.writeFile(configPath, yamlContent);
        }

        // Update manifest
        const manifest = await this.loadManifest();
        manifest.configurations[id] = {
            id: updated.id,
            name: updated.name,
            description: updated.description,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
            tags: updated.tags,
        };
        await this.saveManifest(manifest);

        logger.info(`Configuration '${updated.name}' updated`);
        return true;
    }

    /**
     * Delete a configuration
     */
    async deleteConfiguration(id: string): Promise<boolean> {
        await this.initialize();

        const manifest = await this.loadManifest();
        const configMeta = manifest.configurations[id];

        if (!configMeta) {
            return false;
        }

        const configPath = path.join(this.configsDir, `${id}.yml`);

        try {
            // Remove the YAML file
            await fs.unlink(configPath);

            // Update manifest
            delete manifest.configurations[id];
            await this.saveManifest(manifest);

            logger.info(`Configuration '${configMeta.name}' deleted`);
            return true;
        } catch (error) {
            logger.error(`Failed to delete configuration ${id}: ${error}`);
            return false;
        }
    }

    /**
     * Search configurations by name, description, or tags
     */
    async searchConfigurations(query: string): Promise<Omit<SavedConfiguration, 'config'>[]> {
        const configurations = await this.listConfigurations();
        const lowercaseQuery = query.toLowerCase();

        return configurations.filter(
            (config) =>
                config.name.toLowerCase().includes(lowercaseQuery) ||
                config.description.toLowerCase().includes(lowercaseQuery) ||
                config.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery))
        );
    }

    /**
     * Get configurations by tags
     */
    async getConfigurationsByTags(tags: string[]): Promise<Omit<SavedConfiguration, 'config'>[]> {
        const configurations = await this.listConfigurations();
        return configurations.filter((config) => tags.some((tag) => config.tags.includes(tag)));
    }

    /**
     * Export a configuration to a file
     */
    async exportConfiguration(id: string, targetPath: string): Promise<boolean> {
        const config = await this.loadConfiguration(id);
        if (!config) {
            return false;
        }

        try {
            const yamlContent = YAML.stringify(config.config, { lineWidth: -1 });
            await fs.writeFile(targetPath, yamlContent);
            logger.info(`Configuration '${config.name}' exported to ${targetPath}`);
            return true;
        } catch (error) {
            logger.error(`Failed to export configuration: ${error}`);
            return false;
        }
    }

    /**
     * Import a configuration from a file
     */
    async importConfiguration(
        filePath: string,
        name: string,
        description: string,
        tags: string[] = []
    ): Promise<string | null> {
        try {
            const yamlContent = await fs.readFile(filePath, 'utf-8');
            const config = YAML.parse(yamlContent) as AgentConfig;

            return await this.saveConfiguration(name, description, config, tags);
        } catch (error) {
            logger.error(`Failed to import configuration: ${error}`);
            return null;
        }
    }

    /**
     * Get the configuration directory path
     */
    getConfigurationDirectory(): string {
        return this.configsDir;
    }
}
