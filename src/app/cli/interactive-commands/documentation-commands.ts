/**
 * Documentation Commands Module
 *
 * This module defines documentation-related slash commands for the Saiki CLI interface.
 * These commands provide functionality for accessing documentation and help resources.
 *
 * Available Documentation Commands:
 * - /docs, /doc - Open Saiki documentation in browser
 */

import chalk from 'chalk';
import { logger } from '@core/index.js';
import type { SaikiAgent } from '@core/index.js';
import type { CommandDefinition } from './command-parser.js';

/**
 * Documentation commands
 */
export const documentationCommands: CommandDefinition[] = [
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
];
