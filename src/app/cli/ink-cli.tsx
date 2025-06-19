import React from 'react';
import { render } from 'ink';
import { SaikiAgent } from '@core/index.js';
import { SaikiApp } from './components/SaikiApp.js';
import { logger } from '@core/index.js';

/**
 * Start the Ink-based CLI interface
 * @param agent The SaikiAgent instance
 */
export async function startInkCli(agent: SaikiAgent): Promise<void> {
    try {
        // Initialize CLI setup (similar to existing _initCli function)
        await initInkCli(agent);

        // Render the React app
        const app = render(<SaikiApp agent={agent} />);
        
        // Wait for the app to exit
        await app.waitUntilExit();
        
    } catch (error) {
        logger.error(`Error during Ink CLI initialization: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}

/**
 * Start headless Ink CLI for single command execution
 * @param agent The SaikiAgent instance
 * @param prompt The command to execute
 */
export async function startHeadlessInkCli(agent: SaikiAgent, prompt: string): Promise<void> {
    try {
        // Initialize CLI setup
        await initInkCli(agent);

        // Render the React app in headless mode
        const app = render(<SaikiApp agent={agent} headless={true} prompt={prompt} />);
        
        // Wait for the app to exit
        await app.waitUntilExit();
        
    } catch (error) {
        logger.error(`Error during headless Ink CLI execution: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}

/**
 * Initialize the Ink CLI (replaces the _initCli function)
 * @param agent The SaikiAgent instance
 */
async function initInkCli(agent: SaikiAgent): Promise<void> {
    // Log connection info
    logger.debug(`Log level: ${logger.getLevel()}`);
    logger.info(`Connected servers: ${agent.clientManager.getClients().size}`, null, 'green');
    
    const failedConnections = agent.clientManager.getFailedConnections();
    if (Object.keys(failedConnections).length > 0) {
        logger.error(`Failed connections: ${Object.keys(failedConnections).length}.`, null, 'red');
    }

    // Load available tools
    logger.info('Loading available tools...');
    try {
        const tools = await agent.clientManager.getAllTools();
        logger.info(
            `Loaded ${Object.keys(tools).length} tools from ${
                agent.clientManager.getClients().size
            } MCP servers`
        );
    } catch (error) {
        logger.error(
            `Failed to load tools: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    logger.info('Ink CLI initialized successfully. Ready for input.', null, 'green');
} 