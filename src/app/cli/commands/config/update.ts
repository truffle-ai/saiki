import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs/promises';
import { getAllMcpServers } from '@core/config/mcp-registry.js';
import { ConfigurationManager } from '@core/config/config-manager.js';
import {
    getDefaultModelForProvider,
    LLMProvider,
    logger,
    getSupportedModels,
} from '@core/index.js';
import type { AgentConfig, McpServerConfig } from '@core/config/schemas.js';
import { getPrimaryApiKeyEnvVar } from '@core/utils/api-key-resolver.js';
import {
    DEFAULT_SYSTEM_PROMPT,
    getMcpServersFromIds,
    getPresetServers,
    getSystemPromptByType,
    formatConfigAsYaml,
    resolveOutputPath,
} from './utils.js';

export interface UpdateCommandOptions {
    /** Whether to save the configuration after creation */
    save?: boolean;
    /** Output path for the configuration file */
    output?: string;

    // LLM Configuration
    provider?: string;
    llmModel?: string;
    apiKey?: string;
    envVar?: string;
    baseUrl?: string;
    maxIterations?: number;
    temperature?: number;

    // MCP Server Configuration
    mcpPreset?: string;
    mcpServers?: string;
    noMcp?: boolean;
    mcp?: boolean;
    addMcpServers?: string;
    removeMcpServers?: string;
    clearMcp?: boolean;

    // System Prompt Configuration
    systemPrompt?: string;
    promptType?: string;
    specialistRole?: string;

    // Metadata
    name?: string;
    description?: string;
}

/**
 * Check if we have enough flags for non-interactive mode
 */
function hasNonInteractiveFlags(options: UpdateCommandOptions): boolean {
    // For update, we need at least one flag that indicates what to update
    return !!(
        options.provider ||
        options.llmModel ||
        options.mcpPreset ||
        options.mcpServers ||
        options.systemPrompt ||
        options.promptType ||
        options.addMcpServers ||
        options.removeMcpServers ||
        options.clearMcp ||
        options.noMcp
    );
}

/**
 * Build updated configuration from command line flags (non-interactive mode)
 */
async function buildConfigFromFlags(
    baseConfig: AgentConfig,
    options: UpdateCommandOptions
): Promise<AgentConfig> {
    // Start with the base configuration
    const config: AgentConfig = JSON.parse(JSON.stringify(baseConfig)); // Deep copy

    // Update LLM configuration
    if (options.provider) {
        config.llm.provider = options.provider as LLMProvider;
    }

    if (options.llmModel) {
        config.llm.model = options.llmModel;
    }

    // Handle API key configuration
    if (options.apiKey) {
        config.llm.apiKey = options.apiKey;
    } else if (options.envVar) {
        config.llm.apiKey = `$${options.envVar}`;
    } else if (options.provider) {
        // If provider changed, update the API key env var
        config.llm.apiKey = `$${getPrimaryApiKeyEnvVar(options.provider as LLMProvider)}`;
    }

    // Update optional LLM settings
    if (options.baseUrl !== undefined) config.llm.baseURL = options.baseUrl;
    if (options.temperature !== undefined) config.llm.temperature = options.temperature;
    if (options.maxIterations !== undefined) config.llm.maxIterations = options.maxIterations;

    // Handle MCP servers updates
    if (options.clearMcp) {
        config.mcpServers = {};
    } else if (options.noMcp) {
        config.mcpServers = {};
    } else if (options.mcpPreset) {
        config.mcpServers = await getPresetServers(options.mcpPreset);
    } else if (options.mcpServers) {
        config.mcpServers = await getMcpServersFromIds(
            options.mcpServers.split(',').map((s) => s.trim())
        );
    } else {
        // Handle add/remove MCP servers
        if (options.addMcpServers) {
            const serversToAdd = await getMcpServersFromIds(
                options.addMcpServers.split(',').map((s) => s.trim())
            );
            config.mcpServers = { ...config.mcpServers, ...serversToAdd };
        }

        if (options.removeMcpServers) {
            const serversToRemove = options.removeMcpServers.split(',').map((s) => s.trim());
            config.mcpServers = config.mcpServers || {};
            serversToRemove.forEach((serverId) => {
                delete config.mcpServers![serverId];
            });
        }
    }

    // Handle system prompt updates
    if (options.systemPrompt) {
        config.systemPrompt = options.systemPrompt;
    } else if (options.promptType) {
        config.systemPrompt = await getSystemPromptByType(
            options.promptType,
            options.specialistRole
        );
    }

    return config;
}

/**
 * Main command for updating existing agent configurations.
 */
export async function updateCommand(
    configId?: string,
    options: UpdateCommandOptions = {}
): Promise<void> {
    const configManager = new ConfigurationManager();

    try {
        let selectedConfigId = configId;
        let baseConfig: AgentConfig | undefined;
        let configName: string | undefined;

        // Handle config ID resolution first (needed for both modes)
        if (!selectedConfigId) {
            const configurations = await configManager.listConfigurations();

            if (configurations.length === 0) {
                if (hasNonInteractiveFlags(options)) {
                    logger.error('No saved configurations found to update');
                    process.exit(1);
                } else {
                    p.note('No saved configurations found to update.', 'Info');
                    p.outro('Use `saiki config create` to create a new configuration.');
                    return;
                }
            }

            if (hasNonInteractiveFlags(options)) {
                logger.error('Configuration ID is required for non-interactive mode');
                process.exit(1);
            }

            // Interactive selection
            const selectedId = await p.select({
                message: 'Choose a configuration to update',
                options: configurations.map((config) => ({
                    value: config.id,
                    label: config.name,
                    hint:
                        config.description ||
                        `Created: ${new Date(config.createdAt).toLocaleDateString()}`,
                })),
            });

            if (p.isCancel(selectedId)) {
                p.cancel('Update cancelled');
                return;
            }

            selectedConfigId = selectedId as string;
        }

        // Load the configuration
        const loaded = await configManager.loadConfiguration(selectedConfigId);
        if (!loaded) {
            if (hasNonInteractiveFlags(options)) {
                logger.error(`Configuration '${selectedConfigId}' not found`);
                process.exit(1);
            } else {
                p.note(`Configuration '${selectedConfigId}' not found.`, 'Error');
                return;
            }
        }

        baseConfig = loaded.config;
        configName = loaded.name;

        // Check if we have enough flags for non-interactive mode
        const isNonInteractive = hasNonInteractiveFlags(options);

        let config: AgentConfig;

        if (isNonInteractive) {
            // Non-interactive mode: build config from flags
            config = await buildConfigFromFlags(baseConfig, options);

            // Show a brief summary for non-interactive mode
            logger.info(
                `Updating configuration: ${configName} (${config.llm.provider}/${config.llm.model})`
            );
        } else {
            // Interactive mode: use prompts
            p.intro(chalk.inverse(' Update Agent Configuration '));
            p.note(`Loaded configuration: ${loaded.name}`, 'Base Configuration');

            p.note(
                '💡 Updating existing configuration. Use Ctrl+C to cancel or continue with prompts',
                'Navigation'
            );

            // Interactive configuration builder (no quick mode for updates)
            config = await buildAgentConfiguration(baseConfig);

            // ───────────────── Summary Preview ─────────────────
            const summaryLines = [
                chalk.cyanBright.bold('─ Configuration Preview ─'),
                `LLM         : ${config.llm.provider} / ${config.llm.model}`,
                `MCP Servers : ${Object.keys(config.mcpServers || {}).join(', ') || 'none'}`,
                `SystemPrompt: ${typeof config.systemPrompt === 'string' ? (config.systemPrompt as string).slice(0, 60) + '…' : '[object]'}`,
            ];
            p.note(summaryLines.join('\n'), 'Preview');
        }

        // Handle configuration output
        await handleConfigurationOutput(
            configManager,
            config,
            options,
            configName,
            selectedConfigId
        );

        if (isNonInteractive) {
            logger.info('Configuration updated successfully! 🎉');
        } else {
            p.outro(chalk.greenBright('Configuration updated successfully! 🎉'));
        }
    } catch (error) {
        if (p.isCancel(error)) {
            p.cancel('Update cancelled');
            process.exit(0);
        }

        logger.error(`Configuration update failed: ${error}`);
        if (!hasNonInteractiveFlags(options)) {
            p.outro(chalk.red('Update failed. Check the logs for details.'));
        }
        process.exit(1);
    }
}

/**
 * Interactive agent configuration builder for updates (no quick mode)
 */
async function buildAgentConfiguration(baseConfig: AgentConfig): Promise<AgentConfig> {
    const answers = await p.group(
        {
            // LLM Configuration - smart prompting based on existing config
            llmProvider: () => {
                const currentProvider = baseConfig.llm.provider;
                const allProviders = [
                    { value: 'openai', label: 'OpenAI', hint: 'GPT-4, GPT-3.5, etc.' },
                    { value: 'anthropic', label: 'Anthropic', hint: 'Claude models' },
                    { value: 'google', label: 'Google', hint: 'Gemini models' },
                    { value: 'groq', label: 'Groq', hint: 'Fast inference' },
                ];

                // Put "Keep current" first, then other providers
                const options = [
                    {
                        value: currentProvider,
                        label: `Keep ${currentProvider}`,
                        hint: 'No changes to LLM provider',
                    },
                    ...allProviders.filter((opt) => opt.value !== currentProvider),
                ];

                return p.select({
                    message: `Current LLM provider: ${currentProvider}. What would you like to do?`,
                    options,
                    initialValue: currentProvider,
                });
            },

            llmModel: ({ results }) => {
                const provider = results.llmProvider as LLMProvider;
                const defaultModel = getDefaultModelForProvider(provider) || 'gpt-4o-mini';
                const currentModel = baseConfig.llm.model;

                // If we're keeping the same provider and have a current model
                if (provider === baseConfig.llm.provider && currentModel) {
                    return p
                        .confirm({
                            message: `Current model: ${currentModel}. Keep this model?`,
                            initialValue: true,
                        })
                        .then(async (keepModel) => {
                            if (keepModel) {
                                return currentModel;
                            } else {
                                return await p.select({
                                    message: `Choose the new model for ${provider}`,
                                    options: getSupportedModels(provider).map((model) => ({
                                        value: model,
                                        label: model,
                                        hint: model,
                                    })),
                                    initialValue: defaultModel,
                                });
                            }
                        });
                }

                return p.select({
                    message: `Choose the model for ${provider}`,
                    options: getSupportedModels(provider).map((model) => ({
                        value: model,
                        label: model,
                        hint: model,
                    })),
                    initialValue: defaultModel,
                });
            },

            // API Key handling - skip if provider hasn't changed
            apiKeyOption: ({ results }) => {
                const provider = results.llmProvider as LLMProvider;
                const envVar = getPrimaryApiKeyEnvVar(provider);

                // If provider hasn't changed, skip API key setup
                if (provider === baseConfig.llm.provider && baseConfig.llm.apiKey) {
                    return Promise.resolve('keep');
                }

                return p.select({
                    message: `How do you want to handle the ${provider} API key?`,
                    options: [
                        {
                            value: 'env',
                            label: 'Use environment variable',
                            hint: `Will use $${envVar}`,
                        },
                        {
                            value: 'enter',
                            label: 'Enter manually',
                            hint: 'Not recommended for production',
                        },
                        { value: 'skip', label: 'Skip for now', hint: 'Configure later' },
                    ],
                    initialValue: 'env',
                });
            },

            apiKey: async ({ results }) => {
                if (results.apiKeyOption === 'enter') {
                    return await p.password({
                        message: 'Enter your API key',
                        mask: '*',
                    });
                }
                return undefined;
            },

            // MCP Servers Selection
            mcpServers: async () => {
                const allServers = await getAllMcpServers();

                // Ask if they want to keep current servers
                if (baseConfig.mcpServers && Object.keys(baseConfig.mcpServers).length > 0) {
                    const keep = await p.confirm({
                        message: `Keep existing MCP servers (${Object.keys(baseConfig.mcpServers).join(', ')})?`,
                        initialValue: true,
                    });
                    if (keep) {
                        return baseConfig.mcpServers;
                    }
                }

                // Use spacebar to select/deselect options, arrow keys to navigate, enter to confirm
                const selectedIds = await p.multiselect({
                    message:
                        'Select MCP servers (space to select/deselect, arrow keys to navigate, enter to confirm)',
                    options: allServers.map((server) => ({
                        value: server.id,
                        label: `${server.name} (${server.category})`,
                        hint: server.description,
                    })),
                    required: false,
                    initialValues: baseConfig.mcpServers ? Object.keys(baseConfig.mcpServers) : [],
                });

                const selectedServers: Record<string, McpServerConfig> = {};
                for (const id of selectedIds as string[]) {
                    const srv = allServers.find((s) => s.id === id);
                    if (srv) {
                        selectedServers[srv.id] = srv.config;
                    }
                }

                const count = Object.keys(selectedServers).length;
                p.note(`Selected ${count} MCP server(s)`, 'MCP Servers');
                return selectedServers;
            },

            // System Prompt
            systemPromptConfig: () => {
                return p.confirm({
                    message: 'Modify the system prompt?',
                    initialValue: false,
                });
            },

            systemPrompt: async ({ results }) => {
                if (!results.systemPromptConfig) {
                    return baseConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT;
                }

                return await configureSystemPrompt(baseConfig.systemPrompt);
            },
        },
        {
            onCancel: () => {
                p.cancel('Update cancelled.');
                process.exit(0);
            },
        }
    );

    // Build the configuration object
    const provider = answers.llmProvider as LLMProvider;
    const envVar = getPrimaryApiKeyEnvVar(provider);

    let apiKey: string;
    if (answers.apiKeyOption === 'keep' && baseConfig.llm.apiKey) {
        apiKey = baseConfig.llm.apiKey;
    } else if (answers.apiKeyOption === 'enter' && typeof answers.apiKey === 'string') {
        apiKey = answers.apiKey;
    } else if (answers.apiKeyOption === 'env') {
        apiKey = `$${envVar}`;
    } else {
        apiKey = `$${envVar}`;
    }

    const config: AgentConfig = {
        systemPrompt: answers.systemPrompt as any,
        mcpServers: answers.mcpServers as Record<string, McpServerConfig>,
        llm: {
            provider,
            model: answers.llmModel as string,
            apiKey,
        },
        // Use defaults for storage, sessions, toolConfirmation (they'll be applied by schema)
    };

    return config;
}

/**
 * Configure system prompt
 */
async function configureSystemPrompt(basePrompt?: string | object): Promise<string | object> {
    const promptType = await p.select({
        message: 'Choose system prompt configuration',
        options: [
            { value: 'default', label: 'Default prompt', hint: 'General-purpose assistant' },
            { value: 'specialist', label: 'Specialist prompts', hint: 'Role-specific behavior' },
            { value: 'custom', label: 'Write custom prompt', hint: 'Simple text prompt' },
        ],
        initialValue: 'default',
    });

    if (promptType === 'default') {
        return DEFAULT_SYSTEM_PROMPT;
    }

    if (promptType === 'specialist') {
        const specialist = await p.select({
            message: 'Choose specialist role',
            options: [
                { value: 'developer', label: 'Software Developer', hint: 'Code-focused assistant' },
                { value: 'writer', label: 'Content Writer', hint: 'Writing and editing' },
                { value: 'analyst', label: 'Data Analyst', hint: 'Data and research focused' },
                { value: 'manager', label: 'Project Manager', hint: 'Planning and coordination' },
            ],
        });

        const prompts = {
            developer:
                'You are a software development assistant. Focus on code quality, best practices, and helping with programming tasks. You have access to development tools and can help with debugging, code review, and implementation.',
            writer: 'You are a content writing assistant. Help with writing, editing, and improving text. Focus on clarity, style, and engaging content creation.',
            analyst:
                'You are a data analysis assistant. Help with data processing, research, and generating insights from information. Focus on accuracy and evidence-based conclusions.',
            manager:
                'You are a project management assistant. Help with planning, organization, and coordination tasks. Focus on efficiency and clear communication.',
        };

        return prompts[specialist as keyof typeof prompts] || prompts.developer;
    }

    // Custom prompt
    const promptValue = typeof basePrompt === 'string' ? basePrompt : '';
    const customPrompt = await p.text({
        message: 'Enter your custom system prompt',
        placeholder: 'You are a helpful AI assistant...',
        ...(promptValue && { defaultValue: promptValue }),
    });

    return customPrompt as string;
}

/**
 * Handle configuration output (save or write to file)
 */
async function handleConfigurationOutput(
    configManager: ConfigurationManager,
    config: AgentConfig,
    options: UpdateCommandOptions,
    configName: string,
    configId: string
): Promise<void> {
    const isNonInteractive = hasNonInteractiveFlags(options);

    let shouldSave = options.save !== false; // Default to true unless explicitly false
    let shouldExport = !!options.output; // Export if output path is provided

    if (!isNonInteractive) {
        // Interactive mode: ask about save and export
        const saveResult = await p.confirm({
            message: 'Update the saved configuration?',
            initialValue: true,
        });
        if (p.isCancel(saveResult)) process.exit(0);
        shouldSave = saveResult;

        const exportResult = await p.confirm({
            message: 'Export updated configuration to YAML file?',
            initialValue: true,
        });
        if (p.isCancel(exportResult)) process.exit(0);
        shouldExport = exportResult;
    }

    // Handle saving to manager
    if (shouldSave) {
        const success = await configManager.updateConfiguration(configId, { config });
        if (success) {
            if (isNonInteractive) {
                logger.info(`Configuration '${configName}' updated`);
            } else {
                p.note(`Configuration updated successfully`, 'Updated');
            }
        } else {
            if (isNonInteractive) {
                logger.error(`Failed to update configuration '${configName}'`);
            } else {
                p.note(`Failed to update configuration`, 'Error');
            }
        }
    }

    // Handle YAML export
    if (shouldExport) {
        const finalOutputPath = await resolveOutputPath(options.output, configName);
        const yamlContent = await formatConfigAsYaml(config);
        await fs.writeFile(finalOutputPath, yamlContent);
        if (isNonInteractive) {
            logger.info(`Configuration exported to: ${finalOutputPath}`);
        } else {
            p.note(`Configuration exported to: ${finalOutputPath}`, 'Exported');
        }
    }
}
