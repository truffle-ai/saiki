import { logger } from '../logger/index.js';
import type {
    ValidatedAgentConfig,
    ValidatedLLMConfig,
    McpServerConfig,
    ValidatedMcpServerConfig,
} from './schemas.js';
import type { AgentEventBus } from '../events/index.js';
import { validateMcpServerConfig, type McpServerContext } from './validation-utils.js';
import { Result, ok, Issue } from '../utils/result.js';

/**
 * Session-specific overrides that can differ from the global configuration
 */
export interface SessionOverride {
    /** Override LLM config for this session */
    llm?: Partial<ValidatedLLMConfig>;
}

/**
 * Manages the runtime configuration of the agent.
 *
 * This class handles dynamic configuration changes that occur during agent execution.
 *
 * Key responsibilities:
 * 1. Track runtime changes separate from static config baseline
 * 2. Support session-specific overrides for LLM settings
 * 3. Dynamic MCP server management (add/remove servers at runtime)
 * 4. Export modified state back to config format
 * 5. Provide change tracking and validation capabilities
 * 6. Maintain effective configuration for each session
 */
export class AgentStateManager {
    private runtimeConfig: ValidatedAgentConfig;
    private readonly baselineConfig: ValidatedAgentConfig;
    private sessionOverrides: Map<string, SessionOverride> = new Map();

    /**
     * Initialize AgentStateManager from a processed static configuration.
     *
     * @param staticConfig The processed configuration from ConfigManager
     * @param agentEventBus The agent event bus for emitting state change events
     */
    constructor(
        staticConfig: ValidatedAgentConfig,
        private agentEventBus: AgentEventBus
    ) {
        this.baselineConfig = structuredClone(staticConfig);
        this.runtimeConfig = structuredClone(staticConfig);

        logger.debug('AgentStateManager initialized', {
            staticConfigKeys: Object.keys(this.baselineConfig),
            mcpServerCount: Object.keys(this.runtimeConfig.mcpServers).length,
        });
    }

    // ============= GETTERS =============

    /**
     * Get runtime configuration for a session (includes session overrides if sessionId provided)
     */
    public getRuntimeConfig(sessionId?: string): Readonly<ValidatedAgentConfig> {
        if (!sessionId) {
            return structuredClone(this.runtimeConfig);
        }

        const override = this.sessionOverrides.get(sessionId);
        if (!override) {
            return structuredClone(this.runtimeConfig);
        }

        return {
            ...this.runtimeConfig,
            llm: { ...this.runtimeConfig.llm, ...override.llm },
        };
    }

    // ============= LLM CONFIGURATION =============

    /**
     * Update the LLM configuration (globally or for a specific session)
     */
    public updateLLM(newConfig: Partial<ValidatedLLMConfig>, sessionId?: string): Result<void> {
        // Build the new effective config for validation
        const currentConfig = sessionId ? this.getRuntimeConfig(sessionId) : this.runtimeConfig;
        const _updatedConfig: ValidatedAgentConfig = {
            ...currentConfig,
            llm: { ...currentConfig.llm, ...newConfig },
        };

        // No additional validation needed - buildLLMConfig() already validated the LLM section
        // and we're just merging it with the existing valid config

        const oldValue = sessionId ? this.getRuntimeConfig(sessionId).llm : this.runtimeConfig.llm;

        if (sessionId) {
            this.setSessionOverride(sessionId, {
                llm: { ...this.getSessionOverride(sessionId)?.llm, ...newConfig },
            });
        } else {
            this.runtimeConfig.llm = { ...this.runtimeConfig.llm, ...newConfig };
        }

        this.agentEventBus.emit('saiki:stateChanged', {
            field: 'llm',
            oldValue,
            newValue: sessionId ? this.getRuntimeConfig(sessionId).llm : this.runtimeConfig.llm,
            sessionId,
        });

        logger.info('LLM config updated', {
            sessionId,
            updatedFields: Object.keys(newConfig),
            isSessionSpecific: !!sessionId,
        });

        return ok(undefined);
    }

    // ============= MCP SERVER MANAGEMENT =============

    /**
     * Add or update an MCP server configuration at runtime.
     */
    public addMcpServer(
        serverName: string,
        serverConfig: McpServerConfig
    ): Result<ValidatedMcpServerConfig, McpServerContext> {
        logger.debug(`Adding/updating MCP server: ${serverName}`);

        // Validate the server configuration
        const existingServerNames = Object.keys(this.runtimeConfig.mcpServers);
        const validation = validateMcpServerConfig(serverName, serverConfig, existingServerNames);

        if (!validation.ok) {
            logger.warn('MCP server configuration validation failed', {
                serverName,
                errors: validation.issues
                    .filter((i) => i.severity !== 'warning')
                    .map((e: Issue<McpServerContext>) => e.message),
                warnings: validation.issues
                    .filter((i) => i.severity === 'warning')
                    .map((e: Issue<McpServerContext>) => e.message),
            });
            return validation;
        }

        // Log warnings if any
        const warnings = validation.issues
            .filter((i) => i.severity === 'warning')
            .map((e: Issue<McpServerContext>) => e.message);
        if (warnings.length > 0) {
            logger.warn('MCP server configuration warnings', {
                serverName,
                warnings,
            });
        }

        const isUpdate = serverName in this.runtimeConfig.mcpServers;
        // Use the validated config with defaults applied from validation result
        this.runtimeConfig.mcpServers[serverName] = validation.data!;

        const eventName = isUpdate ? 'saiki:mcpServerUpdated' : 'saiki:mcpServerAdded';
        this.agentEventBus.emit(eventName, { serverName, config: serverConfig });

        this.agentEventBus.emit('saiki:stateChanged', {
            field: 'mcpServers',
            oldValue: isUpdate ? 'updated' : 'added',
            newValue: serverConfig,
            sessionId: undefined, // MCP servers are global
        });

        logger.info(`MCP server '${serverName}' ${isUpdate ? 'updated' : 'added'} successfully`);

        return validation;
    }

    /**
     * Remove an MCP server configuration at runtime.
     */
    public removeMcpServer(serverName: string): void {
        logger.debug(`Removing MCP server: ${serverName}`);

        if (serverName in this.runtimeConfig.mcpServers) {
            delete this.runtimeConfig.mcpServers[serverName];

            this.agentEventBus.emit('saiki:mcpServerRemoved', { serverName });
            this.agentEventBus.emit('saiki:stateChanged', {
                field: 'mcpServers',
                oldValue: 'removed',
                newValue: undefined,
                sessionId: undefined, // MCP servers are global
            });

            logger.info(`MCP server '${serverName}' removed successfully`);
        } else {
            logger.warn(`MCP server '${serverName}' not found for removal`);
        }
    }

    // ============= SESSION MANAGEMENT =============

    /**
     * Set a session-specific override
     */
    private setSessionOverride(sessionId: string, partial: Partial<SessionOverride>): void {
        const existing = this.sessionOverrides.get(sessionId);
        const override: SessionOverride = {
            llm: { ...existing?.llm, ...partial.llm },
        };

        this.sessionOverrides.set(sessionId, override);
        this.agentEventBus.emit('saiki:sessionOverrideSet', {
            sessionId,
            override: structuredClone(override),
        });
    }

    /**
     * Get a session override (internal helper)
     */
    private getSessionOverride(sessionId: string): SessionOverride | undefined {
        return this.sessionOverrides.get(sessionId);
    }

    /**
     * Clear session-specific overrides
     */
    public clearSessionOverride(sessionId: string): void {
        const hadOverride = this.sessionOverrides.has(sessionId);
        this.sessionOverrides.delete(sessionId);

        if (hadOverride) {
            this.agentEventBus.emit('saiki:sessionOverrideCleared', { sessionId });
            logger.info('Session override cleared', { sessionId });
        }
    }

    /**
     * Clear all session overrides (private helper for resetToBaseline)
     */
    private clearAllSessionOverrides(): void {
        const sessionIds = Array.from(this.sessionOverrides.keys());
        this.sessionOverrides.clear();

        sessionIds.forEach((sessionId) => {
            this.agentEventBus.emit('saiki:sessionOverrideCleared', { sessionId });
        });

        if (sessionIds.length > 0) {
            logger.info('All session overrides cleared', { clearedSessions: sessionIds });
        }
    }

    // ============= CONFIG EXPORT =============

    /**
     * Export current runtime state as config.
     * This allows users to save their runtime modifications as a new agent config.
     */
    public exportAsConfig(): ValidatedAgentConfig {
        const exportedConfig: ValidatedAgentConfig = {
            ...this.baselineConfig,
            llm: structuredClone(this.runtimeConfig.llm),
            systemPrompt: this.runtimeConfig.systemPrompt,
            mcpServers: structuredClone(this.runtimeConfig.mcpServers),
        };

        this.agentEventBus.emit('saiki:stateExported', { config: exportedConfig });

        logger.info('Runtime state exported as config', {
            exportedConfig,
        });

        return exportedConfig;
    }

    /**
     * Reset runtime state back to baseline configuration
     */
    public resetToBaseline(): void {
        this.runtimeConfig = structuredClone(this.baselineConfig);

        this.clearAllSessionOverrides();
        this.agentEventBus.emit('saiki:stateReset', { toConfig: this.baselineConfig });

        logger.info('Runtime state reset to baseline config');
    }

    // ============= CONVENIENCE GETTERS FOR USED FUNCTIONALITY =============

    /**
     * Get the current effective LLM configuration for a session.
     * **Use this for session-specific LLM config** (includes session overrides).
     */
    public getLLMConfig(sessionId?: string): Readonly<ValidatedLLMConfig> {
        return this.getRuntimeConfig(sessionId).llm;
    }
}
