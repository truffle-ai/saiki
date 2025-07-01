/**
 * CLI Commands Module
 *
 * This module defines all available slash commands for the Saiki CLI interface.
 * Commands provide system control and agent management functionality.
 *
 * Available Commands:
 *
 * GENERAL:
 * - /help [command] - Show help information for all commands or a specific command
 * - /exit, /quit, /q - Exit the CLI application
 * - /clear, /reset - Clear conversation history for current session
 * - /history [sessionId], /hist - Show conversation history (current or specified session)
 *
 * SESSION MANAGEMENT:
 * - /session, /s - Manage chat sessions (defaults to list)
 *   - /session list - List all available sessions with metadata
 *   - /session new [id] - Create a new session with optional custom ID
 *   - /session switch <id> - Switch to a different session
 *   - /session current - Show current active session info
 *   - /session history [id], /session h - Show conversation history
 *   - /session delete <id> - Delete a session (cannot delete active session)
 *
 * MODEL MANAGEMENT:
 * - /model, /m - Manage AI models (defaults to current)
 *   - /model current - Show current model configuration
 *   - /model switch <model> [provider] - Switch to a different model/provider
 *
 * SYSTEM CONFIGURATION:
 * - /log [level] - Set or view current log level
 *   Available levels: error, warn, info, http, verbose, debug, silly
 * - /config - Show current agent configuration (LLM, sessions, MCP servers)
 * - /stats - Show system statistics (sessions, MCP servers, tools)
 *
 * Usage:
 * - Commands start with '/' followed by the command name
 * - Arguments are space-separated
 * - Commands with subcommands default to a primary action if no subcommand given
 * - Use /help <command> for detailed help on specific commands
 */

import chalk from 'chalk';
import { logger } from '@core/index.js';
import { SaikiAgent } from '@core/index.js';
import { CommandDefinition, formatCommandHelp, displayAllCommands } from './command-parser.js';

/**
 * Helper to format session information consistently
 */
function formatSessionInfo(sessionId: string, metadata?: any, isCurrent: boolean = false): string {
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
async function getCurrentSessionInfo(agent: SaikiAgent): Promise<{ id: string; metadata?: any }> {
    const currentId = agent.getCurrentSessionId();
    const metadata = await agent.getSessionMetadata(currentId);
    return { id: currentId, metadata };
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
                    const sessionId = args[0];
                    if (!sessionId) {
                        console.log(
                            chalk.red('❌ Session ID required. Usage: /session switch <id>')
                        );
                        return true;
                    }

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

                    console.log(
                        chalk.blue(`\n💬 Conversation History for: ${chalk.bold(sessionId)}\n`)
                    );

                    const history = await agent.getSessionHistory(sessionId);

                    if (history.length === 0) {
                        console.log(chalk.dim('  No messages in this conversation yet.\n'));
                        return true;
                    }

                    // Display each message with formatting
                    history.forEach((message, index) => {
                        console.log(formatHistoryMessage(message, index));
                    });

                    console.log(chalk.dim(`\n  Total: ${history.length} messages`));
                    console.log(
                        chalk.dim(
                            '  💡 Use /clear to reset conversation or /session switch to change sessions\n'
                        )
                    );
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
                    const sessionId = args[0];
                    if (!sessionId) {
                        console.log(
                            chalk.red('❌ Session ID required. Usage: /session delete <id>')
                        );
                        return true;
                    }

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
    ],
    handler: async (args: string[], agent: SaikiAgent) => {
        // Default to list if no subcommand
        if (args.length === 0) {
            const listSubcommand = sessionCommands.subcommands?.find((s) => s.name === 'list');
            if (listSubcommand) {
                return listSubcommand.handler([], agent);
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
            chalk.dim('Available subcommands: list, new, switch, current, history, delete')
        );
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
    aliases: ['m'],
    subcommands: [
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
            usage: '/model switch <model> [provider]',
            handler: async (args: string[], agent: SaikiAgent) => {
                if (args.length === 0) {
                    console.log(
                        chalk.red('❌ Model required. Usage: /model switch <model> [provider]')
                    );
                    return true;
                }

                try {
                    const model = args[0];
                    const provider = args[1];

                    console.log(
                        chalk.yellow(
                            `🔄 Switching model to ${model}${provider ? ` (${provider})` : ''}...`
                        )
                    );

                    const llmConfig: any = { model };
                    if (provider) {
                        llmConfig.provider = provider;
                    }

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
    ],
    handler: async (args: string[], agent: SaikiAgent) => {
        // Default to current if no subcommand
        if (args.length === 0) {
            const currentSubcommand = modelCommands.subcommands?.find((s) => s.name === 'current');
            if (currentSubcommand) {
                return currentSubcommand.handler([], agent);
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
        console.log(chalk.dim('Available subcommands: current, switch'));
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
        aliases: ['hist'],
        handler: async (args: string[], agent: SaikiAgent) => {
            try {
                // Use provided session ID or current session
                const sessionId =
                    args.length > 0 && args[0] ? args[0] : agent.getCurrentSessionId();

                console.log(
                    chalk.blue(`\n💬 Conversation History for: ${chalk.bold(sessionId)}\n`)
                );

                const history = await agent.getSessionHistory(sessionId);

                if (history.length === 0) {
                    console.log(chalk.dim('  No messages in this conversation yet.\n'));
                    return true;
                }

                // Display each message with formatting
                history.forEach((message, index) => {
                    console.log(formatHistoryMessage(message, index));
                });

                console.log(chalk.dim(`\n  Total: ${history.length} messages`));
                console.log(
                    chalk.dim(
                        '  💡 Use /clear to reset conversation or /session switch to change sessions\n'
                    )
                );
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
    {
        name: 'log',
        description: `Set or view log level. Available levels: ${chalk.cyan('error')}, ${chalk.cyan('warn')}, ${chalk.cyan('info')}, ${chalk.cyan('http')}, ${chalk.cyan('verbose')}, ${chalk.cyan('debug')}, ${chalk.cyan('silly')}.`,
        usage: '/log [level]',
        aliases: [],
        handler: async (args: string[], _agent: SaikiAgent) => {
            const validLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
            const level = args[0];

            if (!level) {
                console.log(chalk.blue(`\nCurrent log level: ${chalk.cyan(logger.getLevel())}`));
                console.log(
                    chalk.dim('Available levels: error, warn, info, http, verbose, debug, silly')
                );
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
