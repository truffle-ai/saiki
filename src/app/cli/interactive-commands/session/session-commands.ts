/**
 * Session Management Commands
 *
 * This module contains all session-related CLI commands extracted from the monolithic commands.ts.
 * These commands provide functionality for managing chat sessions including creation, switching,
 * deletion, and history management.
 *
 * Commands:
 * - list: List all available sessions with metadata
 * - new: Create a new session with optional custom ID
 * - switch: Switch to a different session
 * - current: Show current active session info
 * - history: Show conversation history for current/specified session
 * - delete: Delete a session (cannot delete active session)
 * - help: Show detailed help for session commands
 */

import chalk from 'chalk';
import { logger } from '@core/index.js';
import { SaikiAgent } from '@core/index.js';
import type { SessionMetadata } from '@core/index.js';
import { CommandDefinition } from '../command-parser.js';
import { formatSessionInfo, formatHistoryMessage } from './helpers/formatters.js';

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
 * Session management commands
 */
export const sessionCommands: CommandDefinition = {
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
