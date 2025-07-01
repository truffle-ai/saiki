import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import * as YAML from 'yaml';
import { MCP_SERVER_REGISTRY } from '@core/config/mcp-registry.js';
import { ConfigurationManager } from '@core/config/config-manager.js';
import {
    getDefaultModelForProvider,
    LLMProvider,
    logger,
    getSupportedModels,
} from '@core/index.js';
import type { AgentConfig, McpServerConfig } from '@core/config/schemas.js';
import { getPrimaryApiKeyEnvVar } from '@core/utils/api-key-resolver.js';
import os from 'os';

export interface ConfigureCommandOptions {
    /** Whether to save the configuration after creation */
    save?: boolean;
    /** Output path for the configuration file */
    output?: string;
    /** Load an existing configuration to modify */
    load?: string | boolean;
    /** List saved configurations */
    list?: boolean;
    /** Delete a saved configuration */
    delete?: string;
    /** Export a saved configuration */
    export?: string;
    /** Quick path (minimal prompts) */
    quick?: boolean;
}

// ────────────────────────── Local MCP registry helpers ─────────────────────────
const LOCAL_MCP_REGISTRY_PATH = path.join(os.homedir(), '.saiki', 'mcp-registry.local.json');

async function loadLocalMcpRegistry(): Promise<Record<string, any>> {
    try {
        const data = await fs.readFile(LOCAL_MCP_REGISTRY_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (_err) {
        return {};
    }
}

/**
 * Main configure command - provides interactive agent configuration
 */
export async function configureCommand(options: ConfigureCommandOptions = {}): Promise<void> {
    const configManager = new ConfigurationManager();

    try {
        // Handle list command
        if (options.list) {
            await listConfigurations(configManager);
            return;
        }

        // Handle delete command
        if (options.delete) {
            await deleteConfiguration(configManager, options.delete);
            return;
        }

        // Handle export command
        if (options.export) {
            await exportConfiguration(configManager, options.export, options.output);
            return;
        }

        // Handle configuration creation/modification
        p.intro(chalk.inverse(' Saiki Agent Configuration '));

        let baseConfig: AgentConfig | undefined;
        let configName: string | undefined;
        let loadedConfigId: string | undefined;

        // Load existing configuration if specified
        if (options.load !== undefined) {
            if (options.load === true || options.load === '') {
                // Interactive selection when no ID provided
                const configurations = await configManager.listConfigurations();

                if (configurations.length === 0) {
                    p.note('No saved configurations found. Starting fresh.', 'Info');
                } else {
                    const selectedId = await p.select({
                        message: 'Choose a configuration to load and modify',
                        options: configurations.map((config) => ({
                            value: config.id,
                            label: config.name,
                            hint:
                                config.description ||
                                `Created: ${new Date(config.createdAt).toLocaleDateString()}`,
                        })),
                    });

                    if (selectedId) {
                        const loaded = await configManager.loadConfiguration(selectedId as string);
                        if (loaded) {
                            baseConfig = loaded.config;
                            configName = loaded.name;
                            loadedConfigId = loaded.id;
                            p.note(`Loaded configuration: ${loaded.name}`, 'Base Configuration');
                        }
                    }
                }
            } else if (typeof options.load === 'string') {
                // Direct ID provided
                const loaded = await configManager.loadConfiguration(options.load);
                if (loaded) {
                    baseConfig = loaded.config;
                    configName = loaded.name;
                    loadedConfigId = loaded.id;
                    p.note(`Loaded configuration: ${loaded.name}`, 'Base Configuration');
                } else {
                    p.note(`Configuration '${options.load}' not found. Starting fresh.`, 'Warning');
                }
            }
        }

        // Add navigation hints based on whether we're creating or modifying
        if (loadedConfigId) {
            p.note(
                '💡 Modifying existing configuration. Use Ctrl+C to cancel or continue with prompts',
                'Navigation'
            );
        } else {
            p.note(
                '💡 Creating new configuration. Use Ctrl+C to cancel or follow prompts to build your agent',
                'Navigation'
            );
        }

        // Interactive configuration builder
        const config = await buildAgentConfiguration(baseConfig, options.quick || false);

        // ───────────────── Summary Preview ─────────────────
        const summaryLines = [
            chalk.cyanBright.bold('─ Configuration Preview ─'),
            `LLM         : ${config.llm.provider} / ${config.llm.model}`,
            `MCP Servers : ${Object.keys(config.mcpServers || {}).join(', ') || 'none'}`,
            `SystemPrompt: ${typeof config.systemPrompt === 'string' ? (config.systemPrompt as string).slice(0, 60) + '…' : '[object]'}`,
        ];
        p.note(summaryLines.join('\n'), 'Preview');

        // Save or output the configuration
        await handleConfigurationOutput(configManager, config, options, configName, loadedConfigId);

        p.outro(chalk.greenBright('Configuration complete! 🎉'));
    } catch (error) {
        if (error === 'CANCEL_PROMPT') {
            p.cancel('Configuration cancelled');
            process.exit(0);
        }

        logger.error(`Configuration failed: ${error}`);
        p.outro(chalk.red('Configuration failed. Check the logs for details.'));
        process.exit(1);
    }
}

/**
 * Interactive agent configuration builder
 */
async function buildAgentConfiguration(
    baseConfig?: AgentConfig,
    quick: boolean = false
): Promise<AgentConfig> {
    // Quick path: skip most prompts, generate sensible defaults
    if (quick) {
        const provider: LLMProvider = 'openai';
        const model = getDefaultModelForProvider(provider) || 'gpt-4o-mini';
        const envVar = getPrimaryApiKeyEnvVar(provider);

        const quickConfig: AgentConfig = {
            systemPrompt: getDefaultSystemPrompt(),
            mcpServers: getPresetServers('essential'),
            llm: {
                provider,
                model,
                apiKey: `$${envVar}`,
            },
        } as AgentConfig;

        p.note('Generated quick-start configuration using Essential preset.', 'Quick');
        return quickConfig;
    }

    const answers = await p.group(
        {
            // LLM Configuration - smart prompting based on existing config
            llmProvider: () => {
                if (baseConfig?.llm?.provider) {
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
                }

                return p.select({
                    message: 'Choose your LLM provider',
                    options: [
                        { value: 'openai', label: 'OpenAI', hint: 'GPT-4, GPT-3.5, etc.' },
                        { value: 'anthropic', label: 'Anthropic', hint: 'Claude models' },
                        { value: 'google', label: 'Google', hint: 'Gemini models' },
                        { value: 'groq', label: 'Groq', hint: 'Fast inference' },
                    ],
                    initialValue: 'openai',
                });
            },

            llmModel: ({ results }) => {
                const provider = results.llmProvider as LLMProvider;
                const defaultModel = getDefaultModelForProvider(provider) || 'gpt-4o-mini';
                const currentModel = baseConfig?.llm?.model;

                // If we're keeping the same provider and have a current model
                if (provider === baseConfig?.llm?.provider && currentModel) {
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

            // API Key handling - skip if loading and already configured
            apiKeyOption: ({ results }) => {
                const provider = results.llmProvider as LLMProvider;
                const envVar = getPrimaryApiKeyEnvVar(provider);

                // If loading and provider hasn't changed, skip API key setup
                if (provider === baseConfig?.llm?.provider && baseConfig?.llm?.apiKey) {
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
                const customRegistry = await loadLocalMcpRegistry();
                const allServers = [
                    ...Object.values(MCP_SERVER_REGISTRY),
                    ...Object.values(customRegistry),
                ];

                // If editing existing config, ask if they want to keep current servers
                if (baseConfig?.mcpServers && Object.keys(baseConfig.mcpServers).length > 0) {
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
                    initialValues: baseConfig?.mcpServers ? Object.keys(baseConfig.mcpServers) : [],
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

            // System Prompt - only ask if they want to customize
            systemPromptConfig: () => {
                if (baseConfig?.systemPrompt) {
                    return p.confirm({
                        message: 'Modify the system prompt?',
                        initialValue: false,
                    });
                }

                return p.confirm({
                    message: 'Customize the system prompt?',
                    initialValue: false,
                });
            },

            systemPrompt: async ({ results }) => {
                if (!results.systemPromptConfig) {
                    return baseConfig?.systemPrompt || getDefaultSystemPrompt();
                }

                return await configureSystemPrompt(baseConfig?.systemPrompt);
            },
        },
        {
            onCancel: () => {
                throw 'CANCEL_PROMPT';
            },
        }
    );

    // Build the configuration object
    const provider = answers.llmProvider as LLMProvider;
    const envVar = getPrimaryApiKeyEnvVar(provider);

    let apiKey: string;
    if (answers.apiKeyOption === 'keep' && baseConfig?.llm?.apiKey) {
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
 * Get preset server configurations
 */
function getPresetServers(preset: string): Record<string, McpServerConfig> {
    const presets = {
        essential: ['filesystem', 'puppeteer'],
        developer: ['filesystem', 'puppeteer', 'github', 'terminal'],
        productivity: ['filesystem', 'puppeteer', 'notion', 'slack'],
        data: ['filesystem', 'sqlite', 'postgres'],
    };

    const serverIds = presets[preset as keyof typeof presets] || [];
    const servers: Record<string, McpServerConfig> = {};

    for (const id of serverIds) {
        const server = MCP_SERVER_REGISTRY[id];
        if (server) {
            servers[id] = server.config;
        }
    }

    return servers;
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
        return 'You are a helpful AI assistant with access to tools. Use these tools when appropriate to answer user queries. You can use multiple tools in sequence to solve complex problems.';
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
    options: ConfigureCommandOptions,
    configNameFromLoad?: string,
    loadedConfigId?: string
): Promise<void> {
    // Determine output path - default to agents/ directory
    let outputPath = options.output;
    let finalConfigName = configNameFromLoad;

    // Handle saving to configuration manager first (if not --no-save)
    if (options.save !== false) {
        let shouldSave = false;
        let shouldExport = true; // Default to exporting YAML

        if (loadedConfigId) {
            // For existing configs, ask about save and export separately
            const saveResult = await p.confirm({
                message: 'Update the saved configuration?',
                initialValue: true,
            });
            shouldSave = saveResult === true;

            const exportResult = await p.confirm({
                message: 'Export configuration to YAML file?',
                initialValue: true,
            });
            shouldExport = exportResult === true;
        } else {
            // For new configs, ask about both together (they usually want both)
            const saveAndExportResult = await p.confirm({
                message: 'Save this configuration for later reuse and export to YAML?',
                initialValue: true,
            });

            if (saveAndExportResult === true) {
                shouldSave = true;
                shouldExport = true;
            } else {
                // If they don't want to save, ask if they still want YAML export
                const exportOnlyResult = await p.confirm({
                    message: 'Export configuration to YAML file anyway?',
                    initialValue: true,
                });
                shouldExport = exportOnlyResult === true;
            }
        }

        // Handle saving to manager
        if (shouldSave) {
            if (loadedConfigId) {
                // Update existing configuration
                const success = await configManager.updateConfiguration(loadedConfigId, {
                    config,
                });

                if (success) {
                    p.note(`Configuration updated successfully`, 'Updated');
                } else {
                    p.note(`Failed to update configuration`, 'Error');
                }
            } else {
                // Create new configuration - prompt for name here to use for filename
                const name = (await p.text({
                    message: 'Configuration name',
                    placeholder: 'My Agent Configuration',
                })) as string;
                finalConfigName = name; // Set for use in filename generation

                const description = (await p.text({
                    message: 'Description (optional)',
                    placeholder: 'What this agent is designed to do',
                })) as string;

                const configId = await configManager.saveConfiguration(
                    name,
                    description || '',
                    config,
                    []
                );

                p.note(`Configuration saved with ID: ${configId}`, 'Saved');
            }
        }

        // Handle YAML export
        if (shouldExport) {
            if (!outputPath) {
                // Create agents directory if it doesn't exist
                const agentsDir = path.resolve('agents');
                try {
                    await fs.mkdir(agentsDir, { recursive: true });
                } catch (_error) {
                    // Directory might already exist, that's fine
                }

                // Generate filename based on config name (new or loaded) or timestamp as a fallback
                const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
                const filename = finalConfigName
                    ? `${finalConfigName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.yml`
                    : `agent-${timestamp}.yml`;
                outputPath = path.join(agentsDir, filename);
            }

            const yamlContent = formatConfigAsYaml(config);
            await fs.writeFile(outputPath, yamlContent);
            p.note(`Configuration exported to: ${outputPath}`, 'Exported');
        }
    } else {
        // --no-save option: just write the YAML file
        if (!outputPath) {
            const agentsDir = path.resolve('agents');
            await fs.mkdir(agentsDir, { recursive: true });
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
            outputPath = path.join(agentsDir, `agent-unsaved-${timestamp}.yml`);
        }
        const yamlContent = formatConfigAsYaml(config);
        await fs.writeFile(outputPath, yamlContent);
        p.note(`Configuration exported to: ${outputPath}`, 'Exported');
    }
}

/**
 * List saved configurations
 */
async function listConfigurations(configManager: ConfigurationManager): Promise<void> {
    p.intro(chalk.inverse(' Saved Configurations '));

    const configurations = await configManager.listConfigurations();

    if (configurations.length === 0) {
        p.note('No saved configurations found.', 'Info');
        return;
    }

    console.log('\n');
    for (const config of configurations) {
        const createdDate = new Date(config.createdAt).toLocaleDateString();
        const tags = config.tags.length > 0 ? ` (${config.tags.join(', ')})` : '';

        console.log(chalk.bold.cyan(`${config.name}`) + chalk.gray(` [${config.id}]`));
        console.log(chalk.dim(`  ${config.description}`));
        console.log(chalk.dim(`  Created: ${createdDate}${tags}`));
        console.log('');
    }

    p.outro('Use --load <id> to load a configuration or --delete <id> to remove one.');
}

/**
 * Delete a saved configuration
 */
async function deleteConfiguration(configManager: ConfigurationManager, id: string): Promise<void> {
    const config = await configManager.loadConfiguration(id);

    if (!config) {
        p.note(`Configuration '${id}' not found.`, 'Error');
        return;
    }

    const confirm = await p.confirm({
        message: `Delete configuration '${config.name}'?`,
        initialValue: false,
    });

    if (confirm) {
        await configManager.deleteConfiguration(id);
        p.note(`Configuration '${config.name}' deleted successfully.`, 'Success');
    } else {
        p.note('Deletion cancelled.', 'Info');
    }
}

/**
 * Export a saved configuration
 */
async function exportConfiguration(
    configManager: ConfigurationManager,
    id: string,
    outputPath?: string
): Promise<void> {
    const config = await configManager.loadConfiguration(id);

    if (!config) {
        p.note(`Configuration '${id}' not found.`, 'Error');
        return;
    }

    // Default to agents/ directory
    let targetPath = outputPath;
    if (!targetPath) {
        const agentsDir = path.resolve('agents');
        try {
            await fs.mkdir(agentsDir, { recursive: true });
        } catch (_error) {
            // Directory might already exist
        }

        const filename = `${config.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.yml`;
        targetPath = path.join(agentsDir, filename);
    }

    const yamlContent = formatConfigAsYaml(config.config);
    await fs.writeFile(targetPath, yamlContent);
    p.note(`Configuration exported to: ${targetPath}`, 'Success');
}

/**
 * Get default system prompt
 */
function getDefaultSystemPrompt(): string {
    return 'You are a helpful AI assistant with access to tools. Use these tools when appropriate to answer user queries. You can use multiple tools in sequence to solve complex problems.';
}

/**
 * Format configuration as YAML
 */
function formatConfigAsYaml(config: AgentConfig): string {
    // Use the YAML library to properly format the entire config
    const yamlContent = YAML.stringify(config, { lineWidth: -1 });

    // Add header comment
    const header =
        '# Saiki Agent Configuration\n# Generated on ' + new Date().toISOString() + '\n\n';

    return header + yamlContent;
}
