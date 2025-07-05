import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { Command } from 'commander';
import { getAllMcpServers } from '@core/config/mcp-registry.js';
import { logger } from '@core/index.js';
import type { AgentConfig, McpServerConfig } from '@core/config/schemas.js';
import type { SavedConfiguration } from '@core/config/config-manager.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const AGENTS_DIR = 'agents';
export const DEFAULT_SYSTEM_PROMPT =
    'You are a helpful AI assistant with access to tools. Use these tools when appropriate to answer user queries. You can use multiple tools in sequence to solve complex problems.';

// ═══════════════════════════════════════════════════════════════════════════════
// FLAG DEFINITIONS AND COMMAND BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Shared flag definitions to avoid duplication across config commands
 */
export const FLAG_DEFINITIONS = {
    // Basic options
    save: { flag: '--save', description: 'Save the configuration for later use', default: true },
    noSave: { flag: '--no-save', description: 'Do not save the configuration' },
    output: { flag: '-o, --output <path>', description: 'Output configuration file path' },

    // LLM Configuration
    provider: {
        flag: '--provider <provider>',
        description: 'LLM provider (openai, anthropic, google, groq)',
    },
    model: { flag: '--llm-model <model>', description: 'LLM model name' },
    apiKey: {
        flag: '--api-key <key>',
        description: 'API key (not recommended, use environment variables)',
    },
    envVar: { flag: '--env-var <var>', description: 'Environment variable name for API key' },
    baseUrl: {
        flag: '--base-url <url>',
        description: 'Custom base URL for LLM provider (OpenAI only)',
    },
    maxIterations: {
        flag: '--max-iterations <num>',
        description: 'Maximum iterations for agentic loops',
        default: '50',
    },
    temperature: {
        flag: '--temperature <temp>',
        description: 'Temperature for response randomness (0-1)',
        parser: parseFloat,
    },

    // MCP Server Configuration
    mcpPreset: {
        flag: '--mcp-preset <preset>',
        description: 'MCP server preset (essential, developer, productivity, data)',
    },
    mcpServers: {
        flag: '--mcp-servers <servers>',
        description: 'Comma-separated list of MCP server IDs',
    },
    noMcp: { flag: '--no-mcp', description: 'Skip MCP server configuration' },

    // System Prompt Configuration
    systemPrompt: { flag: '--system-prompt <prompt>', description: 'Custom system prompt text' },
    promptType: {
        flag: '--prompt-type <type>',
        description: 'System prompt type (default, specialist, custom)',
    },
    specialistRole: {
        flag: '--specialist-role <role>',
        description: 'Specialist role (developer, writer, analyst, manager)',
    },

    // Metadata
    name: { flag: '--name <name>', description: 'Configuration name for saving' },
    description: { flag: '--description <desc>', description: 'Configuration description' },

    // Update-specific options
    addMcpServers: {
        flag: '--add-mcp-servers <servers>',
        description: 'Add comma-separated list of MCP server IDs',
    },
    removeMcpServers: {
        flag: '--remove-mcp-servers <servers>',
        description: 'Remove comma-separated list of MCP server IDs',
    },
    clearMcp: { flag: '--clear-mcp', description: 'Remove all MCP servers' },

    // Output formatting
    format: { flag: '--format <format>', description: 'Output format' },
    verbose: { flag: '--verbose', description: 'Show detailed information' },
    minify: { flag: '--minify', description: 'Minify the output' },
    strict: { flag: '--strict', description: 'Enable strict validation mode' },
    force: { flag: '--force', description: 'Skip confirmation prompt' },
    all: { flag: '--all', description: 'Apply to all configurations' },
};

/**
 * Add LLM configuration flags to a command
 */
export function addLlmOptions(cmd: Command): Command {
    return cmd
        .option(FLAG_DEFINITIONS.provider.flag, FLAG_DEFINITIONS.provider.description)
        .option(FLAG_DEFINITIONS.model.flag, FLAG_DEFINITIONS.model.description)
        .option(FLAG_DEFINITIONS.apiKey.flag, FLAG_DEFINITIONS.apiKey.description)
        .option(FLAG_DEFINITIONS.envVar.flag, FLAG_DEFINITIONS.envVar.description)
        .option(FLAG_DEFINITIONS.baseUrl.flag, FLAG_DEFINITIONS.baseUrl.description)
        .option(
            FLAG_DEFINITIONS.maxIterations.flag,
            FLAG_DEFINITIONS.maxIterations.description,
            FLAG_DEFINITIONS.maxIterations.default
        )
        .option(
            FLAG_DEFINITIONS.temperature.flag,
            FLAG_DEFINITIONS.temperature.description,
            FLAG_DEFINITIONS.temperature.parser
        );
}

/**
 * Add MCP server configuration flags to a command
 */
export function addMcpOptions(cmd: Command): Command {
    return cmd
        .option(FLAG_DEFINITIONS.mcpPreset.flag, FLAG_DEFINITIONS.mcpPreset.description)
        .option(FLAG_DEFINITIONS.mcpServers.flag, FLAG_DEFINITIONS.mcpServers.description)
        .option(FLAG_DEFINITIONS.noMcp.flag, FLAG_DEFINITIONS.noMcp.description);
}

/**
 * Add system prompt configuration flags to a command
 */
export function addPromptOptions(cmd: Command): Command {
    return cmd
        .option(FLAG_DEFINITIONS.systemPrompt.flag, FLAG_DEFINITIONS.systemPrompt.description)
        .option(FLAG_DEFINITIONS.promptType.flag, FLAG_DEFINITIONS.promptType.description)
        .option(FLAG_DEFINITIONS.specialistRole.flag, FLAG_DEFINITIONS.specialistRole.description);
}

/**
 * Add metadata flags to a command
 */
export function addMetadataOptions(cmd: Command): Command {
    return cmd
        .option(FLAG_DEFINITIONS.name.flag, FLAG_DEFINITIONS.name.description)
        .option(FLAG_DEFINITIONS.description.flag, FLAG_DEFINITIONS.description.description);
}

/**
 * Add update-specific MCP server management flags
 */
export function addUpdateMcpOptions(cmd: Command): Command {
    return cmd
        .option(FLAG_DEFINITIONS.addMcpServers.flag, FLAG_DEFINITIONS.addMcpServers.description)
        .option(
            FLAG_DEFINITIONS.removeMcpServers.flag,
            FLAG_DEFINITIONS.removeMcpServers.description
        )
        .option(FLAG_DEFINITIONS.clearMcp.flag, FLAG_DEFINITIONS.clearMcp.description);
}

/**
 * Add output formatting flags to a command
 */
export function addFormatOptions(
    cmd: Command,
    defaultFormat = 'table',
    formats = ['table', 'json', 'yaml']
): Command {
    return cmd
        .option(
            FLAG_DEFINITIONS.format.flag,
            `${FLAG_DEFINITIONS.format.description} (${formats.join(', ')})`,
            defaultFormat
        )
        .option(FLAG_DEFINITIONS.verbose.flag, FLAG_DEFINITIONS.verbose.description)
        .option(FLAG_DEFINITIONS.minify.flag, FLAG_DEFINITIONS.minify.description);
}

/**
 * Parse numeric options and validate conflicts
 */
export function parseAndValidateOptions(options: any): any {
    const parsed = { ...options };

    // Parse numeric values
    if (parsed.temperature !== undefined) {
        parsed.temperature = parseFloat(parsed.temperature);
        if (isNaN(parsed.temperature) || parsed.temperature < 0 || parsed.temperature > 2) {
            throw new Error('Temperature must be a number between 0 and 2');
        }
    }

    if (parsed.maxIterations !== undefined) {
        parsed.maxIterations = parseInt(parsed.maxIterations, 10);
        if (isNaN(parsed.maxIterations) || parsed.maxIterations < 1) {
            throw new Error('Max iterations must be a positive integer');
        }
    }

    // Validate conflicts
    if (parsed.apiKey && parsed.envVar) {
        throw new Error('Cannot specify both --api-key and --env-var');
    }

    if (parsed.mcpPreset && parsed.mcpServers) {
        throw new Error('Cannot specify both --mcp-preset and --mcp-servers');
    }

    if (parsed.all && !parsed.force) {
        throw new Error('--all flag requires --force to confirm');
    }

    return parsed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MCP SERVER UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get MCP servers by their IDs
 */
export async function getMcpServersFromIds(
    ids: string[]
): Promise<Record<string, McpServerConfig>> {
    const allServers = await getAllMcpServers();
    const selectedServers: Record<string, McpServerConfig> = {};

    for (const id of ids) {
        const server = allServers.find((s) => s.id === id);
        if (server) {
            selectedServers[server.id] = server.config;
        } else {
            logger.warn(`MCP server '${id}' not found, skipping`);
        }
    }

    return selectedServers;
}

/**
 * Get preset server configurations
 */
export async function getPresetServers(preset: string): Promise<Record<string, McpServerConfig>> {
    const presets = {
        essential: ['filesystem', 'puppeteer'],
        developer: ['filesystem', 'puppeteer', 'github', 'terminal'],
        productivity: ['filesystem', 'puppeteer', 'notion', 'slack'],
        data: ['filesystem', 'sqlite', 'postgres'],
    };

    const serverIds = presets[preset as keyof typeof presets] || [];
    const servers: Record<string, McpServerConfig> = {};

    const allServers = await getAllMcpServers();
    const serverMap = Object.fromEntries(allServers.map((s) => [s.id, s]));

    for (const id of serverIds) {
        const server = serverMap[id];
        if (server) {
            servers[id] = server.config;
        }
    }

    return servers;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get system prompt by type
 */
export async function getSystemPromptByType(type: string, role?: string): Promise<string> {
    switch (type) {
        case 'specialist':
            return getSpecialistPrompt(role);
        case 'custom':
            return DEFAULT_SYSTEM_PROMPT; // Will be handled by interactive prompt
        default:
            return DEFAULT_SYSTEM_PROMPT;
    }
}

/**
 * Get specialist system prompt
 */
export function getSpecialistPrompt(role?: string): string {
    const prompts = {
        developer:
            'You are an expert software developer with deep knowledge of programming languages, frameworks, and best practices. Help users with coding tasks, debugging, architecture decisions, and technical problem-solving.',
        writer: 'You are a skilled writer and editor with expertise in various writing styles and formats. Help users with content creation, editing, proofreading, and writing improvement.',
        analyst:
            'You are a data analyst and researcher with strong analytical skills. Help users with data analysis, research, insights generation, and evidence-based decision making.',
        manager:
            'You are an experienced project manager and team leader. Help users with project planning, team coordination, process optimization, and strategic decision making.',
    };

    return prompts[role as keyof typeof prompts] || DEFAULT_SYSTEM_PROMPT;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE AND PATH UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Dynamically import YAML to avoid bundling it when not needed
 */
async function loadYaml() {
    try {
        return await import('yaml');
    } catch (_error) {
        throw new Error('Failed to load YAML module. Please install yaml dependency.');
    }
}

/**
 * Format configuration as YAML
 */
export async function formatConfigAsYaml(config: AgentConfig): Promise<string> {
    const YAML = await loadYaml();
    const yamlContent = YAML.stringify(config, { lineWidth: -1 });

    // Add header comment
    const header =
        '# Saiki Agent Configuration\n# Generated on ' + new Date().toISOString() + '\n\n';

    return header + yamlContent;
}

/**
 * Generates a sanitized, URL-friendly filename for an agent configuration.
 */
export function generateAgentFilename(name: string): string {
    return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.yml`;
}

/**
 * Resolves the final output path for the configuration file.
 * Creates the 'agents' directory if it doesn't exist.
 */
export async function resolveOutputPath(
    outputPath: string | undefined,
    configName?: string,
    isUnsaved: boolean = false
): Promise<string> {
    if (outputPath) {
        return path.resolve(outputPath);
    }

    const agentsDir = path.resolve(AGENTS_DIR);
    await fs.mkdir(agentsDir, { recursive: true }).catch((error) => {
        // Only ignore EEXIST errors, log others
        if (error.code !== 'EEXIST') {
            logger.warn(`Failed to create agents directory: ${error.message}`);
        }
    });

    if (configName) {
        return path.join(agentsDir, generateAgentFilename(configName));
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const prefix = isUnsaved ? 'agent-unsaved' : 'agent';
    return path.join(agentsDir, `${prefix}-${timestamp}.yml`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// OUTPUT FORMATTING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format a single configuration for output
 */
export async function formatConfigOutput(
    config: SavedConfiguration,
    options: {
        format?: 'yaml' | 'json' | 'table';
        minify?: boolean;
        verbose?: boolean;
    } = {}
): Promise<string> {
    const { format = 'yaml', minify = false, verbose = false } = options;

    switch (format) {
        case 'json': {
            const jsonData = {
                id: config.id,
                name: config.name,
                description: config.description,
                createdAt: config.createdAt,
                tags: config.tags,
                config: config.config,
                ...(verbose && {
                    updatedAt: config.updatedAt,
                }),
            };
            return JSON.stringify(jsonData, null, minify ? 0 : 2);
        }

        case 'table': {
            let output = '';
            output += chalk.bold.cyan(`Configuration: ${config.name}\n`);
            output += chalk.dim(`ID: ${config.id}\n`);
            output += chalk.dim(`Description: ${config.description || 'No description'}\n`);
            output += chalk.dim(`Created: ${new Date(config.createdAt).toLocaleDateString()}\n`);

            if (verbose && config.updatedAt) {
                output += chalk.dim(
                    `Updated: ${new Date(config.updatedAt).toLocaleDateString()}\n`
                );
            }

            output += '\n';

            // LLM Configuration
            output += chalk.bold('LLM Configuration:\n');
            output += `  Provider: ${config.config.llm.provider}\n`;
            output += `  Model: ${config.config.llm.model}\n`;

            if (config.config.llm.temperature !== undefined) {
                output += `  Temperature: ${config.config.llm.temperature}\n`;
            }

            if (config.config.llm.maxIterations !== undefined) {
                output += `  Max Iterations: ${config.config.llm.maxIterations}\n`;
            }

            output += '\n';

            // MCP Servers
            const mcpServers = config.config.mcpServers || {};
            const serverCount = Object.keys(mcpServers).length;
            output += chalk.bold('MCP Servers:\n');

            if (serverCount === 0) {
                output += '  None configured\n';
            } else {
                output += `  Count: ${serverCount}\n`;
                Object.keys(mcpServers).forEach((serverId) => {
                    output += `  - ${serverId}\n`;
                });
            }

            return output;
        }

        case 'yaml':
        default: {
            const YAML = await loadYaml();
            const yamlData = {
                id: config.id,
                name: config.name,
                description: config.description,
                createdAt: config.createdAt,
                tags: config.tags,
                config: config.config,
                ...(verbose && {
                    updatedAt: config.updatedAt,
                }),
            };
            return YAML.stringify(yamlData);
        }
    }
}

/**
 * Format a list of configurations for output
 */
export async function formatConfigListOutput(
    configurations: Omit<SavedConfiguration, 'config'>[],
    options: {
        format?: 'table' | 'json' | 'yaml';
        verbose?: boolean;
    } = {}
): Promise<string> {
    const { format = 'table', verbose = false } = options;

    if (configurations.length === 0) {
        switch (format) {
            case 'json':
                return JSON.stringify([]);
            case 'yaml': {
                const YAML = await loadYaml();
                return YAML.stringify([]);
            }
            case 'table':
            default:
                return 'No configurations found.';
        }
    }

    switch (format) {
        case 'json': {
            const jsonData = configurations.map((config) => ({
                id: config.id,
                name: config.name,
                description: config.description,
                createdAt: config.createdAt,
                tags: config.tags,
                ...(verbose && {
                    updatedAt: config.updatedAt,
                }),
            }));
            return JSON.stringify(jsonData, null, 2);
        }

        case 'yaml': {
            const YAML = await loadYaml();
            const yamlData = configurations.map((config) => ({
                id: config.id,
                name: config.name,
                description: config.description,
                createdAt: config.createdAt,
                tags: config.tags,
                ...(verbose && {
                    updatedAt: config.updatedAt,
                }),
            }));
            return YAML.stringify(yamlData);
        }

        case 'table':
        default: {
            let output = '';
            configurations.forEach((config, index) => {
                if (index > 0) output += '\n';

                output += chalk.bold(`${config.name} [${config.id}]\n`);
                output += chalk.dim(`  ${config.description || 'No description'}\n`);

                const createdDate = new Date(config.createdAt).toLocaleDateString();
                output += chalk.dim(`  Created: ${createdDate}\n`);

                if (verbose && config.updatedAt) {
                    const updatedDate = new Date(config.updatedAt).toLocaleDateString();
                    output += chalk.dim(`  Updated: ${updatedDate}\n`);
                }
            });
            return output;
        }
    }
}

/**
 * Format an agent config (without metadata) for export
 */
export async function formatAgentConfigOutput(
    config: AgentConfig,
    options: {
        format?: 'yaml' | 'json';
        minify?: boolean;
    } = {}
): Promise<string> {
    const { format = 'yaml', minify = false } = options;

    switch (format) {
        case 'json':
            return JSON.stringify(config, null, minify ? 0 : 2);
        case 'yaml':
        default: {
            const YAML = await loadYaml();
            return YAML.stringify(config);
        }
    }
}
