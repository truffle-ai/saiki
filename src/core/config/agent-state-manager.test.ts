import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentStateManager } from './agent-state-manager.js';
import { AgentEventBus } from '../events/index.js';
import { AgentConfigSchema } from './schemas.js';
import { LLMConfigSchema } from '../schemas/llm.js';
import type { AgentConfig } from './schemas.js';

describe('AgentStateManager Events', () => {
    let stateManager: AgentStateManager;
    let eventBus: AgentEventBus;
    let mockConfig: AgentConfig;

    beforeEach(() => {
        eventBus = new AgentEventBus();
        mockConfig = {
            systemPrompt: 'You are a helpful assistant',
            mcpServers: {
                test: {
                    type: 'stdio',
                    command: 'test',
                    args: [],
                    env: {},
                    timeout: 30000,
                    connectionMode: 'lenient',
                },
            },
            llm: {
                provider: 'openai',
                model: 'gpt-4o',
                apiKey: 'test-key',
                router: 'in-built',
                maxIterations: 50,
            },
            storage: {
                cache: { type: 'in-memory' },
                database: { type: 'in-memory' },
            },
            internalTools: [],
            sessions: {
                maxSessions: 100,
                sessionTTL: 3600000,
            },
            toolConfirmation: {
                mode: 'event-based',
                timeout: 30000,
                allowedToolsStorage: 'storage',
            },
        };
        // Parse through schema to validate and apply defaults, converting input to ValidatedAgentConfig
        const validatedConfig = AgentConfigSchema.parse(mockConfig);
        stateManager = new AgentStateManager(validatedConfig, eventBus);
    });

    it('emits saiki:stateChanged when LLM config is updated', () => {
        const eventSpy = vi.fn();
        eventBus.on('saiki:stateChanged', eventSpy);

        const updatedConfig = LLMConfigSchema.parse({
            ...mockConfig.llm,
            model: 'gpt-4o-mini',
        });
        stateManager.updateLLM(updatedConfig);

        expect(eventSpy).toHaveBeenCalledWith({
            field: 'llm',
            oldValue: expect.objectContaining({ model: 'gpt-4o' }),
            newValue: expect.objectContaining({ model: 'gpt-4o-mini' }),
            sessionId: undefined,
        });
    });

    it('emits saiki:mcpServerAdded when adding a new MCP server', () => {
        const eventSpy = vi.fn();
        eventBus.on('saiki:mcpServerAdded', eventSpy);

        const newServerConfig = {
            type: 'stdio' as const,
            command: 'new-server',
            args: [],
            env: {},
            timeout: 30000,
            connectionMode: 'lenient' as const,
        };

        stateManager.addMcpServer('new-server', newServerConfig);

        expect(eventSpy).toHaveBeenCalledWith({
            serverName: 'new-server',
            config: newServerConfig,
        });
    });

    it('emits saiki:mcpServerRemoved when removing an MCP server', () => {
        const eventSpy = vi.fn();
        eventBus.on('saiki:mcpServerRemoved', eventSpy);

        stateManager.removeMcpServer('test');

        expect(eventSpy).toHaveBeenCalledWith({
            serverName: 'test',
        });
    });

    it('emits saiki:sessionOverrideSet when setting session overrides', () => {
        const eventSpy = vi.fn();
        eventBus.on('saiki:sessionOverrideSet', eventSpy);

        const sessionConfig = LLMConfigSchema.parse({
            ...mockConfig.llm,
            model: 'gpt-4o',
        });
        stateManager.updateLLM(sessionConfig, 'session-123');

        expect(eventSpy).toHaveBeenCalledWith({
            sessionId: 'session-123',
            override: expect.objectContaining({
                llm: expect.objectContaining({ model: 'gpt-4o' }),
            }),
        });
    });

    it('emits saiki:sessionOverrideCleared when clearing session overrides', () => {
        const eventSpy = vi.fn();
        eventBus.on('saiki:sessionOverrideCleared', eventSpy);

        // First set an override
        const sessionConfig = LLMConfigSchema.parse({
            ...mockConfig.llm,
            model: 'gpt-4o',
        });
        stateManager.updateLLM(sessionConfig, 'session-123');

        // Then clear it
        stateManager.clearSessionOverride('session-123');

        expect(eventSpy).toHaveBeenCalledWith({
            sessionId: 'session-123',
        });
    });

    it('emits saiki:stateReset when resetting to baseline', () => {
        const eventSpy = vi.fn();
        eventBus.on('saiki:stateReset', eventSpy);

        stateManager.resetToBaseline();

        expect(eventSpy).toHaveBeenCalledWith({
            toConfig: mockConfig,
        });
    });

    it('emits saiki:stateExported when exporting state as config', () => {
        const eventSpy = vi.fn();
        eventBus.on('saiki:stateExported', eventSpy);

        const exported = stateManager.exportAsConfig();

        expect(eventSpy).toHaveBeenCalledWith({ config: exported });
    });
});
