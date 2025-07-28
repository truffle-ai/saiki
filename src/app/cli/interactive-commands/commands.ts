/**
 * CLI Commands Module (Modular Version)
 *
 * This module aggregates all CLI commands from extracted modular components.
 * It maintains the same external interface as the original monolithic commands.ts
 * while using the new modular structure internally.
 *
 * The commands are organized into logical modules:
 * - Session Commands: Session management (create, switch, delete, etc.)
 * - Model Commands: Model switching and configuration
 * - MCP Commands: MCP server management
 * - System Commands: General system commands (help, config, stats, etc.)
 *
 * This file serves as the integration layer that combines all modular commands
 * into a single CLI_COMMANDS array for the command execution system.
 */

import type { SaikiAgent } from '@core/index.js';
import type { CommandDefinition } from './command-parser.js';

// Import modular command definitions
import { sessionCommands } from './session/index.js';
import { modelCommands } from './model/index.js';
import { mcpCommands } from './mcp/index.js';
import { createSystemCommands } from './system/system-commands.js';

// Create the initial commands list without system commands
const baseCommands: CommandDefinition[] = [
    // Session management commands
    sessionCommands,

    // Model management commands
    modelCommands,

    // MCP server management commands
    mcpCommands,
];

/**
 * Complete list of all available CLI commands.
 * This array combines commands from all extracted modules to maintain
 * the same interface as the original monolithic implementation.
 *
 * System commands are created with the full commands list injected
 * to resolve circular dependency issues with the help command.
 */
export const CLI_COMMANDS: CommandDefinition[] = [
    ...baseCommands,
    // System commands with full commands list injected for help functionality
    ...createSystemCommands(undefined), // Will be updated after CLI_COMMANDS is complete
];

// Update system commands with the complete commands list for help functionality
CLI_COMMANDS.splice(
    baseCommands.length,
    CLI_COMMANDS.length - baseCommands.length,
    ...createSystemCommands(CLI_COMMANDS)
);

/**
 * Execute a slash command
 *
 * This function maintains the exact same interface and behavior as the original
 * executeCommand function, providing backward compatibility while using the
 * new modular command structure.
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
        console.log(`❌ Unknown command: /${command}`);
        console.log('Type /help to see available commands');
        return true;
    }

    try {
        return await cmd.handler(args, agent);
    } catch (error) {
        console.error(
            `Command execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
        return true;
    }
}
