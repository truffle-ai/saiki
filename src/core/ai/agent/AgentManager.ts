import { SaikiAgent } from './SaikiAgent.js';
import { loadConfigFile } from '../../config/loader.js';
import { stringify as yamlStringify, parseDocument } from 'yaml';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../logger/index.js';
import type { AgentConfig } from '../../config/schemas.js';
import type { CLIConfigOverrides } from '../../config/types.js';
import type { InitializeServicesOptions } from '../../utils/service-initializer.js';

/**
 * AgentManager handles the lifecycle and configuration management of SaikiAgent instances.
 * This includes saving, loading, importing, and exporting agent configurations.
 */
export class AgentManager {
    private currentAgent: SaikiAgent | null = null;
    private configsDirectory: string;

    constructor(configsDirectory: string = './saved-configs') {
        this.configsDirectory = configsDirectory;
    }

    /**
     * Gets the current active agent instance.
     */
    getCurrentAgent(): SaikiAgent | null {
        return this.currentAgent;
    }

    /**
     * Creates and sets a new agent instance from a configuration.
     * @param config The agent configuration.
     * @param cliArgs Optional CLI config overrides.
     * @param overrides Optional service overrides.
     * @returns The created agent instance.
     */
    async createAgent(
        config: AgentConfig,
        cliArgs?: CLIConfigOverrides,
        overrides?: InitializeServicesOptions
    ): Promise<SaikiAgent> {
        const { createSaikiAgent } = await import('./SaikiAgent.js');
        const agent = await createSaikiAgent(config, cliArgs, overrides);
        this.currentAgent = agent;

        logger.info('AgentManager: New agent instance created and set as current');
        return agent;
    }

    /**
     * Loads an agent from a configuration file.
     * @param configPath The path to the configuration file.
     * @param cliArgs Optional CLI config overrides.
     * @param overrides Optional service overrides.
     * @returns The created agent instance.
     */
    async loadAgentFromFile(
        configPath: string,
        cliArgs?: CLIConfigOverrides,
        overrides?: InitializeServicesOptions
    ): Promise<SaikiAgent> {
        try {
            // Verify file exists
            await fs.access(configPath);

            // Load and validate the config
            const config = await loadConfigFile(configPath);

            // Create new agent instance
            const agent = await this.createAgent(config, cliArgs, overrides);

            logger.info(`AgentManager: Agent loaded from ${configPath}`);

            // Emit event
            agent.agentEventBus.emit('saiki:agentLoaded', {
                configPath,
                timestamp: new Date().toISOString(),
            });

            return agent;
        } catch (error) {
            logger.error('Error during AgentManager.loadAgentFromFile:', error);
            throw error;
        }
    }

    /**
     * Switches the current agent to use a new configuration while preserving conversation history.
     * @param newConfig The new configuration to apply.
     * @param preserveConversation Whether to preserve conversation history.
     */
    async switchAgentConfig(
        newConfig: AgentConfig,
        preserveConversation: boolean = true
    ): Promise<void> {
        if (!this.currentAgent) {
            throw new Error('No current agent to switch configuration for');
        }

        try {
            // Store current conversation state if preserving
            const currentMessages = preserveConversation
                ? this.currentAgent.messageManager.getHistory()
                : [];

            // Apply new config to ConfigManager
            this.currentAgent.configManager.initFromConfig(newConfig);

            // Reinitialize LLM service with new config
            const { createLLMService } = await import('../llm/services/factory.js');
            const newLLMService = createLLMService(
                newConfig.llm,
                newConfig.llm.router || 'in-built',
                this.currentAgent.clientManager,
                this.currentAgent.agentEventBus,
                this.currentAgent.messageManager // This preserves conversation history
            );

            // Replace the LLM service
            (this.currentAgent as any).llmService = newLLMService;

            // Reconnect MCP servers
            await this.reconnectMcpServers(this.currentAgent, newConfig);

            logger.info('AgentManager: Agent configuration switched successfully');

            // Emit comprehensive event
            this.currentAgent.agentEventBus.emit('saiki:configApplied', {
                newConfig,
                messagesRetained: currentMessages.length,
                serversReconnected: true,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            logger.error('Error during AgentManager.switchAgentConfig:', error);
            throw error;
        }
    }

    // === CONFIGURATION FILE MANAGEMENT ===

    /**
     * Saves the current agent's configuration to a named file.
     * @param name The name for the configuration.
     * @param description Optional description for the configuration.
     * @returns Information about the saved configuration.
     */
    async saveConfig(
        name: string,
        description?: string
    ): Promise<{
        filename: string;
        path: string;
        name: string;
        description: string;
    }> {
        if (!this.currentAgent) {
            throw new Error('No current agent to save configuration for');
        }

        try {
            if (!name || typeof name !== 'string' || name.trim() === '') {
                throw new Error('Config name is required');
            }

            const sanitizedName = name.trim().replace(/[^a-zA-Z0-9-_]/g, '-');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${sanitizedName}-${timestamp}.yml`;

            // Get current config and add metadata
            const currentConfig = this.currentAgent.configManager.getConfig();
            const configWithMeta = {
                ...currentConfig,
                _metadata: {
                    name,
                    description: description || '',
                    savedAt: new Date().toISOString(),
                    version: '1.0.0',
                },
            };

            // Sanitize sensitive data before saving
            const exportConfig = this.sanitizeConfig(configWithMeta);

            // Ensure configs directory exists
            await fs.mkdir(this.configsDirectory, { recursive: true });
            const filePath = path.join(this.configsDirectory, filename);

            // Write config file
            const yamlContent = yamlStringify(exportConfig);
            await fs.writeFile(filePath, yamlContent, 'utf-8');

            logger.info(`AgentManager: Saved config '${name}' to ${filePath}`);

            // Emit event
            this.currentAgent.agentEventBus.emit('saiki:configSaved', {
                name,
                filename,
                path: filePath,
                timestamp: new Date().toISOString(),
            });

            return {
                filename,
                path: filePath,
                name,
                description: description || '',
            };
        } catch (error) {
            logger.error('Error during AgentManager.saveConfig:', error);
            throw error;
        }
    }

    /**
     * Lists all saved configurations.
     * @returns Array of saved configuration metadata.
     */
    async listSavedConfigs(): Promise<
        Array<{
            id: string;
            filename: string;
            name: string;
            description: string;
            savedAt: string;
            size: number;
            path: string;
        }>
    > {
        try {
            try {
                const files = await fs.readdir(this.configsDirectory);
                const yamlFiles = files.filter(
                    (file) => file.endsWith('.yml') || file.endsWith('.yaml')
                );

                const configs = await Promise.all(
                    yamlFiles.map(async (file) => {
                        try {
                            const filePath = path.join(this.configsDirectory, file);
                            const content = await fs.readFile(filePath, 'utf-8');
                            const doc = parseDocument(content);
                            const metadata = (doc.get('_metadata') as any) || {};

                            const stats = await fs.stat(filePath);

                            return {
                                id: file.replace(/\.(yml|yaml)$/, ''),
                                filename: file,
                                name: metadata.name || file.replace(/\.(yml|yaml)$/, ''),
                                description: metadata.description || '',
                                savedAt: metadata.savedAt || stats.mtime.toISOString(),
                                size: stats.size,
                                path: filePath,
                            };
                        } catch (err: any) {
                            logger.warn(`Failed to read config file ${file}: ${err.message}`);
                            return null;
                        }
                    })
                );

                const validConfigs = configs
                    .filter(Boolean)
                    .sort(
                        (a, b) => new Date(b!.savedAt).getTime() - new Date(a!.savedAt).getTime()
                    );

                return validConfigs as Array<{
                    id: string;
                    filename: string;
                    name: string;
                    description: string;
                    savedAt: string;
                    size: number;
                    path: string;
                }>;
            } catch (err) {
                // Configs directory doesn't exist
                return [];
            }
        } catch (error) {
            logger.error('Error during AgentManager.listSavedConfigs:', error);
            throw error;
        }
    }

    /**
     * Loads a saved configuration and switches the current agent to use it.
     * @param filename The filename of the saved configuration.
     * @param preserveConversation Whether to preserve the current conversation history.
     */
    async loadSavedConfig(filename: string, preserveConversation: boolean = true): Promise<void> {
        if (!this.currentAgent) {
            throw new Error('No current agent to load configuration for');
        }

        try {
            const filePath = path.join(this.configsDirectory, filename);

            // Verify file exists
            await fs.access(filePath);

            // Load and validate the config
            const newConfig = await loadConfigFile(filePath);

            // Switch to the new configuration
            await this.switchAgentConfig(newConfig, preserveConversation);

            logger.info(`AgentManager: Loaded and applied config from ${filePath}`);

            // Emit event
            this.currentAgent.agentEventBus.emit('saiki:configLoaded', {
                filename,
                preserveConversation,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            logger.error('Error during AgentManager.loadSavedConfig:', error);
            throw error;
        }
    }

    /**
     * Imports and applies a configuration from raw config data.
     * @param configData The configuration data (object or string).
     * @param preserveConversation Whether to preserve the current conversation history.
     */
    async importConfig(
        configData: any | string,
        preserveConversation: boolean = true
    ): Promise<void> {
        if (!this.currentAgent) {
            throw new Error('No current agent to import configuration for');
        }

        try {
            let parsedConfig: any;

            // Parse the config data if it's a string
            if (typeof configData === 'string') {
                try {
                    // Try YAML first
                    const { parse: parseYaml } = await import('yaml');
                    parsedConfig = parseYaml(configData);
                } catch {
                    try {
                        // Fall back to JSON
                        parsedConfig = JSON.parse(configData);
                    } catch {
                        throw new Error('Invalid YAML or JSON format');
                    }
                }
            } else {
                parsedConfig = configData;
            }

            // Validate against schema
            const { AgentConfigSchema } = await import('../../config/schemas.js');
            const validatedConfig = AgentConfigSchema.parse(parsedConfig);

            // Switch to the imported configuration
            await this.switchAgentConfig(validatedConfig, preserveConversation);

            logger.info('AgentManager: Imported and applied configuration successfully');

            // Emit event
            this.currentAgent.agentEventBus.emit('saiki:configImported', {
                preserveConversation,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            logger.error('Error during AgentManager.importConfig:', error);
            throw error;
        }
    }

    /**
     * Deletes a saved configuration file.
     * @param filename The filename of the configuration to delete.
     */
    async deleteConfig(filename: string): Promise<void> {
        try {
            const filePath = path.join(this.configsDirectory, filename);

            // Verify file exists
            try {
                await fs.access(filePath);
            } catch {
                throw new Error(`Configuration file not found: ${filename}`);
            }

            // Delete the file
            await fs.unlink(filePath);

            logger.info(`AgentManager: Deleted saved config: ${filePath}`);

            // Emit event if we have a current agent
            if (this.currentAgent) {
                this.currentAgent.agentEventBus.emit('saiki:configDeleted', {
                    filename,
                    timestamp: new Date().toISOString(),
                });
            }
        } catch (error) {
            logger.error('Error during AgentManager.deleteConfig:', error);
            throw error;
        }
    }

    /**
     * Exports the current agent's configuration with optional sanitization.
     * @param sanitize Whether to remove sensitive data like API keys.
     * @returns The current configuration object.
     */
    exportConfig(sanitize: boolean = true): AgentConfig {
        if (!this.currentAgent) {
            throw new Error('No current agent to export configuration for');
        }

        try {
            const config = this.currentAgent.configManager.getConfig();

            if (!sanitize) {
                return config;
            }

            return this.sanitizeConfig(config);
        } catch (error) {
            logger.error('Error during AgentManager.exportConfig:', error);
            throw error;
        }
    }

    /**
     * Gets configuration metadata including provenance and statistics.
     * @returns Configuration metadata and statistics.
     */
    getConfigMetadata() {
        if (!this.currentAgent) {
            throw new Error('No current agent to get metadata for');
        }

        try {
            const config = this.currentAgent.configManager.getConfig();
            const provenance = this.currentAgent.configManager.getProvenance();
            const connectedServers = this.currentAgent.clientManager.getClients();
            const failedConnections = this.currentAgent.clientManager.getFailedConnections();

            return {
                provenance,
                statistics: {
                    mcpServersConfigured: Object.keys(config.mcpServers || {}).length,
                    mcpServersConnected: connectedServers.size,
                    mcpServersFailed: Object.keys(failedConnections).length,
                    llmProvider: config.llm?.provider,
                    llmModel: config.llm?.model,
                    conversationLength: this.currentAgent.messageManager.getHistory().length,
                },
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            logger.error('Error during AgentManager.getConfigMetadata:', error);
            throw error;
        }
    }

    // === PRIVATE HELPER METHODS ===

    /**
     * Reconnects MCP servers based on the new configuration.
     * @param agent The agent instance to reconnect servers for.
     * @param newConfig The new configuration containing MCP server settings.
     */
    private async reconnectMcpServers(agent: SaikiAgent, newConfig: AgentConfig): Promise<void> {
        try {
            // Get current connected servers
            const currentServers = new Set(agent.clientManager.getClients().keys());
            const newServers = new Set(Object.keys(newConfig.mcpServers || {}));

            // Disconnect servers that are no longer in the config
            for (const serverName of currentServers) {
                if (!newServers.has(serverName)) {
                    logger.info(
                        `AgentManager: Disconnecting server '${serverName}' (not in new config)`
                    );
                    try {
                        await agent.clientManager.removeClient(serverName);
                    } catch (error: any) {
                        logger.warn(
                            `Failed to disconnect server '${serverName}': ${error.message}`
                        );
                    }
                }
            }

            // Connect new servers or update existing ones
            for (const [serverName, serverConfig] of Object.entries(newConfig.mcpServers || {})) {
                try {
                    // Disconnect first if already connected (to apply any config changes)
                    if (currentServers.has(serverName)) {
                        logger.info(
                            `AgentManager: Reconnecting server '${serverName}' with new config`
                        );
                        await agent.clientManager.removeClient(serverName);
                    }

                    // Connect the server with new config
                    await agent.connectMcpServer(serverName, serverConfig as any);
                    logger.info(`AgentManager: Connected server '${serverName}'`);
                } catch (error: any) {
                    logger.error(`Failed to connect server '${serverName}': ${error.message}`);
                    // Continue with other servers even if one fails
                }
            }

            logger.info('AgentManager: MCP server reconnection completed');
        } catch (error) {
            logger.error('Error during MCP server reconnection:', error);
            throw error;
        }
    }

    /**
     * Sanitizes a configuration object by removing sensitive data.
     * @param config The configuration to sanitize.
     * @returns The sanitized configuration.
     */
    private sanitizeConfig(config: any): any {
        // Deep clone
        const sanitized = JSON.parse(JSON.stringify(config));

        // Remove LLM API key
        if (sanitized.llm && 'apiKey' in sanitized.llm) {
            sanitized.llm.apiKey = 'SET_YOUR_API_KEY_HERE';
        }

        // Remove sensitive fields from MCP servers
        if (sanitized.mcpServers) {
            for (const serverName in sanitized.mcpServers) {
                const server = sanitized.mcpServers[serverName];
                if (server.env) {
                    for (const envKey in server.env) {
                        if (
                            envKey.toLowerCase().includes('key') ||
                            envKey.toLowerCase().includes('token') ||
                            envKey.toLowerCase().includes('secret')
                        ) {
                            server.env[envKey] = 'SET_YOUR_' + envKey + '_HERE';
                        }
                    }
                }
            }
        }

        return sanitized;
    }
}
