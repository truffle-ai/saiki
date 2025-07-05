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

export interface CreateCommandOptions {
    /** Whether to save the configuration after creation */
    save?: boolean;
    /** Output path for the configuration file */
    output?: string;
    /** Quick path (minimal prompts) */
    quick?: boolean;

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

    // System Prompt Configuration
    systemPrompt?: string;
    promptType?: string;
    specialistRole?: string;

    // Metadata
    name?: string;
    description?: string;
}

/**
 * Main command for creating and configuring an agent.
 * Supports both interactive and non-interactive (flag-based) modes.
 */
export async function createCommand(options: CreateCommandOptions = {}): Promise<void> {
    const configManager = new ConfigurationManager();

    try {
        // Check if we have enough flags for non-interactive mode
        const isNonInteractive = hasNonInteractiveFlags(options);

        let config: AgentConfig;

        if (isNonInteractive) {
            // Non-interactive mode: build config from flags
            config = await buildConfigFromFlags(options);

            // Show a brief summary for non-interactive mode
            logger.info(`Creating configuration: ${config.llm.provider}/${config.llm.model}`);
        } else {
            // Interactive mode: use prompts
            p.intro(chalk.inverse(' Create Agent Configuration '));

            p.note(
                '💡 Creating new configuration. Use Ctrl+C to cancel or follow prompts to build your agent',
                'Navigation'
            );

            config = await buildAgentConfiguration(options.quick);

            // ───────────────── Summary Preview ─────────────────
            const summaryLines = [
                chalk.cyanBright.bold('─ Configuration Preview ─'),
                `LLM         : ${config.llm.provider} / ${config.llm.model}`,
                `MCP Servers : ${Object.keys(config.mcpServers || {}).join(', ') || 'none'}`,
                `SystemPrompt: ${typeof config.systemPrompt === 'string' ? (config.systemPrompt as string).slice(0, 60) + '…' : '[object]'}`,
            ];
            p.note(summaryLines.join('\n'), 'Preview');
        }

        // Save or output the configuration
        await handleConfigurationOutput(configManager, config, options);

        if (isNonInteractive) {
            logger.info('Configuration created successfully! 🎉');
        } else {
            p.outro(chalk.greenBright('Configuration complete! 🎉'));
        }
    } catch (error) {
        if (p.isCancel(error)) {
            p.cancel('Configuration cancelled');
            process.exit(0);
        }

        logger.error(`Configuration failed: ${error}`);
        if (!hasNonInteractiveFlags(options)) {
            p.outro(chalk.red('Configuration failed. Check the logs for details.'));
        }
        process.exit(1);
    }
}

/**
 * Check if we have enough flags for non-interactive mode
 */
function hasNonInteractiveFlags(options: CreateCommandOptions): boolean {
    // At minimum, we need a provider to run non-interactively
    return !!options.provider;
}

/**
 * Build configuration from command line flags (non-interactive mode)
 */
async function buildConfigFromFlags(options: CreateCommandOptions): Promise<AgentConfig> {
    if (!options.provider) {
        throw new Error('Provider is required for non-interactive mode');
    }

    const provider = options.provider as LLMProvider;
    const model = options.llmModel || getDefaultModelForProvider(provider) || 'gpt-4o-mini';

    // Handle API key configuration
    let apiKey: string;
    if (options.apiKey) {
        apiKey = options.apiKey;
    } else if (options.envVar) {
        apiKey = `$${options.envVar}`;
    } else {
        // Default to standard environment variable
        apiKey = `$${getPrimaryApiKeyEnvVar(provider)}`;
    }

    // Build LLM config
    const llmConfig: any = {
        provider,
        model,
        apiKey,
    };

    // Add optional LLM settings
    if (options.baseUrl) llmConfig.baseUrl = options.baseUrl;
    if (options.temperature !== undefined) llmConfig.temperature = options.temperature;
    if (options.maxIterations !== undefined) llmConfig.maxIterations = options.maxIterations;

    // Handle MCP servers
    let mcpServers: Record<string, McpServerConfig> = {};
    if (options.noMcp || options.mcp === false) {
        mcpServers = {};
    } else if (options.mcpPreset) {
        mcpServers = await getPresetServers(options.mcpPreset);
    } else if (options.mcpServers) {
        mcpServers = await getMcpServersFromIds(options.mcpServers.split(',').map((s) => s.trim()));
    } else {
        // Default to essential preset if no MCP options specified
        mcpServers = await getPresetServers('essential');
    }

    // Handle system prompt
    let systemPrompt: string | object = DEFAULT_SYSTEM_PROMPT;
    if (options.systemPrompt) {
        systemPrompt = options.systemPrompt;
    } else if (options.promptType) {
        systemPrompt = await getSystemPromptByType(options.promptType, options.specialistRole);
    }

    const config: AgentConfig = {
        systemPrompt,
        mcpServers,
        llm: llmConfig,
    } as AgentConfig;

    return config;
}

/**
 * Interactive agent configuration builder
 */
async function buildAgentConfiguration(quick?: boolean): Promise<AgentConfig> {
    let useQuickMode = quick;

    // If --quick flag wasn't provided, ask the user interactively
    if (useQuickMode === undefined) {
        const quickModeChoice = await p.confirm({
            message: 'Use quick setup with defaults? (Recommended for new users)',
            initialValue: true,
        });
        if (p.isCancel(quickModeChoice)) {
            p.cancel('Configuration cancelled.');
            process.exit(0);
        }
        useQuickMode = quickModeChoice;
    }

    // Quick path: skip most prompts, generate sensible defaults
    if (useQuickMode) {
        const provider: LLMProvider = 'openai';
        const model = getDefaultModelForProvider(provider) || 'gpt-4o-mini';
        const envVar = getPrimaryApiKeyEnvVar(provider);

        const quickConfig: AgentConfig = {
            systemPrompt: DEFAULT_SYSTEM_PROMPT,
            mcpServers: await getPresetServers('essential'),
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
            // LLM Configuration
            llmProvider: () => {
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

            // API Key handling
            apiKeyOption: ({ results }) => {
                const provider = results.llmProvider as LLMProvider;
                const envVar = getPrimaryApiKeyEnvVar(provider);

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
                    initialValues: [],
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

            // System Prompt - ask if they want to customize
            systemPromptConfig: () => {
                return p.confirm({
                    message: 'Customize the system prompt?',
                    initialValue: false,
                });
            },

            systemPrompt: async ({ results }) => {
                if (!results.systemPromptConfig) {
                    return DEFAULT_SYSTEM_PROMPT;
                }

                return await configureSystemPrompt();
            },
        },
        {
            onCancel: () => {
                p.cancel('Configuration cancelled.');
                process.exit(0);
            },
        }
    );

    // Build the configuration object
    const provider = answers.llmProvider as LLMProvider;
    const envVar = getPrimaryApiKeyEnvVar(provider);

    let apiKey: string;
    if (answers.apiKeyOption === 'enter' && typeof answers.apiKey === 'string') {
        apiKey = answers.apiKey;
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
async function configureSystemPrompt(): Promise<string | object> {
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
    const customPrompt = await p.text({
        message: 'Enter your custom system prompt',
        placeholder: 'You are a helpful AI assistant...',
    });

    return customPrompt as string;
}

/**
 * Handle configuration output (save or write to file)
 */
async function handleConfigurationOutput(
    configManager: ConfigurationManager,
    config: AgentConfig,
    options: CreateCommandOptions
): Promise<void> {
    let finalConfigName: string | undefined;
    let shouldSave = options.save !== false; // Default to true unless explicitly false
    let shouldExport = true; // Always export YAML

    if (options.save === false) {
        shouldSave = false;
        shouldExport = true; // --no-save implies we still want the file
    } else {
        // For new configs, ask about both together
        const saveAndExportResult = await p.confirm({
            message: 'Save this configuration for later reuse and export to YAML?',
            initialValue: true,
        });
        if (p.isCancel(saveAndExportResult)) process.exit(0);

        if (saveAndExportResult) {
            shouldSave = true;
            shouldExport = true;
        } else {
            // If they don't want to save, ask if they still want YAML export
            const exportOnlyResult = await p.confirm({
                message: 'Export configuration to YAML file anyway?',
                initialValue: false, // Default to false if they said no to saving
            });
            if (p.isCancel(exportOnlyResult)) process.exit(0);
            shouldSave = false;
            shouldExport = exportOnlyResult;
        }
    }

    // Handle saving to manager
    if (shouldSave) {
        const name = (await p.text({
            message: 'Configuration name',
            placeholder: 'My Agent Configuration',
        })) as string;
        finalConfigName = name;

        const description = (await p.text({
            message: 'Description (optional)',
            placeholder: 'What this agent is designed to do',
        })) as string;

        const configId = await configManager.saveConfiguration(name, description || '', config, []);
        p.note(`Configuration saved with ID: ${configId}`, 'Saved');
    }

    // Handle YAML export
    if (shouldExport) {
        const finalOutputPath = await resolveOutputPath(
            options.output,
            finalConfigName,
            !shouldSave
        );
        const yamlContent = await formatConfigAsYaml(config);
        await fs.writeFile(finalOutputPath, yamlContent);
        p.note(`Configuration exported to: ${finalOutputPath}`, 'Exported');
    }
}
