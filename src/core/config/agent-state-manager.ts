import { logger } from '../logger/index.js';
import type { AgentConfig, LLMConfig, McpServerConfig } from './schemas.js';
import type { AgentEventBus } from '../events/index.js';
import {
    validateRuntimeUpdate,
    validateRuntimeState,
    validateMcpServerConfig,
    type ValidationResult,
    type ValidationError,
} from './validation-utils.js';

/**
 * Runtime state for the agent - only includes things that should change during execution.
 * This represents the current effective configuration, separate from the static baseline.
 */
export interface AgentRuntimeState {
    /** Current LLM configuration (includes model, provider, systemPrompt, router, etc.) */
    llm: LLMConfig;

    /** Current MCP server configurations (can be added/removed at runtime) */
    mcpServers: Record<string, McpServerConfig>;

    /** Runtime environment settings */
    runtime: {
        /** Whether debug mode is enabled */
        debugMode: boolean;
        /** Current log level */
        logLevel: string;
    };

    /** Timestamp when state was last modified */
    lastModified: Date;
}

/**
 * Session-specific overrides that can differ from the global runtime state
 */
export interface SessionOverride {
    /** Override LLM config for this session */
    llm?: Partial<LLMConfig>;
    /** Override runtime settings for this session */
    runtime?: Partial<AgentRuntimeState['runtime']>;
    /** When this override was created/updated */
    lastModified: Date;
}

/**
 * Manages the runtime state of the agent.
 *
 * This class handles dynamic configuration changes that occur during agent execution,
 * while StaticConfigManager handles the initial configuration loading and CLI overrides.
 *
 * Key responsibilities:
 * 1. Track runtime changes separate from static config baseline
 * 2. Support session-specific overrides for LLM and runtime settings
 * 3. Dynamic MCP server management (add/remove servers at runtime)
 * 4. Export modified state back to config format for AI Agent Builder
 * 5. Provide change tracking and validation capabilities
 * 6. Maintain effective configuration for each session
 */
export class AgentStateManager {
    private runtimeState: AgentRuntimeState;
    private readonly baselineConfig: AgentConfig;
    private sessionOverrides: Map<string, SessionOverride> = new Map();

    /**
     * Initialize AgentStateManager from a processed static configuration.
     *
     * @param staticConfig The processed configuration from StaticConfigManager
     * @param agentEventBus The agent event bus for emitting state change events
     * @param initialSettings Optional runtime settings to apply immediately
     */
    constructor(
        staticConfig: AgentConfig,
        private agentEventBus: AgentEventBus,
        initialSettings?: Partial<AgentRuntimeState['runtime']>
    ) {
        this.baselineConfig = structuredClone(staticConfig);

        // Initialize runtime state from static config baseline
        this.runtimeState = {
            llm: structuredClone(staticConfig.llm),
            mcpServers: structuredClone(staticConfig.mcpServers),
            runtime: {
                debugMode: false,
                logLevel: 'info',
                ...initialSettings,
            },
            lastModified: new Date(),
        };

        logger.debug('AgentStateManager initialized', {
            staticConfigKeys: Object.keys(this.baselineConfig),
            mcpServerCount: Object.keys(this.runtimeState.mcpServers).length,
            runtimeState: this.runtimeState,
        });
    }

    // ============= GETTERS =============

    /**
     * Get the current global runtime state
     */
    public getRuntimeState(): Readonly<AgentRuntimeState> {
        return structuredClone(this.runtimeState);
    }

    /**
     * Get the original static configuration baseline
     */
    public getBaselineConfig(): Readonly<AgentConfig> {
        return structuredClone(this.baselineConfig);
    }

    /**
     * Get effective state for a session (runtime + session overrides)
     */
    public getEffectiveState(sessionId?: string): Readonly<AgentRuntimeState> {
        if (!sessionId) {
            return this.getRuntimeState();
        }

        const override = this.sessionOverrides.get(sessionId);
        if (!override) {
            return this.getRuntimeState();
        }

        return {
            llm: { ...this.runtimeState.llm, ...override.llm },
            mcpServers: this.runtimeState.mcpServers, // MCP servers are global, not session-specific
            runtime: { ...this.runtimeState.runtime, ...override.runtime },
            lastModified: override.lastModified,
        };
    }

    // ============= CONFIGURATION ACCESS =============

    /**
     * Get effective configuration in AgentConfig format for a session.
     *
     * **Use this when you need multiple config sections** or want the complete configuration.
     * This includes session-specific overrides for LLM and runtime settings.
     *
     * @param sessionId Optional session ID for session-specific overrides
     * @returns Complete configuration with runtime state and session overrides applied
     */
    public getEffectiveConfig(sessionId?: string): Readonly<AgentConfig> {
        const effectiveState = this.getEffectiveState(sessionId);

        return {
            ...this.baselineConfig,
            llm: effectiveState.llm,
            mcpServers: effectiveState.mcpServers,
        };
    }

    /**
     * Get all active session overrides
     */
    public getSessionOverrides(): ReadonlyMap<string, Readonly<SessionOverride>> {
        return new Map(this.sessionOverrides);
    }

    // ============= LLM CONFIGURATION =============

    /**
     * Update the LLM configuration (globally or for a specific session)
     */
    public updateLLM(newConfig: Partial<LLMConfig>, sessionId?: string): ValidationResult {
        // Build the new effective state for validation
        const currentState = sessionId ? this.getEffectiveState(sessionId) : this.runtimeState;
        const updatedState: AgentRuntimeState = {
            ...currentState,
            llm: { ...currentState.llm, ...newConfig },
        };

        // Validate the complete state
        const validation = validateRuntimeState(updatedState);

        if (!validation.isValid) {
            logger.warn('LLM update validation failed', {
                sessionId,
                errors: validation.errors.map((e) => e.message),
                warnings: validation.warnings,
            });
            return validation; // Return validation result without making changes
        }

        const oldValue = sessionId ? this.getEffectiveState(sessionId).llm : this.runtimeState.llm;

        if (sessionId) {
            this.setSessionOverride(sessionId, {
                llm: { ...this.getSessionOverride(sessionId)?.llm, ...newConfig },
            });
        } else {
            this.runtimeState.llm = { ...this.runtimeState.llm, ...newConfig };
            this.runtimeState.lastModified = new Date();
        }

        this.agentEventBus.emit('saiki:stateChanged', {
            field: 'llm',
            oldValue,
            newValue: sessionId ? this.getEffectiveState(sessionId).llm : this.runtimeState.llm,
            sessionId,
        });

        logger.info('LLM config updated', {
            sessionId,
            updatedFields: Object.keys(newConfig),
            isSessionSpecific: !!sessionId,
            warnings: validation.warnings,
        });

        return validation;
    }

    // ============= MCP SERVER MANAGEMENT =============

    /**
     * Add or update an MCP server configuration at runtime.
     *
     * @param serverName The name of the MCP server
     * @param serverConfig The server configuration
     * @returns ValidationResult indicating success or failure
     */
    public addMcpServer(serverName: string, serverConfig: McpServerConfig): ValidationResult {
        logger.debug(`Adding/updating MCP server: ${serverName}`);

        // Validate the server configuration
        const existingServerNames = Object.keys(this.runtimeState.mcpServers);
        const validation = validateMcpServerConfig(serverName, serverConfig, existingServerNames);

        if (!validation.isValid) {
            logger.warn('MCP server configuration validation failed', {
                serverName,
                errors: validation.errors.map((e) => e.message),
                warnings: validation.warnings,
            });
            return validation; // Return validation result without making changes
        }

        // Log warnings if any
        if (validation.warnings.length > 0) {
            logger.warn('MCP server configuration warnings', {
                serverName,
                warnings: validation.warnings,
            });
        }

        const isUpdate = serverName in this.runtimeState.mcpServers;
        this.runtimeState.mcpServers[serverName] = serverConfig;
        this.runtimeState.lastModified = new Date();

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
     *
     * @param serverName The name of the MCP server to remove
     */
    public removeMcpServer(serverName: string): void {
        logger.debug(`Removing MCP server: ${serverName}`);

        if (serverName in this.runtimeState.mcpServers) {
            delete this.runtimeState.mcpServers[serverName];
            this.runtimeState.lastModified = new Date();

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

    /**
     * Get list of current MCP server names
     */
    public getMcpServerNames(): string[] {
        return Object.keys(this.runtimeState.mcpServers);
    }

    /**
     * Get specific MCP server configuration
     */
    public getMcpServer(serverName: string): McpServerConfig | undefined {
        return this.runtimeState.mcpServers[serverName];
    }

    // ============= RUNTIME SETTINGS =============

    /**
     * Update runtime settings (globally or for a specific session)
     */
    public updateRuntime(
        settings: Partial<AgentRuntimeState['runtime']>,
        sessionId?: string
    ): ValidationResult {
        // Validate the update first
        const validation = validateRuntimeUpdate(settings);

        if (!validation.isValid) {
            logger.warn('Runtime update validation failed', {
                sessionId,
                errors: validation.errors.map((e) => e.message),
                warnings: validation.warnings,
            });
            return validation; // Return validation result without making changes
        }

        const oldValue = sessionId
            ? this.getEffectiveState(sessionId).runtime
            : this.runtimeState.runtime;

        if (sessionId) {
            this.setSessionOverride(sessionId, {
                runtime: { ...this.getSessionOverride(sessionId)?.runtime, ...settings },
            });
        } else {
            this.runtimeState.runtime = { ...this.runtimeState.runtime, ...settings };
            this.runtimeState.lastModified = new Date();
        }

        this.agentEventBus.emit('saiki:stateChanged', {
            field: 'runtime',
            oldValue,
            newValue: sessionId
                ? this.getEffectiveState(sessionId).runtime
                : this.runtimeState.runtime,
            sessionId,
        });

        logger.info('Runtime settings updated', {
            sessionId,
            settings,
            warnings: validation.warnings,
        });

        return validation;
    }

    // ============= SESSION MANAGEMENT =============

    /**
     * Set a session-specific override
     */
    private setSessionOverride(
        sessionId: string,
        partial: Partial<Omit<SessionOverride, 'lastModified'>>
    ): void {
        const existing = this.sessionOverrides.get(sessionId);
        const override: SessionOverride = {
            llm: { ...existing?.llm, ...partial.llm },
            runtime: { ...existing?.runtime, ...partial.runtime },
            lastModified: new Date(),
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
     * Clear all session overrides
     */
    public clearAllSessionOverrides(): void {
        const sessionIds = Array.from(this.sessionOverrides.keys());
        this.sessionOverrides.clear();

        sessionIds.forEach((sessionId) => {
            this.agentEventBus.emit('saiki:sessionOverrideCleared', { sessionId });
        });

        if (sessionIds.length > 0) {
            logger.info('All session overrides cleared', { clearedSessions: sessionIds });
        }
    }

    // ============= AI AGENT BUILDER FEATURES =============

    /**
     * Export current runtime state as config for AI Agent Builder.
     * This allows users to save their runtime modifications as a new agent config.
     */
    public exportAsConfig(): {
        config: AgentConfig;
        runtimeSettings: AgentRuntimeState['runtime'];
    } {
        const exportedConfig: AgentConfig = {
            ...this.baselineConfig,
            llm: structuredClone(this.runtimeState.llm),
            mcpServers: structuredClone(this.runtimeState.mcpServers),
        };

        const result = {
            config: exportedConfig,
            runtimeSettings: structuredClone(this.runtimeState.runtime),
        };

        this.agentEventBus.emit('saiki:stateExported', result);

        logger.info('Runtime state exported as config', {
            hasChanges: this.hasChangesFromBaseline(),
            exportedConfig,
        });

        return result;
    }

    /**
     * Reset runtime state back to baseline configuration
     */
    public resetToBaseline(): void {
        this.runtimeState = {
            llm: structuredClone(this.baselineConfig.llm),
            mcpServers: structuredClone(this.baselineConfig.mcpServers),
            runtime: {
                debugMode: false,
                logLevel: 'info',
            },
            lastModified: new Date(),
        };

        this.clearAllSessionOverrides();
        this.agentEventBus.emit('saiki:stateReset', { toConfig: this.baselineConfig });

        logger.info('Runtime state reset to baseline config');
    }

    /**
     * Check if runtime state differs from baseline config
     */
    public hasChangesFromBaseline(): boolean {
        return (
            JSON.stringify(this.runtimeState.llm) !== JSON.stringify(this.baselineConfig.llm) ||
            JSON.stringify(this.runtimeState.mcpServers) !==
                JSON.stringify(this.baselineConfig.mcpServers) ||
            this.sessionOverrides.size > 0
        );
    }

    /**
     * Get a detailed summary of changes from baseline config
     */
    public getChangesSummary(): {
        hasChanges: boolean;
        llmChanges: string[];
        mcpServerChanges: string[];
        runtimeChanges: string[];
        sessionOverrides: {
            sessionId: string;
            hasLLMChanges: boolean;
            hasRuntimeChanges: boolean;
        }[];
    } {
        const llmChanges: string[] = [];
        const mcpServerChanges: string[] = [];
        const runtimeChanges: string[] = [];

        // Check LLM changes
        const baselineLLM = this.baselineConfig.llm;
        const runtimeLLM = this.runtimeState.llm;

        if (baselineLLM.provider !== runtimeLLM.provider) {
            llmChanges.push(`Provider: ${baselineLLM.provider} → ${runtimeLLM.provider}`);
        }
        if (baselineLLM.model !== runtimeLLM.model) {
            llmChanges.push(`Model: ${baselineLLM.model} → ${runtimeLLM.model}`);
        }
        if (JSON.stringify(baselineLLM.systemPrompt) !== JSON.stringify(runtimeLLM.systemPrompt)) {
            llmChanges.push('System prompt modified');
        }
        if (baselineLLM.router !== runtimeLLM.router) {
            llmChanges.push(`Router: ${baselineLLM.router} → ${runtimeLLM.router}`);
        }

        // Check MCP server changes
        const baselineServers = Object.keys(this.baselineConfig.mcpServers);
        const runtimeServers = Object.keys(this.runtimeState.mcpServers);

        const addedServers = runtimeServers.filter((name) => !baselineServers.includes(name));
        const removedServers = baselineServers.filter((name) => !runtimeServers.includes(name));

        addedServers.forEach((name) => mcpServerChanges.push(`Added: ${name}`));
        removedServers.forEach((name) => mcpServerChanges.push(`Removed: ${name}`));

        // Check session overrides
        const sessionOverrides = Array.from(this.sessionOverrides.entries()).map(
            ([sessionId, override]) => ({
                sessionId,
                hasLLMChanges: !!override.llm && Object.keys(override.llm).length > 0,
                hasRuntimeChanges: !!override.runtime && Object.keys(override.runtime).length > 0,
            })
        );

        const hasChanges =
            llmChanges.length > 0 ||
            mcpServerChanges.length > 0 ||
            runtimeChanges.length > 0 ||
            sessionOverrides.length > 0;

        return {
            hasChanges,
            llmChanges,
            mcpServerChanges,
            runtimeChanges,
            sessionOverrides,
        };
    }

    // ============= CONVENIENCE METHODS =============

    /**
     * Quickly switch LLM model (keeping other LLM settings)
     */
    public switchModel(model: string, sessionId?: string): ValidationResult {
        return this.updateLLM({ model }, sessionId);
    }

    /**
     * Quickly switch LLM provider (will also need to update model)
     */
    public switchProvider(provider: string, model: string, sessionId?: string): ValidationResult {
        return this.updateLLM({ provider, model }, sessionId);
    }

    /**
     * Quickly update system prompt
     */
    public updateSystemPrompt(
        systemPrompt: LLMConfig['systemPrompt'],
        sessionId?: string
    ): ValidationResult {
        return this.updateLLM({ systemPrompt }, sessionId);
    }

    /**
     * Quickly switch router
     */
    public switchRouter(router: LLMConfig['router'], sessionId?: string): ValidationResult {
        return this.updateLLM({ router }, sessionId);
    }

    // ============= CONVENIENCE GETTERS =============
    // Use these for common single-section access patterns

    /**
     * Get the current effective LLM configuration for a session.
     * **Use this for session-specific LLM config** (includes session overrides).
     *
     * @param sessionId Optional session ID for session-specific LLM overrides
     */
    public getLLMConfig(sessionId?: string): Readonly<LLMConfig> {
        return this.getEffectiveState(sessionId).llm;
    }

    /**
     * Get the current MCP server configurations.
     * MCP servers are global (not session-specific).
     */
    public getMcpServers(): Readonly<Record<string, McpServerConfig>> {
        return this.runtimeState.mcpServers;
    }

    /**
     * Get the current runtime settings for a session.
     * **Use this for session-specific runtime settings** (includes session overrides).
     *
     * @param sessionId Optional session ID for session-specific runtime overrides
     */
    public getRuntimeSettings(sessionId?: string): Readonly<AgentRuntimeState['runtime']> {
        return this.getEffectiveState(sessionId).runtime;
    }

    /**
     * Get the storage configuration (this doesn't change at runtime).
     * **Use this for static storage config** that doesn't vary by session.
     */
    public getStorageConfig(): Readonly<AgentConfig['storage']> {
        return this.baselineConfig.storage;
    }

    /**
     * Get the sessions configuration (this doesn't change at runtime).
     * **Use this for static session limits/TTL** that doesn't vary by session.
     */
    public getSessionsConfig(): Readonly<AgentConfig['sessions']> {
        return this.baselineConfig.sessions;
    }
}
