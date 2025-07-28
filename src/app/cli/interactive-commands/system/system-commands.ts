/**
 * System Commands Module
 *
 * This module defines system-level slash commands for the Saiki CLI interface.
 * These commands provide general functionality like help, configuration, statistics,
 * and system management.
 *
 * Available System Commands:
 * - /help [command] - Show help information
 * - /exit, /quit, /q - Exit the CLI application
 * - /clear, /reset - Clear conversation history
 * - /history [sessionId], /hist - Show conversation history
 * - /search <query> [options], /find - Search conversation history
 * - /log [level] - Set or view log level
 * - /config - Show current configuration
 * - /stats - Show system statistics
 * - /tools - List all available MCP tools
 * - /prompt - Display the current system prompt
 * - /docs, /doc - Open Saiki documentation in browser
 */

import chalk from 'chalk';
import { logger } from '@core/index.js';
import type { SaikiAgent } from '@core/index.js';
import type { CommandDefinition } from '../command-parser.js';
import { displayAllCommands, formatCommandHelp } from '../command-parser.js';

/**
 * Creates system commands with injected CLI_COMMANDS for help functionality.
 * This resolves the circular dependency issue by allowing the main commands.ts
 * to inject the complete commands list into the help command.
 */
export function createSystemCommands(allCommands?: CommandDefinition[]): CommandDefinition[] {
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
            chalk.dim(
                '  💡 Use /clear to reset conversation or /session switch to change sessions\n'
            )
        );
    }

    return [
        {
            name: 'help',
            description: 'Show help information',
            usage: '/help [command]',
            category: 'General',
            aliases: ['h', '?'],
            handler: async (args: string[], _agent: SaikiAgent) => {
                if (args.length === 0) {
                    // Show all commands if available
                    if (allCommands && allCommands.length > 0) {
                        displayAllCommands(allCommands);
                    } else {
                        console.log(chalk.yellow('📋 Help system - use specific command help:'));
                        console.log(
                            chalk.dim('Use commands like /session help, /model help, or /mcp help')
                        );
                    }
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

                if (commandName === 'mcp') {
                    console.log(chalk.blue('💡 For detailed MCP help, use:'));
                    console.log(`   ${chalk.cyan('/mcp help')}`);
                    console.log(
                        chalk.dim('\n   This shows all MCP subcommands with examples and usage.')
                    );
                    return true;
                }

                // Try to find the command in the available commands
                if (allCommands && allCommands.length > 0) {
                    const cmd = allCommands.find(
                        (c) =>
                            c.name === commandName || (c.aliases && c.aliases.includes(commandName))
                    );
                    if (cmd) {
                        console.log(formatCommandHelp(cmd, true));
                        return true;
                    }
                }

                console.log(chalk.red(`❌ Unknown command: ${commandName}`));
                console.log(chalk.dim('Type /help to see all available commands'));
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
                    console.log(
                        chalk.blue(`\nCurrent log level: ${chalk.cyan(logger.getLevel())}`)
                    );
                    console.log(
                        chalk.dim(
                            'Available levels: error, warn, info, http, verbose, debug, silly'
                        )
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
                    console.log(
                        `  In Memory: ${chalk.cyan(sessionStats.inMemorySessions.toString())}`
                    );
                    console.log(
                        `  Max Allowed: ${chalk.cyan(sessionStats.maxSessions.toString())}`
                    );

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

                    console.log(
                        chalk.bold.green(`\n🔧 Available Tools (${toolEntries.length}):\n`)
                    );

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
                            const roleValue = args[i + 1] as
                                | 'user'
                                | 'assistant'
                                | 'system'
                                | 'tool';
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
                        chalk.green(
                            `✅ Found ${results.total} result${results.total === 1 ? '' : 's'}`
                        )
                    );
                    if (results.hasMore) {
                        console.log(
                            chalk.dim(`   Showing first ${results.results.length} results`)
                        );
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
}

/**
 * Default export for backward compatibility
 * This version doesn't have the injected commands list, so help will use fallback mode
 */
export const systemCommands: CommandDefinition[] = createSystemCommands();
