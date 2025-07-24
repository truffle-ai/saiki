import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentStateManager } from './agent-state-manager.js';
import { AgentEventBus } from '../events/index.js';
import { AgentConfigSchema } from './schemas.js';
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

    it('emits dexto:stateChanged when LLM config is updated', () => {
        const eventSpy = vi.fn();
        eventBus.on('dexto:stateChanged', eventSpy);

        stateManager.updateLLM({ model: 'gpt-4o-mini' });

        expect(eventSpy).toHaveBeenCalledWith({
            field: 'llm',
            oldValue: expect.objectContaining({ model: 'gpt-4o' }),
            newValue: expect.objectContaining({ model: 'gpt-4o-mini' }),
            sessionId: undefined,
        });
    });

    it('emits dexto:mcpServerAdded when adding a new MCP server', () => {
        const eventSpy = vi.fn();
        eventBus.on('dexto:mcpServerAdded', eventSpy);

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

    it('emits dexto:mcpServerRemoved when removing an MCP server', () => {
        const eventSpy = vi.fn();
        eventBus.on('dexto:mcpServerRemoved', eventSpy);

        stateManager.removeMcpServer('test');

        expect(eventSpy).toHaveBeenCalledWith({
            serverName: 'test',
        });
    });

    it('emits dexto:sessionOverrideSet when setting session overrides', () => {
        const eventSpy = vi.fn();
        eventBus.on('dexto:sessionOverrideSet', eventSpy);

        stateManager.updateLLM({ model: 'gpt-4o' }, 'session-123');

        expect(eventSpy).toHaveBeenCalledWith({
            sessionId: 'session-123',
            override: expect.objectContaining({
                llm: expect.objectContaining({ model: 'gpt-4o' }),
            }),
        });
    });

    it('emits dexto:sessionOverrideCleared when clearing session overrides', () => {
        const eventSpy = vi.fn();
        eventBus.on('dexto:sessionOverrideCleared', eventSpy);

        // First set an override
        stateManager.updateLLM({ model: 'gpt-4o' }, 'session-123');

        // Then clear it
        stateManager.clearSessionOverride('session-123');

        expect(eventSpy).toHaveBeenCalledWith({
            sessionId: 'session-123',
        });
    });

    it('emits dexto:stateReset when resetting to baseline', () => {
        const eventSpy = vi.fn();
        eventBus.on('dexto:stateReset', eventSpy);

        stateManager.resetToBaseline();

        expect(eventSpy).toHaveBeenCalledWith({
            toConfig: mockConfig,
        });
    });

    it('emits dexto:stateExported when exporting state as config', () => {
        const eventSpy = vi.fn();
        eventBus.on('dexto:stateExported', eventSpy);

        const exported = stateManager.exportAsConfig();

        expect(eventSpy).toHaveBeenCalledWith({ config: exported });
    });
});
