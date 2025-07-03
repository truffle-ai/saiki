import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import * as YAML from 'yaml';
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

const AGENTS_DIR = 'agents';
const DEFAULT_SYSTEM_PROMPT =
    'You are a helpful AI assistant with access to tools. Use these tools when appropriate to answer user queries. You can use multiple tools in sequence to solve complex problems.';

export interface UpdateCommandOptions {
    /** Whether to save the configuration after creation */
    save?: boolean;
    /** Output path for the configuration file */
    output?: string;
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
        p.intro(chalk.inverse(' Update Agent Configuration '));

        let selectedConfigId = configId;
        let baseConfig: AgentConfig | undefined;
        let configName: string | undefined;

        // If no config ID provided, show interactive selection
        if (!selectedConfigId) {
            const configurations = await configManager.listConfigurations();

            if (configurations.length === 0) {
                p.note('No saved configurations found to update.', 'Info');
                p.outro('Use `saiki config create` to create a new configuration.');
                return;
            }

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
            p.note(`Configuration '${selectedConfigId}' not found.`, 'Error');
            return;
        }

        baseConfig = loaded.config;
        configName = loaded.name;
        p.note(`Loaded configuration: ${loaded.name}`, 'Base Configuration');

        p.note(
            '💡 Updating existing configuration. Use Ctrl+C to cancel or continue with prompts',
            'Navigation'
        );

        // Interactive configuration builder (no quick mode for updates)
        const config = await buildAgentConfiguration(baseConfig);

        // ───────────────── Summary Preview ─────────────────
        const summaryLines = [
            chalk.cyanBright.bold('─ Configuration Preview ─'),
            `LLM         : ${config.llm.provider} / ${config.llm.model}`,
            `MCP Servers : ${Object.keys(config.mcpServers || {}).join(', ') || 'none'}`,
            `SystemPrompt: ${typeof config.systemPrompt === 'string' ? (config.systemPrompt as string).slice(0, 60) + '…' : '[object]'}`,
        ];
        p.note(summaryLines.join('\n'), 'Preview');

        // Handle configuration output
        await handleConfigurationOutput(
            configManager,
            config,
            options,
            configName,
            selectedConfigId
        );

        p.outro(chalk.greenBright('Configuration updated successfully! 🎉'));
    } catch (error) {
        if (p.isCancel(error)) {
            p.cancel('Update cancelled');
            process.exit(0);
        }

        logger.error(`Configuration update failed: ${error}`);
        p.outro(chalk.red('Update failed. Check the logs for details.'));
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
    // For updates, ask about save and export separately
    const shouldSave = await p.confirm({
        message: 'Update the saved configuration?',
        initialValue: true,
    });
    if (p.isCancel(shouldSave)) process.exit(0);

    const shouldExport = await p.confirm({
        message: 'Export updated configuration to YAML file?',
        initialValue: true,
    });
    if (p.isCancel(shouldExport)) process.exit(0);

    // Handle saving to manager
    if (shouldSave) {
        const success = await configManager.updateConfiguration(configId, { config });
        if (success) {
            p.note(`Configuration updated successfully`, 'Updated');
        } else {
            p.note(`Failed to update configuration`, 'Error');
        }
    }

    // Handle YAML export
    if (shouldExport) {
        const finalOutputPath = await resolveOutputPath(options.output, configName);
        const yamlContent = formatConfigAsYaml(config);
        await fs.writeFile(finalOutputPath, yamlContent);
        p.note(`Configuration exported to: ${finalOutputPath}`, 'Exported');
    }
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

/**
 * Generates a sanitized, URL-friendly filename for an agent configuration.
 */
function generateAgentFilename(name: string): string {
    return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.yml`;
}

/**
 * Resolves the final output path for the configuration file.
 * Creates the 'agents' directory if it doesn't exist.
 */
async function resolveOutputPath(outputPath?: string, configName?: string): Promise<string> {
    if (outputPath) {
        return path.resolve(outputPath);
    }

    const agentsDir = path.resolve(AGENTS_DIR);
    await fs.mkdir(agentsDir, { recursive: true }).catch(() => {}); // Ignore if exists

    if (configName) {
        return path.join(agentsDir, generateAgentFilename(configName));
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    return path.join(agentsDir, `agent-updated-${timestamp}.yml`);
}
