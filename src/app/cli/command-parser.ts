import chalk from 'chalk';

export interface CommandResult {
    type: 'command' | 'prompt';
    command?: string;
    args?: string[];
    rawInput?: string;
}

export interface CommandDefinition {
    name: string;
    description: string;
    usage: string;
    aliases?: string[];
    subcommands?: CommandDefinition[];
    handler: (args: string[], agent: any) => Promise<boolean>;
}

/**
 * Parses user input to determine if it's a slash command or a regular prompt
 */
export function parseInput(input: string): CommandResult {
    const trimmed = input.trim();

    // Check if it's a slash command
    if (trimmed.startsWith('/')) {
        const parts = trimmed
            .slice(1)
            .split(' ')
            .filter((part) => part.length > 0);
        const command = parts[0] || '';
        const args = parts.slice(1);

        return {
            type: 'command',
            command,
            args,
            rawInput: trimmed,
        };
    }

    // Regular user prompt
    return {
        type: 'prompt',
        rawInput: input,
    };
}

/**
 * Finds command suggestions based on partial input
 */
export function getCommandSuggestions(partial: string, commands: CommandDefinition[]): string[] {
    const suggestions: string[] = [];

    for (const cmd of commands) {
        // Check main command name
        if (cmd.name.startsWith(partial)) {
            suggestions.push(cmd.name);
        }

        // Check aliases
        if (cmd.aliases) {
            for (const alias of cmd.aliases) {
                if (alias.startsWith(partial)) {
                    suggestions.push(alias);
                }
            }
        }
    }

    return suggestions.sort();
}

/**
 * Formats help text for a command
 */
export function formatCommandHelp(cmd: CommandDefinition, detailed: boolean = false): string {
    let help = chalk.cyan(`/${cmd.name}`) + ' - ' + cmd.description;

    if (detailed) {
        help += '\n' + chalk.dim(`Usage: ${cmd.usage}`);

        if (cmd.aliases && cmd.aliases.length > 0) {
            help += '\n' + chalk.dim(`Aliases: ${cmd.aliases.map((a) => `/${a}`).join(', ')}`);
        }

        if (cmd.subcommands && cmd.subcommands.length > 0) {
            help += '\n' + chalk.dim('Subcommands:');
            for (const sub of cmd.subcommands) {
                help += '\n  ' + chalk.cyan(`/${cmd.name} ${sub.name}`) + ' - ' + sub.description;
            }
        }
    }

    return help;
}

/**
 * Displays a formatted list of all available commands
 */
export function displayAllCommands(commands: CommandDefinition[]): void {
    console.log(chalk.bold.green('\n📋 Available Commands:\n'));

    const categories: { [key: string]: CommandDefinition[] } = {
        'Session Management': [],
        'Model Management': [],
        System: [],
        General: [],
    };

    // Categorize commands
    for (const cmd of commands) {
        if (cmd.name.startsWith('session')) {
            categories['Session Management']!.push(cmd);
        } else if (cmd.name.startsWith('model')) {
            categories['Model Management']!.push(cmd);
        } else if (['config', 'stats', 'log'].includes(cmd.name)) {
            categories['System']!.push(cmd);
        } else {
            categories['General']!.push(cmd);
        }
    }

    // Display by category
    for (const [category, cmds] of Object.entries(categories)) {
        if (cmds.length > 0) {
            console.log(chalk.bold.yellow(`${category}:`));
            for (const cmd of cmds) {
                console.log('  ' + formatCommandHelp(cmd));
            }
            console.log();
        }
    }

    console.log(chalk.dim('💡 Tip: Use /help <command> for detailed help on any command'));
    console.log(chalk.dim('💡 Tip: Type your message normally (without /) to chat with the AI\n'));
}
