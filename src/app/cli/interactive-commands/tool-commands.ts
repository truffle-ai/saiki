/**
 * Tool Commands Module
 *
 * This module defines tool management slash commands for the Saiki CLI interface.
 * These commands provide functionality for listing and managing MCP tools.
 *
 * Available Tool Commands:
 * - /tools - List all available MCP tools
 */

import chalk from 'chalk';
import { logger } from '@core/index.js';
import type { SaikiAgent } from '@core/index.js';
import type { CommandDefinition } from './command-parser.js';

/**
 * Tool management commands
 */
export const toolCommands: CommandDefinition[] = [
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
];
