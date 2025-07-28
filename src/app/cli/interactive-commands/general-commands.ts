/**
 * General Commands Module
 *
 * This module defines general-purpose slash commands for the Saiki CLI interface.
 * These are basic commands that don't fit into specific categories.
 *
 * Available General Commands:
 * - /help [command] - Show help information
 * - /exit, /quit, /q - Exit the CLI application
 * - /clear, /reset - Clear conversation history
 */

import chalk from 'chalk';
import { logger } from '@core/index.js';
import type { SaikiAgent } from '@core/index.js';
import type { CommandDefinition } from './command-parser.js';
import { displayAllCommands, formatCommandHelp } from './command-parser.js';

/**
 * Creates the help command with access to all commands for display
 */
export function createHelpCommand(getAllCommands: () => CommandDefinition[]): CommandDefinition {
    return {
        name: 'help',
        description: 'Show help information',
        usage: '/help [command]',
        category: 'General',
        aliases: ['h', '?'],
        handler: async (args: string[], _agent: SaikiAgent) => {
            const allCommands = getAllCommands();

            if (args.length === 0) {
                // Show all commands using the original displayAllCommands function
                displayAllCommands(allCommands);
                return true;
            }

            const commandName = args[0];
            if (!commandName) {
                console.log(chalk.red('❌ No command specified'));
                return true;
            }

            // Find the specific command to show detailed help
            const cmd = allCommands.find(
                (c) => c.name === commandName || (c.aliases && c.aliases.includes(commandName))
            );

            if (cmd) {
                console.log(formatCommandHelp(cmd, true));
                return true;
            }

            // Redirect to contextual help for commands that have their own help subcommands
            if (commandName === 'conversation' || commandName === 'session') {
                console.log(chalk.blue('💡 For detailed conversation help, use:'));
                console.log(`   ${chalk.cyan('/conversation help')}`);
                console.log(
                    chalk.dim(
                        '\n   This shows all conversation subcommands with examples and tips.'
                    )
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

            console.log(chalk.yellow(`❓ No help available for: ${commandName}`));
            console.log(chalk.dim('Use /help to see all available commands'));
            return true;
        },
    };
}

/**
 * General commands that are available across all contexts
 * Note: The help command is created separately to avoid circular dependencies
 */
export const generalCommands: CommandDefinition[] = [
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
];
