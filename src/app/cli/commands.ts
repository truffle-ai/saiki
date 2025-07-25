/**
 * CLI Commands Module
 *
 * This module defines all available slash commands for the Saiki CLI interface.
 * Commands provide system control and agent management functionality.
 *
 * Available Commands:
 *
 * GENERAL:
 * - /help [command] - Show help information (redirects to contextual help for major commands)
 * - /exit, /quit, /q - Exit the CLI application
 * - /clear, /reset - Clear conversation history for current session
 * - /history [sessionId], /hist - Show conversation history (current or specified session)
 * - /search <query> [options], /find - Search conversation history across all sessions
 *
 * SESSION MANAGEMENT:
 * - /session, /s - Manage chat sessions (defaults to help)
 *   - /session help - Show detailed help for session commands
 *   - /session list - List all available sessions with metadata
 *   - /session new [id] - Create a new session with optional custom ID
 *   - /session switch <id> - Switch to a different session
 *   - /session current - Show current active session info
 *   - /session history [id], /session h - Show conversation history
 *   - /session delete <id> - Delete a session (cannot delete active session)
 *
 * MODEL MANAGEMENT:
 * - /model, /m - Manage AI models (defaults to help)
 *   - /model help - Show detailed help for model commands
 *   - /model list - List all supported providers and models
 *   - /model current - Show current model configuration
 *   - /model switch <model> - Switch to a different model (provider auto-detected)
 *
 * MCP MANAGEMENT:
 * - /mcp, /mc - Manage MCP servers (defaults to help)
 *   - /mcp help - Show detailed help for MCP commands
 *   - /mcp list - List all available MCP servers
 *   - /mcp add <name> <type> <config> - Add a new MCP server
 *   - /mcp remove <name> - Remove an MCP server
 *
 * SYSTEM CONFIGURATION:
 * - /log [level] - Set or view current log level
 *   Available levels: error, warn, info, http, verbose, debug, silly
 * - /config - Show current agent configuration (LLM, sessions, MCP servers)
 * - /stats - Show system statistics (sessions, MCP servers, tools)
 *
 * TOOL MANAGEMENT:
 * - /tools - List all available MCP tools with descriptions
 *
 * PROMPT MANAGEMENT
 * - /prompt - Display the current system prompt
 *
 * Usage:
 * - Commands start with '/' followed by the command name
 * - Arguments are space-separated
 * - Commands with subcommands default to a primary action if no subcommand given
 * - Use contextual help for detailed guidance (e.g., /session help, /model help)
 * - /help redirects to contextual help for major command groups
 */

import chalk from 'chalk';
import { logger } from '@core/index.js';
import { SaikiAgent } from '@core/index.js';
import { CommandDefinition, formatCommandHelp, displayAllCommands } from './command-parser.js';
import type { SessionMetadata } from '@core/index.js';

/**
 * Helper to format session information consistently
 */
function formatSessionInfo(
    sessionId: string,
    metadata?: SessionMetadata,
    isCurrent: boolean = false
): string {
    const prefix = isCurrent ? chalk.green('→') : ' ';
    const name = isCurrent ? chalk.green.bold(sessionId) : chalk.cyan(sessionId);

    let info = `${prefix} ${name}`;

    if (metadata) {
        const messages = metadata.messageCount || 0;
        const activity = metadata.lastActivity
            ? new Date(metadata.lastActivity).toLocaleString()
            : 'Never';

        info += chalk.dim(` (${messages} messages, last: ${activity})`);

        if (isCurrent) {
            info += chalk.yellow(' [ACTIVE]');
        }
    }

    return info;
}

/**
 * Helper to get current session info
 */
async function getCurrentSessionInfo(
    agent: SaikiAgent
): Promise<{ id: string; metadata: SessionMetadata | undefined }> {
    const currentId = agent.getCurrentSessionId();
    const metadata = await agent.getSessionMetadata(currentId);
    return { id: currentId, metadata };
}

/**
 * Helper to display session history with consistent formatting
 */
async function displaySessionHistory(sessionId: string, agent: SaikiAgent): Promise<void> {
    console.log(chalk.blue(`\n💬 Conversation History for: ${chalk.bold(sessionId)}\n`));

    const history = await agent.getSessionHistory(sessionId);

    if (history.length === 0) {
        console.log(chalk.dim('  No messages in this conversation yet.\n'));
        return;
    }

    // Display each message with formatting
    history.forEach((message, index) => {
        console.log(formatHistoryMessage(message, index));
    });

    console.log(chalk.dim(`\n  Total: ${history.length} messages`));
    console.log(
        chalk.dim('  💡 Use /clear to reset conversation or /session switch to change sessions\n')
    );
}

/**
 * Helper to format conversation history
 */
function formatHistoryMessage(message: any, index: number): string {
    const timestamp = message.timestamp
        ? new Date(message.timestamp).toLocaleTimeString()
        : `#${index + 1}`;

    let roleColor = chalk.dim;
    let roleLabel = message.role;

    switch (message.role) {
        case 'user':
            roleColor = chalk.blue;
            roleLabel = 'You';
            break;
        case 'assistant':
            roleColor = chalk.green;
            roleLabel = 'Assistant';
            break;
        case 'system':
            roleColor = chalk.yellow;
            roleLabel = 'System';
            break;
        case 'tool':
            roleColor = chalk.magenta;
            roleLabel = 'Tool';
            break;
    }

    // Handle content formatting
    let content = '';
    if (typeof message.content === 'string') {
        content = message.content;
    } else if (Array.isArray(message.content)) {
        // Handle multimodal content
        content = message.content
            .map((part: any) => {
                if (part.type === 'text') return part.text;
                if (part.type === 'image') return '[Image]';
                return '[Unknown content]';
            })
            .join(' ');
    } else {
        content = '[No content]';
    }

    // Truncate very long messages
    if (content.length > 200) {
        content = content.substring(0, 200) + '...';
    }

    // Format tool calls if present
    let toolInfo = '';
    if (message.toolCalls && message.toolCalls.length > 0) {
        const toolNames = message.toolCalls
            .map((tc: any) => tc.function?.name || 'unknown')
            .join(', ');
        toolInfo = chalk.dim(` [Tools: ${toolNames}]`);
    }

    return `  ${chalk.dim(timestamp)} ${roleColor.bold(roleLabel)}: ${content}${toolInfo}`;
}

/**
 * Session management commands
 */
const sessionCommands: CommandDefinition = {
    name: 'session',
    description: 'Manage chat sessions',
    usage: '/session <subcommand> [args]',
    category: 'Session Management',
    aliases: ['s'],
    subcommands: [
        {
            name: 'list',
            description: 'List all sessions',
            usage: '/session list',
            handler: async (args: string[], agent: SaikiAgent) => {
                try {
                    console.log(chalk.bold.blue('\n📋 Sessions:\n'));

                    const sessionIds = await agent.listSessions();
                    const current = await getCurrentSessionInfo(agent);

                    if (sessionIds.length === 0) {
                        console.log(
                            chalk.dim('  No sessions found. Use /session new to create one.\n')
                        );
                        return true;
                    }

                    for (const sessionId of sessionIds) {
                        const metadata = await agent.getSessionMetadata(sessionId);
                        const isCurrent = sessionId === current.id;
                        console.log('  ' + formatSessionInfo(sessionId, metadata, isCurrent));
                    }

                    console.log(chalk.dim(`\n  Total: ${sessionIds.length} sessions`));
                    console.log(chalk.dim('  💡 Use /session switch <id> to change sessions\n'));
                } catch (error) {
                    logger.error(
                        `Failed to list sessions: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
                return true;
            },
        },
        {
            name: 'new',
            description: 'Create a new session',
            usage: '/session new [id]',
            handler: async (args: string[], agent: SaikiAgent) => {
                try {
                    const sessionId = args[0]; // Optional custom ID
                    const session = await agent.createSession(sessionId);

                    console.log(chalk.green(`✅ Created new session: ${chalk.bold(session.id)}`));

                    // Switch to the new session
                    await agent.loadSession(session.id);
                    console.log(chalk.yellow(`🔄 Switched to new session`));
                } catch (error) {
                    logger.error(
                        `Failed to create session: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
                return true;
            },
        },
        {
            name: 'switch',
            description: 'Switch to a different session',
            usage: '/session switch <id>',
            handler: async (args: string[], agent: SaikiAgent) => {
                if (args.length === 0) {
                    console.log(chalk.red('❌ Session ID required. Usage: /session switch <id>'));
                    return true;
                }

                try {
                    const sessionId = args[0]!; // Safe to assert non-null since we checked args.length

                    await agent.loadSession(sessionId);

                    const metadata = await agent.getSessionMetadata(sessionId);
                    console.log(chalk.green(`✅ Switched to session: ${chalk.bold(sessionId)}`));

                    if (metadata && metadata.messageCount > 0) {
                        console.log(chalk.dim(`   ${metadata.messageCount} messages in history`));
                    } else {
                        console.log(chalk.dim('   New conversation - no previous messages'));
                    }
                } catch (error) {
                    logger.error(
                        `Failed to switch session: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
                return true;
            },
        },
        {
            name: 'current',
            description: 'Show current session',
            usage: '/session current',
            handler: async (args: string[], agent: SaikiAgent) => {
                try {
                    const current = await getCurrentSessionInfo(agent);
                    console.log(chalk.blue('\n📍 Current Session:\n'));
                    console.log('  ' + formatSessionInfo(current.id, current.metadata, true));
                    console.log();
                } catch (error) {
                    logger.error(
                        `Failed to get current session: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
                return true;
            },
        },
        {
            name: 'history',
            description: 'Show conversation history for current session',
            usage: '/session history [sessionId]',
            aliases: ['h'],
            handler: async (args: string[], agent: SaikiAgent) => {
                try {
                    // Use provided session ID or current session
                    const sessionId =
                        args.length > 0 && args[0] ? args[0] : agent.getCurrentSessionId();

                    await displaySessionHistory(sessionId, agent);
                } catch (error) {
                    if (error instanceof Error && error.message.includes('not found')) {
                        console.log(chalk.red(`❌ Session not found: ${args[0] || 'current'}`));
                        console.log(chalk.dim('   Use /session list to see available sessions'));
                    } else {
                        logger.error(
                            `Failed to get session history: ${error instanceof Error ? error.message : String(error)}`
                        );
                    }
                }
                return true;
            },
        },
        {
            name: 'delete',
            description: 'Delete a session',
            usage: '/session delete <id>',
            handler: async (args: string[], agent: SaikiAgent) => {
                if (args.length === 0) {
                    console.log(chalk.red('❌ Session ID required. Usage: /session delete <id>'));
                    return true;
                }

                try {
                    const sessionId = args[0]!; // Safe to assert non-null since we checked args.length

                    const current = await getCurrentSessionInfo(agent);

                    // Check if trying to delete current session
                    if (sessionId === current.id) {
                        console.log(
                            chalk.yellow('⚠️  Cannot delete the currently active session.')
                        );
                        console.log(
                            chalk.dim('   Switch to another session first, then delete this one.')
                        );
                        return true;
                    }

                    await agent.deleteSession(sessionId);
                    console.log(chalk.green(`✅ Deleted session: ${chalk.bold(sessionId)}`));
                } catch (error) {
                    logger.error(
                        `Failed to delete session: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
                return true;
            },
        },
        {
            name: 'help',
            description: 'Show detailed help for session commands',
            usage: '/session help',
            handler: async (_args: string[], _agent: SaikiAgent) => {
                console.log(chalk.bold.blue('\n📋 Session Management Commands:\n'));

                console.log(chalk.cyan('Available subcommands:'));
                console.log(
                    `  ${chalk.yellow('/session list')} - List all sessions with their status and activity`
                );
                console.log(
                    `  ${chalk.yellow('/session new')} ${chalk.blue('[name]')} - Create a new session (optional custom name)`
                );
                console.log(
                    `  ${chalk.yellow('/session switch')} ${chalk.blue('<id>')} - Switch to a different session`
                );
                console.log(
                    `  ${chalk.yellow('/session current')} - Show current session info and message count`
                );
                console.log(
                    `  ${chalk.yellow('/session history')} - Display conversation history for current session`
                );
                console.log(
                    `  ${chalk.yellow('/session delete')} ${chalk.blue('<id>')} - Delete a session (cannot delete active session)`
                );
                console.log(`  ${chalk.yellow('/session help')} - Show this help message`);

                console.log(
                    chalk.dim('\n💡 Sessions allow you to maintain separate conversations')
                );
                console.log(chalk.dim('💡 Use /session switch <id> to change sessions'));
                console.log(chalk.dim('💡 Session names can be custom or auto-generated UUIDs\n'));

                return true;
            },
        },
    ],
    handler: async (args: string[], agent: SaikiAgent) => {
        // Default to help if no subcommand
        if (args.length === 0) {
            const helpSubcommand = sessionCommands.subcommands?.find((s) => s.name === 'help');
            if (helpSubcommand) {
                return helpSubcommand.handler([], agent);
            }
            return true;
        }

        const subcommand = args[0];
        const subArgs = args.slice(1);

        // Find matching subcommand
        const subcmd = sessionCommands.subcommands?.find((s) => s.name === subcommand);
        if (subcmd) {
            return subcmd.handler(subArgs, agent);
        }

        console.log(chalk.red(`❌ Unknown session subcommand: ${subcommand}`));
        console.log(
            chalk.dim('Available subcommands: list, new, switch, current, history, delete, help')
        );
        console.log(chalk.dim('💡 Use /session help for detailed command descriptions'));
        return true;
    },
};

/**
 * Model management commands
 */
const modelCommands: CommandDefinition = {
    name: 'model',
    description: 'Manage AI models',
    usage: '/model <subcommand> [args]',
    category: 'Model Management',
    aliases: ['m'],
    subcommands: [
        {
            name: 'list',
            description: 'List all supported providers and models',
            usage: '/model list',
            handler: async (_args: string[], agent: SaikiAgent) => {
                try {
                    console.log(chalk.bold.blue('\n🤖 Supported Models and Providers:\n'));

                    const providers = agent.getSupportedProviders();
                    const allModels = agent.getSupportedModels();

                    for (const provider of providers) {
                        const models = allModels[provider];

                        console.log(chalk.bold.yellow(`${provider.toUpperCase()}:`));
                        console.log(chalk.cyan('  Models:'));

                        for (const model of models) {
                            const tokenLimit = ` (${model.maxInputTokens.toLocaleString()} tokens)`;
                            const defaultLabel = model.isDefault ? chalk.green(' [DEFAULT]') : '';

                            console.log(
                                `    ${chalk.cyan(model.name)}${tokenLimit}${defaultLabel}`
                            );
                        }
                        console.log();
                    }

                    console.log(chalk.dim('💡 Use /model switch <model> to switch models'));
                    console.log(chalk.dim('💡 Default models are marked with [DEFAULT]'));
                    console.log(chalk.dim('💡 Token limits show maximum input context size\n'));
                } catch (error) {
                    logger.error(
                        `Failed to list models: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
                return true;
            },
        },
        {
            name: 'current',
            description: 'Show current model configuration',
            usage: '/model current',
            handler: async (args: string[], agent: SaikiAgent) => {
                try {
                    const config = agent.getEffectiveConfig();
                    console.log(chalk.blue('\n🤖 Current Model Configuration:\n'));
                    console.log(`  Provider: ${chalk.cyan(config.llm.provider)}`);
                    console.log(`  Model: ${chalk.cyan(config.llm.model)}`);
                    console.log(`  Router: ${chalk.cyan(config.llm.router)}`);

                    if (config.llm.maxIterations) {
                        console.log(
                            `  Max Iterations: ${chalk.cyan(config.llm.maxIterations.toString())}`
                        );
                    }
                    if (config.llm.maxInputTokens) {
                        console.log(
                            `  Max Input Tokens: ${chalk.cyan(config.llm.maxInputTokens.toString())}`
                        );
                    }
                    console.log();
                } catch (error) {
                    logger.error(
                        `Failed to get model info: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
                return true;
            },
        },
        {
            name: 'switch',
            description: 'Switch to a different model',
            usage: '/model switch <model>',
            handler: async (args: string[], agent: SaikiAgent) => {
                if (args.length === 0) {
                    console.log(chalk.red('❌ Model required. Usage: /model switch <model>'));
                    return true;
                }

                try {
                    const model = args[0]!; // Safe to assert since we checked args.length above

                    // Infer provider from model name
                    const provider = agent.inferProviderFromModel(model);
                    if (!provider) {
                        console.log(chalk.red(`❌ Unknown model: ${model}`));
                        console.log(chalk.dim('💡 Use /model list to see available models'));
                        return true;
                    }

                    console.log(chalk.yellow(`🔄 Switching to ${model} (${provider})...`));

                    const llmConfig = { model, provider };
                    const result = await agent.switchLLM(llmConfig);

                    if (result.success) {
                        console.log(chalk.green(`✅ ${result.message}`));
                        if (result.warnings && result.warnings.length > 0) {
                            for (const warning of result.warnings) {
                                console.log(chalk.yellow(`⚠️  ${warning}`));
                            }
                        }
                    } else {
                        console.log(chalk.red('❌ Failed to switch model:'));
                        if (result.errors) {
                            for (const error of result.errors) {
                                console.log(chalk.red(`   ${error.message}`));
                                if (error.suggestedAction) {
                                    console.log(chalk.dim(`   💡 ${error.suggestedAction}`));
                                }
                            }
                        }
                    }
                } catch (error) {
                    logger.error(
                        `Failed to switch model: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
                return true;
            },
        },
        {
            name: 'help',
            description: 'Show detailed help for model commands',
            usage: '/model help',
            handler: async (_args: string[], _agent: SaikiAgent) => {
                console.log(chalk.bold.blue('\n🤖 Model Management Commands:\n'));

                console.log(chalk.cyan('Available subcommands:'));
                console.log(
                    `  ${chalk.yellow('/model list')} - List all supported providers, models, and capabilities`
                );
                console.log(
                    `  ${chalk.yellow('/model current')} - Display currently active model and configuration`
                );
                console.log(
                    `  ${chalk.yellow('/model switch')} ${chalk.blue('<model>')} - Switch to a different AI model (provider auto-detected)`
                );
                console.log(`        Examples:`);
                console.log(`          ${chalk.dim('/model switch gpt-4o')}`);
                console.log(`          ${chalk.dim('/model switch claude-4-sonnet-20250514')}`);
                console.log(`          ${chalk.dim('/model switch gemini-2.5-pro')}`);
                console.log(`  ${chalk.yellow('/model help')} - Show this help message`);

                console.log(
                    chalk.dim('\n💡 Switching models allows you to use different AI capabilities')
                );
                console.log(chalk.dim('💡 Model changes apply to the current session immediately'));
                console.log(chalk.dim('💡 Available providers: openai, anthropic, gemini'));
                console.log(chalk.dim('💡 Check your config file for supported models\n'));

                return true;
            },
        },
    ],
    handler: async (args: string[], agent: SaikiAgent) => {
        // Default to help if no subcommand
        if (args.length === 0) {
            const helpSubcommand = modelCommands.subcommands?.find((s) => s.name === 'help');
            if (helpSubcommand) {
                return helpSubcommand.handler([], agent);
            }
            return true;
        }

        const subcommand = args[0];
        const subArgs = args.slice(1);

        // Find matching subcommand
        const subcmd = modelCommands.subcommands?.find((s) => s.name === subcommand);
        if (subcmd) {
            return subcmd.handler(subArgs, agent);
        }

        console.log(chalk.red(`❌ Unknown model subcommand: ${subcommand}`));
        console.log(chalk.dim('Available subcommands: list, current, switch, help'));
        console.log(chalk.dim('💡 Use /model help for detailed command descriptions'));
        return true;
    },
};

/**
 * MCP management commands
 */
const mcpCommands: CommandDefinition = {
    name: 'mcp',
    description: 'Manage MCP servers',
    usage: '/mcp <subcommand> [args]',
    category: 'MCP Management',
    aliases: ['mc'],
    subcommands: [
        {
            name: 'list',
            description: 'List all available MCP servers',
            usage: '/mcp list',
            handler: async (_args: string[], agent: SaikiAgent) => {
                try {
                    const clients = agent.mcpManager.getClients();
                    const failedConnections = agent.mcpManager.getFailedConnections();

                    if (clients.size === 0 && Object.keys(failedConnections).length === 0) {
                        console.log(chalk.yellow('📋 No MCP servers configured or connected.'));
                        return true;
                    }

                    console.log(chalk.bold.blue('\n🔌 MCP Servers:\n'));
                    for (const [name] of clients) {
                        console.log(chalk.green(`✅ ${name}:`));
                        console.log(chalk.dim(`  Connected: Yes`));
                        console.log();
                    }

                    if (Object.keys(failedConnections).length > 0) {
                        console.log(chalk.bold.red('\n❌ Failed Connections:\n'));
                        for (const [name, error] of Object.entries(failedConnections)) {
                            console.log(chalk.red(`❌ ${name}:`));
                            console.log(chalk.dim(`  Error: ${error}`));
                        }
                    }

                    console.log(
                        chalk.dim(
                            '💡 Use /mcp add <name> <config_json_string> to connect a new MCP server.'
                        )
                    );
                    console.log(
                        chalk.dim('💡 Use /mcp remove <name> to disconnect an MCP server.')
                    );
                    console.log(chalk.dim('💡 Use /mcp help for detailed command descriptions.'));
                    return true;
                } catch (error) {
                    logger.error(
                        `Failed to list MCP servers: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
                return true;
            },
        },
        {
            name: 'add',
            description: 'Add a new MCP server',
            usage: '/mcp add <name> <config_json_string>',
            handler: async (args: string[], agent: SaikiAgent) => {
                if (args.length < 2) {
                    console.log(chalk.red('❌ Usage: /mcp add <name> <config_json_string>'));
                    console.log(
                        chalk.dim(
                            'Example: /mcp add my-server \'{"type":"http","command":"http://localhost:8080"}\''
                        )
                    );
                    return true;
                }

                const [name, configString] = args;
                try {
                    const config = JSON.parse(configString!);
                    await agent.mcpManager.connectServer(name!, config);
                    console.log(chalk.green(`✅ MCP server '${name}' added successfully`));
                } catch (error) {
                    logger.error(
                        `Failed to add MCP server '${name}': ${error instanceof Error ? error.message : String(error)}`
                    );
                }
                return true;
            },
        },
        {
            name: 'remove',
            description: 'Remove an MCP server',
            usage: '/mcp remove <name>',
            handler: async (args: string[], agent: SaikiAgent) => {
                if (args.length === 0) {
                    console.log(chalk.red('❌ Usage: /mcp remove <name>'));
                    return true;
                }

                const name = args[0]!;
                try {
                    await agent.mcpManager.removeClient(name);
                    console.log(chalk.green(`✅ MCP server '${name}' removed successfully`));
                } catch (error) {
                    logger.error(
                        `Failed to remove MCP server '${name}': ${error instanceof Error ? error.message : String(error)}`
                    );
                }
                return true;
            },
        },
        {
            name: 'help',
            description: 'Show detailed help for MCP commands',
            usage: '/mcp help',
            handler: async (_args: string[], _agent: SaikiAgent) => {
                console.log(chalk.bold.blue('\n🔌 MCP Management Commands:\n'));
                console.log(chalk.cyan('Available subcommands:'));
                console.log(`  ${chalk.yellow('/mcp list')} - List all configured MCP servers`);
                console.log(
                    `  ${chalk.yellow('/mcp add')} ${chalk.blue('<name> <config_json>')} - Add a new MCP server`
                );
                console.log(
                    `  ${chalk.yellow('/mcp remove')} ${chalk.blue('<name>')} - Remove an MCP server`
                );
                console.log(`\n        Examples:`);
                console.log(
                    `          ${chalk.dim('/mcp add my-mcp-server \'{"command":"mcp-filesystem"}\'')}`
                );
                console.log(`          ${chalk.dim('/mcp remove my-mcp-server')}`);
                console.log(
                    chalk.dim('💡 MCP servers are used to access external tools and services.')
                );
                console.log(chalk.dim('💡 Use /mcp help for detailed command descriptions.\n'));
                return true;
            },
        },
    ],
    handler: async (args: string[], agent: SaikiAgent) => {
        if (args.length === 0) {
            const helpSubcommand = mcpCommands.subcommands?.find((s) => s.name === 'help');
            if (helpSubcommand) {
                return helpSubcommand.handler([], agent);
            }
            return true;
        }

        const subcommand = args[0];
        const subArgs = args.slice(1);
        const subcmd = mcpCommands.subcommands?.find((s) => s.name === subcommand);

        if (subcmd) {
            return subcmd.handler(subArgs, agent);
        }

        console.log(chalk.red(`❌ Unknown MCP subcommand: ${subcommand}`));
        console.log(chalk.dim('Available subcommands: list, add, remove, help'));
        console.log(chalk.dim('💡 Use /mcp help for detailed command descriptions.\n'));
        return true;
    },
};

/**
 * All available CLI commands
 */
export const CLI_COMMANDS: CommandDefinition[] = [
    {
        name: 'help',
        description: 'Show help information',
        usage: '/help [command]',
        category: 'General',
        aliases: ['h', '?'],
        handler: async (args: string[], _agent: SaikiAgent) => {
            if (args.length === 0) {
                displayAllCommands(CLI_COMMANDS);
                return true;
            }

            const commandName = args[0];
            if (!commandName) {
                console.log(chalk.red('❌ No command specified'));
                return true;
            }

            // Redirect to contextual help for commands that have their own help subcommands
            if (commandName === 'session' || commandName === 's') {
                console.log(chalk.blue('💡 For detailed session help, use:'));
                console.log(`   ${chalk.cyan('/session help')}`);
                console.log(
                    chalk.dim('\n   This shows all session subcommands with examples and tips.')
                );
                return true;
            }

            if (commandName === 'model' || commandName === 'm') {
                console.log(chalk.blue('💡 For detailed model help, use:'));
                console.log(`   ${chalk.cyan('/model help')}`);
                console.log(
                    chalk.dim('\n   This shows all model subcommands with examples and usage.')
                );
                return true;
            }

            if (commandName === 'mcp' || commandName === 'mc') {
                console.log(chalk.blue('💡 For detailed MCP help, use:'));
                console.log(`   ${chalk.cyan('/mcp help')}`);
                console.log(
                    chalk.dim('\n   This shows all MCP subcommands with examples and usage.')
                );
                return true;
            }

            const command = CLI_COMMANDS.find(
                (c) => c.name === commandName || (c.aliases && c.aliases.includes(commandName))
            );

            if (command) {
                console.log('\n' + formatCommandHelp(command, true) + '\n');
            } else {
                console.log(chalk.red(`❌ Unknown command: ${commandName}`));
                console.log(chalk.dim('Use /help to see all available commands'));
            }
            return true;
        },
    },
    {
        name: 'exit',
        description: 'Exit the CLI',
        usage: '/exit',
        category: 'General',
        aliases: ['quit', 'q'],
        handler: async (_args: string[], _agent: SaikiAgent) => {
            logger.warn('Exiting AI CLI. Goodbye!');
            process.exit(0);
        },
    },
    {
        name: 'clear',
        description: 'Clear conversation history',
        usage: '/clear',
        category: 'General',
        aliases: ['reset'],
        handler: async (_args: string[], agent: SaikiAgent) => {
            try {
                await agent.resetConversation();
                logger.info('🔄 Conversation history cleared.', null, 'green');
            } catch (error) {
                logger.error(
                    `Failed to clear conversation: ${error instanceof Error ? error.message : String(error)}`
                );
            }
            return true;
        },
    },
    {
        name: 'history',
        description: 'Show conversation history',
        usage: '/history [sessionId]',
        category: 'General',
        aliases: ['hist'],
        handler: async (args: string[], agent: SaikiAgent) => {
            try {
                // Use provided session ID or current session
                const sessionId =
                    args.length > 0 && args[0] ? args[0] : agent.getCurrentSessionId();

                await displaySessionHistory(sessionId, agent);
            } catch (error) {
                if (error instanceof Error && error.message.includes('not found')) {
                    console.log(chalk.red(`❌ Session not found: ${args[0] || 'current'}`));
                    console.log(chalk.dim('   Use /session list to see available sessions'));
                } else {
                    logger.error(
                        `Failed to get session history: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            }
            return true;
        },
    },
    sessionCommands,
    modelCommands,
    mcpCommands,
    {
        name: 'log',
        description: `Set or view log level. Available levels: ${chalk.cyan('error')}, ${chalk.cyan('warn')}, ${chalk.cyan('info')}, ${chalk.cyan('http')}, ${chalk.cyan('verbose')}, ${chalk.cyan('debug')}, ${chalk.cyan('silly')}.`,
        usage: '/log [level]',
        category: 'System',
        aliases: [],
        handler: async (args: string[], _agent: SaikiAgent) => {
            const validLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
            const level = args[0];

            if (!level) {
                console.log(chalk.blue(`\nCurrent log level: ${chalk.cyan(logger.getLevel())}`));
                console.log(
                    chalk.dim('Available levels: error, warn, info, http, verbose, debug, silly')
                );
                console.log(chalk.dim('💡 Use /log [level] to set the log level'));
                return true;
            }

            if (validLevels.includes(level)) {
                logger.setLevel(level as any);
                logger.info(`Log level set to ${level}`, null, 'green');
            } else {
                logger.error(
                    `Invalid log level: ${level}. Valid levels are: ${validLevels.join(', ')}`
                );
            }
            return true;
        },
    },
    {
        name: 'config',
        description: 'Show current configuration',
        usage: '/config',
        category: 'System',
        handler: async (_args: string[], agent: SaikiAgent) => {
            try {
                const config = agent.getEffectiveConfig();
                console.log(chalk.blue('\n⚙️  Current Configuration:\n'));

                // LLM Config
                console.log(chalk.bold('🤖 LLM:'));
                console.log(`  Provider: ${chalk.cyan(config.llm.provider)}`);
                console.log(`  Model: ${chalk.cyan(config.llm.model)}`);
                console.log(`  Router: ${chalk.cyan(config.llm.router)}`);

                // Session Config
                console.log(chalk.bold('\n💬 Sessions:'));
                console.log(
                    `  Max Sessions: ${chalk.cyan(config.sessions?.maxSessions?.toString() || 'Default')}`
                );
                console.log(
                    `  Session TTL: ${chalk.cyan(config.sessions?.sessionTTL ? `${config.sessions.sessionTTL / 1000}s` : 'Default')}`
                );

                // MCP Servers
                console.log(chalk.bold('\n🔌 MCP Servers:'));
                const servers = Object.keys(config.mcpServers || {});
                if (servers.length > 0) {
                    for (const server of servers) {
                        console.log(`  ${chalk.cyan(server)}`);
                    }
                } else {
                    console.log(chalk.dim('  No MCP servers configured'));
                }

                console.log();
            } catch (error) {
                logger.error(
                    `Failed to get configuration: ${error instanceof Error ? error.message : String(error)}`
                );
            }
            return true;
        },
    },
    {
        name: 'stats',
        description: 'Show system statistics',
        usage: '/stats',
        category: 'System',
        handler: async (_args: string[], agent: SaikiAgent) => {
            try {
                console.log(chalk.blue('\n📊 System Statistics:\n'));

                // Session stats
                const sessionStats = await agent.sessionManager.getSessionStats();
                console.log(chalk.bold('💬 Sessions:'));
                console.log(
                    `  Total Sessions: ${chalk.cyan(sessionStats.totalSessions.toString())}`
                );
                console.log(`  In Memory: ${chalk.cyan(sessionStats.inMemorySessions.toString())}`);
                console.log(`  Max Allowed: ${chalk.cyan(sessionStats.maxSessions.toString())}`);

                // MCP stats
                console.log(chalk.bold('\n🔌 MCP Servers:'));
                const connectedServers = agent.mcpManager.getClients().size;
                const failedConnections = Object.keys(
                    agent.mcpManager.getFailedConnections()
                ).length;
                console.log(`  Connected: ${chalk.green(connectedServers.toString())}`);
                if (failedConnections > 0) {
                    console.log(`  Failed: ${chalk.red(failedConnections.toString())}`);
                }

                // Tools
                try {
                    const tools = await agent.mcpManager.getAllTools();
                    console.log(
                        `  Available Tools: ${chalk.cyan(Object.keys(tools).length.toString())}`
                    );
                } catch {
                    console.log(`  Available Tools: ${chalk.dim('Unable to count')}`);
                }

                console.log();
            } catch (error) {
                logger.error(
                    `Failed to get statistics: ${error instanceof Error ? error.message : String(error)}`
                );
            }
            return true;
        },
    },
    {
        name: 'tools',
        description: 'List all available MCP tools',
        usage: '/tools',
        category: 'Tool Management',
        handler: async (args: string[], agent: SaikiAgent): Promise<boolean> => {
            try {
                const tools = await agent.getAllMcpTools();
                const toolEntries = Object.entries(tools);

                if (toolEntries.length === 0) {
                    console.log(chalk.yellow('📋 No tools available'));
                    return true;
                }

                console.log(chalk.bold.green(`\n🔧 Available Tools (${toolEntries.length}):\n`));

                // Display tools with descriptions
                for (const [toolName, toolInfo] of toolEntries) {
                    const description = toolInfo.description || 'No description available';
                    console.log(`  ${chalk.yellow(toolName)} - ${chalk.dim(description)}`);
                }

                console.log(chalk.dim('💡 Tools are provided by connected MCP servers'));
            } catch (error) {
                logger.error(
                    `Failed to list tools: ${error instanceof Error ? error.message : String(error)}`
                );
            }
            return true;
        },
    },
    {
        name: 'prompt',
        description: 'Display the current system prompt',
        usage: '/prompt',
        category: 'Prompt Management',
        handler: async (args: string[], agent: SaikiAgent): Promise<boolean> => {
            try {
                const systemPrompt = await agent.getSystemPrompt();

                console.log(chalk.bold.green('\n📋 Current System Prompt:\n'));
                console.log(chalk.dim('─'.repeat(80)));
                console.log(systemPrompt);
                console.log(chalk.dim('─'.repeat(80)));
                console.log();
            } catch (error) {
                logger.error(
                    `Failed to get system prompt: ${error instanceof Error ? error.message : String(error)}`
                );
            }
            return true;
        },
    },
    {
        name: 'docs',
        description: 'Open Saiki documentation in browser',
        usage: '/docs',
        category: 'Documentation',
        aliases: ['doc'],
        handler: async (_args: string[], _agent: SaikiAgent): Promise<boolean> => {
            try {
                const { spawn } = await import('child_process');
                const url = 'https://truffle-ai.github.io/saiki/docs/category/getting-started/';

                console.log(chalk.blue(`🌐 Opening Saiki documentation: ${url}`));

                // Cross-platform browser opening
                const command =
                    process.platform === 'darwin'
                        ? 'open'
                        : process.platform === 'win32'
                          ? 'start'
                          : 'xdg-open';

                spawn(command, [url], { detached: true, stdio: 'ignore' });
                console.log(chalk.green('✅ Documentation opened in browser'));
            } catch (error) {
                logger.error(
                    `Failed to open documentation: ${error instanceof Error ? error.message : String(error)}`
                );
                console.log(
                    chalk.yellow(
                        '💡 You can manually visit: https://truffle-ai.github.io/saiki/docs/category/getting-started/'
                    )
                );
            }
            return true;
        },
    },
    {
        name: 'search',
        description: 'Search conversation history',
        usage: '/search <query> [options]',
        category: 'General',
        aliases: ['find'],
        handler: async (args: string[], agent: SaikiAgent) => {
            if (args.length === 0) {
                console.log(chalk.red('❌ Search query is required'));
                console.log(
                    chalk.dim(
                        'Usage: /search <query> [--session <sessionId>] [--role <role>] [--limit <number>]'
                    )
                );
                console.log(chalk.dim('Examples:'));
                console.log(chalk.dim('  /search "hello world"'));
                console.log(chalk.dim('  /search error --role assistant'));
                console.log(chalk.dim('  /search deploy --session abc123'));
                return true;
            }

            try {
                // Parse arguments
                const options: {
                    limit: number;
                    sessionId?: string;
                    role?: 'user' | 'assistant' | 'system' | 'tool';
                } = { limit: 10 };
                let query = '';
                let i = 0;

                while (i < args.length) {
                    const arg = args[i];
                    if (arg === '--session' && i + 1 < args.length) {
                        const sessionValue = args[i + 1];
                        if (sessionValue) {
                            options.sessionId = sessionValue;
                        }
                        i += 2;
                    } else if (arg === '--role' && i + 1 < args.length) {
                        const roleValue = args[i + 1] as 'user' | 'assistant' | 'system' | 'tool';
                        if (
                            roleValue &&
                            ['user', 'assistant', 'system', 'tool'].includes(roleValue)
                        ) {
                            options.role = roleValue;
                        }
                        i += 2;
                    } else if (arg === '--limit' && i + 1 < args.length) {
                        const limitValue = args[i + 1];
                        options.limit = limitValue ? parseInt(limitValue) || 10 : 10;
                        i += 2;
                    } else {
                        if (!arg) {
                            i++;
                            continue;
                        }
                        // Remove surrounding quotes if present
                        let cleanArg = arg;
                        if (
                            cleanArg &&
                            ((cleanArg.startsWith('"') && cleanArg.endsWith('"')) ||
                                (cleanArg.startsWith("'") && cleanArg.endsWith("'")))
                        ) {
                            cleanArg = cleanArg.slice(1, -1);
                        }
                        query += (query ? ' ' : '') + cleanArg;
                        i++;
                    }
                }

                if (!query.trim()) {
                    console.log(chalk.red('❌ Search query is required'));
                    return true;
                }

                console.log(chalk.blue(`🔍 Searching for: "${query}"`));
                if (options.sessionId) {
                    console.log(chalk.dim(`   Session: ${options.sessionId}`));
                }
                if (options.role) {
                    console.log(chalk.dim(`   Role: ${options.role}`));
                }
                console.log(chalk.dim(`   Limit: ${options.limit}`));
                console.log();

                const results = await agent.searchMessages(query, options);

                if (results.results.length === 0) {
                    console.log(chalk.yellow('📭 No messages found matching your search'));
                    return true;
                }

                console.log(
                    chalk.green(`✅ Found ${results.total} result${results.total === 1 ? '' : 's'}`)
                );
                if (results.hasMore) {
                    console.log(chalk.dim(`   Showing first ${results.results.length} results`));
                }
                console.log();

                // Display results
                results.results.forEach((result, index) => {
                    const roleColor =
                        result.message.role === 'user'
                            ? chalk.blue
                            : result.message.role === 'assistant'
                              ? chalk.green
                              : chalk.yellow;

                    console.log(
                        `${chalk.dim(`${index + 1}.`)} ${chalk.cyan(result.sessionId)} ${roleColor(`[${result.message.role}]`)}`
                    );
                    console.log(
                        `   ${result.context.replace(new RegExp(`(${query})`, 'gi'), chalk.inverse('$1'))}`
                    );
                    console.log();
                });

                if (results.hasMore) {
                    console.log(chalk.dim('💡 Use --limit to see more results'));
                }
            } catch (error) {
                logger.error(
                    `Search failed: ${error instanceof Error ? error.message : String(error)}`
                );
                console.log(chalk.red('❌ Search failed. Please try again.'));
            }
            return true;
        },
    },
];

/**
 * Execute a slash command
 */
export async function executeCommand(
    command: string,
    args: string[],
    agent: SaikiAgent
): Promise<boolean> {
    // Find the command (including aliases)
    const cmd = CLI_COMMANDS.find(
        (c) => c.name === command || (c.aliases && c.aliases.includes(command))
    );

    if (!cmd) {
        console.log(chalk.red(`❌ Unknown command: /${command}`));
        console.log(chalk.dim('Type /help to see available commands'));
        return true;
    }

    try {
        return await cmd.handler(args, agent);
    } catch (error) {
        logger.error(
            `Command execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
        return true;
    }
}
