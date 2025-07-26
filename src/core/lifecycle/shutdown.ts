import { cleanupManager } from './cleanup.js';
import { logger } from '../logger/index.js';

/**
 * Registers shutdown handlers to gracefully clean up resources
 * when the application receives termination signals or encounters errors.
 */
export function registerShutdownHandlers(): void {
    // List of OS signals to listen for (e.g., Ctrl+C, kill, etc.)
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGUSR2'];

    // Register handlers for each shutdown signal
    signals.forEach((signal) => {
        process.on(signal, async () => {
            logger.info(`Received ${signal}, initiating graceful shutdown...`);

            try {
                // Attempt to run all registered cleanup tasks
                await cleanupManager.executeCleanup();
                process.exit(0); // Exit with success
            } catch (error) {
                // Log any error that occurred during cleanup
                logger.error('Error during cleanup:', error);
                process.exit(1); // Exit with failure
            }
        });
    });

    /**
     * Catch and handle uncaught exceptions to prevent the app from crashing abruptly.
     * Attempt a cleanup before exiting.
     */
    process.on('uncaughtException', async (error) => {
        logger.error('Uncaught exception:', error);
        try {
            await cleanupManager.executeCleanup();
        } catch (cleanupError) {
            logger.error('Error during emergency cleanup:', cleanupError);
        }
        process.exit(1); // Exit with failure
    });

    /**
     * Catch and handle unhandled promise rejections to ensure graceful recovery.
     * Attempt cleanup before exiting.
     */
    process.on('unhandledRejection', async (reason) => {
        logger.error('Unhandled rejection:', reason);
        try {
            await cleanupManager.executeCleanup();
        } catch (cleanupError) {
            logger.error('Error during emergency cleanup:', cleanupError);
        }
        process.exit(1); // Exit with failure
    });
}
